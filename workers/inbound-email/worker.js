/**
 * Package Radar inbound email worker (Cloudflare Email Routing -> Email Worker).
 *
 * Cloudflare hands every message sent to the inbound domain to `email()`.
 * The worker parses the MIME with postal-mime and POSTs a small JSON document
 * to the app's generic inbound endpoint:
 *
 *   POST <PACKAGE_RADAR_URL>/api/inbound/raw
 *   Authorization: Bearer <INBOUND_SECRET>
 *   { from, to, cc, subject, text, html, headers, date }
 *
 * Attachments and inline images are never sent; the app stores only the
 * shipment facts it extracts. See README.md for setup.
 *
 * Outcomes:
 * - app 2xx -> accepted; if the app says the address is unknown
 *   (status "unroutable") the message is rejected at SMTP time instead;
 * - app 429 or 5xx, network error, timeout -> the handler throws, so the
 *   sending server gets a temporary failure and retries later;
 * - any other app 4xx -> rejected (permanent failure);
 * - recipient that can't be an inbound alias -> rejected;
 * - message bigger than MAX_RAW_BYTES -> dropped silently (no bounce: big
 *   Informed Delivery digests shouldn't make Gmail complain to the user).
 */
import PostalMime from "postal-mime";

/** Default cap on the raw message size (bytes). Override with the MAX_RAW_BYTES variable. */
const DEFAULT_MAX_RAW_BYTES = 10 * 1024 * 1024;
/** The app rejects inbound bodies over 2 MiB; stay below that. */
const MAX_POST_BYTES = 1_900_000;
const MAX_TEXT_CHARS = 300_000;
const MAX_HTML_CHARS = 1_000_000;
const MAX_HEADERS = 200;
const MAX_HEADER_CHARS = 8_000;
const REQUEST_TIMEOUT_MS = 25_000;

/** Same rule as the app (src/lib/ingest/forwarding.ts): "r-" + 12-32 lowercase letters/digits, optional "+tag". */
const ALIAS_RE = /^r-[a-z0-9]{12,32}$/;

/** True when `address` could be an inbound alias: "r-xxxx@", "r-xxxx+tag@" or "anything+r-xxxx@". */
function looksLikeAlias(address) {
  const at = address.lastIndexOf("@");
  if (at < 1) return false;
  const [base, ...tags] = address.slice(0, at).toLowerCase().split("+");
  return ALIAS_RE.test(base) || (tags.length === 1 && ALIAS_RE.test(tags[0]));
}

/** "Name <address>" (or just the address) from a postal-mime address. */
function formatAddress(addr) {
  if (!addr) return "";
  const mailbox = addr.group ? addr.group[0] : addr;
  if (!mailbox || !mailbox.address) return "";
  const name = (mailbox.name || "").replace(/["<>\\\r\n]/g, "").trim();
  return name ? `"${name}" <${mailbox.address}>` : mailbox.address;
}

/** Plain addresses from a postal-mime address list (groups flattened). */
function addressList(list) {
  const out = [];
  for (const addr of list || []) {
    if (addr.group) for (const m of addr.group) m.address && out.push(m.address);
    else if (addr.address) out.push(addr.address);
  }
  return out;
}

/** Removes base64 `data:` images (Informed Delivery scans can be megabytes); the parser doesn't need them. */
function stripInlineImages(html) {
  return html.replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+/gi, "");
}

function clip(s, max) {
  return s.length > max ? s.slice(0, max) : s;
}

function byteLength(s) {
  return new TextEncoder().encode(s).byteLength;
}

export default {
  /**
   * @param {ForwardableEmailMessage} message
   * @param {{ PACKAGE_RADAR_URL?: string; INBOUND_SECRET?: string; MAX_RAW_BYTES?: string }} env
   */
  async email(message, env) {
    const base = (env.PACKAGE_RADAR_URL || "").trim().replace(/\/+$/, "");
    if (!base || !env.INBOUND_SECRET) {
      // Configuration problem: fail temporarily so mail is retried once it's fixed.
      throw new Error("PACKAGE_RADAR_URL and INBOUND_SECRET must be set");
    }

    if (!looksLikeAlias(message.to)) {
      message.setReject("Unknown recipient");
      return;
    }

    const maxRaw = Number(env.MAX_RAW_BYTES) > 0 ? Number(env.MAX_RAW_BYTES) : DEFAULT_MAX_RAW_BYTES;
    if (message.rawSize > maxRaw) {
      console.log(`Dropping a ${message.rawSize}-byte message (limit ${maxRaw})`);
      return;
    }

    let parsed;
    try {
      parsed = await PostalMime.parse(message.raw, {
        maxPartCount: 1000,
        maxNestingDepth: 32,
        maxHeadersSize: 512 * 1024,
      });
    } catch (err) {
      console.log(`Could not parse message: ${err && err.message}`);
      message.setReject("Malformed message");
      return;
    }

    const payload = {
      from: formatAddress(parsed.from) || message.from,
      // The envelope recipient carries the alias (the To header is usually the user's own mailbox).
      to: [message.to],
      cc: addressList(parsed.cc),
      subject: parsed.subject || "",
      text: clip(parsed.text || "", MAX_TEXT_CHARS),
      html: clip(stripInlineImages(parsed.html || ""), MAX_HTML_CHARS),
      headers: parsed.headers
        .slice(0, MAX_HEADERS)
        .map((h) => ({ name: h.key, value: clip(h.value, MAX_HEADER_CHARS) })),
      date: parsed.date || null,
    };

    let body = JSON.stringify(payload);
    if (byteLength(body) > MAX_POST_BYTES) {
      payload.html = "";
      body = JSON.stringify(payload);
    }
    if (byteLength(body) > MAX_POST_BYTES) {
      console.log("Dropping a message whose text is too large to forward");
      return;
    }

    const res = await fetch(`${base}/api/inbound/raw`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.INBOUND_SECRET}`,
      },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (res.ok) {
      const result = await res.json().catch(() => null);
      if (result && result.status === "unroutable") message.setReject("Unknown recipient");
      return;
    }
    if (res.status === 429 || res.status >= 500) {
      // Temporary: the sending server will retry.
      throw new Error(`Package Radar answered HTTP ${res.status}`);
    }
    console.log(`Package Radar rejected the message with HTTP ${res.status}`);
    message.setReject(`Rejected by Package Radar (HTTP ${res.status})`);
  },
};
