import type { InboundEmail } from "@/lib/types";
import { extractAddresses, parseMailbox } from "./addresses";
import { classifySender } from "./classify";
import { htmlToText } from "./html";

/**
 * Routing forwarded mail: which account an email belongs to (the inbound
 * alias), and who originally sent a manually forwarded message.
 * See research/forwarding.md §4.
 */

/** Local part of an inbound alias: "r-" plus 12-32 lowercase letters/digits. */
const ALIAS_RE = /^r-[a-z0-9]{12,32}$/;

/** Headers searched first, in this order, after the envelope recipients. */
const PRIORITY_HEADERS = ["x-original-to", "delivered-to", "x-forwarded-to", "x-forwarded-for", "to", "cc", "envelope-to", "received"];
/** Headers that name senders or message ids, never recipients. */
const SENDER_HEADERS = new Set([
  "from", "sender", "reply-to", "return-path", "resent-from", "resent-sender", "errors-to",
  "message-id", "in-reply-to", "references", "list-unsubscribe", "list-id", "disposition-notification-to",
  "dkim-signature", "arc-message-signature", "arc-seal", "authentication-results", "arc-authentication-results",
]);

function aliasOf(address: string, domain: string): string | null {
  const at = address.lastIndexOf("@");
  if (at < 1) return null;
  const host = address.slice(at + 1).toLowerCase().replace(/\.$/, "");
  if (host !== domain) return null;
  const [base, ...tags] = address.slice(0, at).toLowerCase().split("+");
  if (ALIAS_RE.test(base)) return base;
  // Sub-addressing on a shared mailbox: "in+r-xxxx@domain" (Cloudflare) or "<hash>+r-xxxx@" (Postmark).
  if (tags.length === 1 && ALIAS_RE.test(tags[0])) return tags[0];
  return null;
}

/**
 * The inbound alias ("r-xxxx", lowercase) an email was sent to: an address on
 * `inboundDomain` (case-insensitive) whose local part is an alias, optionally
 * with a "+tag". Envelope/recipient fields are checked first, then recipient
 * headers, then any other header value except sender ones (From, Reply-To,
 * Return-Path...). Null when there is none.
 */
export function findInboundAlias(email: InboundEmail, inboundDomain: string): string | null {
  const domain = inboundDomain.trim().toLowerCase().replace(/^@/, "").replace(/\.$/, "");
  if (!domain) return null;
  const sources: string[] = [...email.recipients];
  for (const name of PRIORITY_HEADERS) {
    const v = email.headers[name];
    if (v) sources.push(v);
  }
  for (const [name, value] of Object.entries(email.headers)) {
    if (!PRIORITY_HEADERS.includes(name) && !SENDER_HEADERS.has(name)) sources.push(value);
  }
  for (const source of sources) {
    for (const address of extractAddresses(source)) {
      const alias = aliasOf(address, domain);
      if (alias) return alias;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Manual forwards
// ---------------------------------------------------------------------------

const FORWARD_PREFIX_RE = /^(?:\s*(?:\[(?:ext|external)\]\s*)?(?:fwd?|fw|tr|wg|enc|rv|doorst)\s*:\s*)+/i;

/** Subject without "Fwd:", "FW:", "TR:", "WG:" prefixes (repeated ones too). */
export function stripForwardPrefix(subject: string): string {
  return subject.replace(FORWARD_PREFIX_RE, "").trim();
}

/** Lines that open a forwarded message in Gmail, Yahoo, Outlook, Apple Mail and Thunderbird. */
const MARKER_RE =
  /(?:^|\n)[ \t>]*(?:-{2,}[ \t]*(?:Forwarded message|Original Message|Forwarded Message|Message transféré|Weitergeleitete Nachricht|Mensaje reenviado)[ \t]*-{2,}|Begin forwarded message:|_{10,}[ \t]*(?=\n[ \t>]*From:))/gi;
/** Outlook-style header block with no marker line: "From: ...\nSent: ...". */
const BARE_HEADER_RE = /(?:^|\n)(?=[ \t>]*From:[^\n]*\n[ \t>]*(?:Sent|Date):)/gi;
const HEADER_LINE_RE = /^(From|Date|Sent|Subject|To|Cc|Bcc|Reply-To)\s*:\s*(.*)$/i;
const INLINE_LABEL_RE = /\s+(?=(?:From|To|Cc|Sent|Date|Subject)\s*:)/g;

export interface ForwardedBlock {
  from: string;
  fromName: string | null;
  subject: string | null;
  /** The forwarded message's own Date line, as written ("Mon, Oct 5, 2026 at 9:12 AM"). */
  date: string | null;
  /** The forwarded message body. */
  body: string;
}

function unquote(line: string): string {
  return line.replace(/^[ \t]*(?:>[ \t]?)+/, "");
}

/** Forwarded blocks examined per email, and how far past a marker its header block may reach. */
const MAX_BLOCKS = 20;
const HEADER_WINDOW = 4_000;

interface BlockHeaders {
  from: string;
  fromName: string | null;
  subject: string | null;
  date: string | null;
  /** Offset in the scanned text where the forwarded body starts. */
  bodyStart: number;
}

/** Parses the header block that starts at `start`; null when it has no usable From. */
function parseHeadersAt(text: string, start: number): BlockHeaders | null {
  const windowText = text.slice(start, start + HEADER_WINDOW);
  const rawLines = windowText.split("\n");
  // Each entry: a header-ish line and the raw line it came from.
  let entries = rawLines.map((line, raw) => ({ line: unquote(line), raw }));
  // Yahoo writes the headers on the marker line: "----- Forwarded Message ----- From: … To: …".
  const firstLine = entries[0]?.line ?? "";
  if (/^\s*From\s*:/i.test(firstLine) && /\s(?:To|Sent|Subject)\s*:/i.test(firstLine)) {
    entries = [...firstLine.split(INLINE_LABEL_RE).map((line) => ({ line, raw: 0 })), ...entries.slice(1)];
  }
  const fields: Record<string, string> = {};
  let current: string | null = null;
  let i = 0;
  while (i < entries.length && entries[i].line.trim() === "") i++;
  for (; i < entries.length; i++) {
    const line = entries[i].line.trim();
    const m = HEADER_LINE_RE.exec(line);
    if (m) {
      current = m[1].toLowerCase();
      fields[current] ??= m[2].trim();
      continue;
    }
    if (line === "") {
      if (Object.keys(fields).length > 0) break;
      continue;
    }
    // Continuation of a wrapped header ("From: USPS <\nUSPSInformeddelivery@...>").
    if (current && (/<[^>]*$/.test(fields[current]) || /^[^\s<>]*@[^\s]*>?$/.test(line))) {
      fields[current] = `${fields[current]} ${line}`.trim();
      continue;
    }
    break;
  }
  const mailbox = fields.from ? parseMailbox(fields.from) : null;
  if (!mailbox) return null;
  const bodyLine = i < entries.length ? entries[i].raw : rawLines.length;
  let bodyStart = start;
  for (let r = 0; r < bodyLine; r++) bodyStart += rawLines[r].length + 1;
  return {
    from: mailbox.address,
    fromName: mailbox.name,
    subject: fields.subject ?? null,
    date: fields.date ?? fields.sent ?? null,
    bodyStart: Math.min(bodyStart, text.length),
  };
}

/**
 * Finds the forwarded message inside a manually forwarded email's text. With
 * several (a forward of a forward), the first one whose sender is a known
 * carrier wins, else the innermost one.
 */
export function findForwardedBlock(text: string): ForwardedBlock | null {
  const starts: number[] = [];
  for (const m of text.matchAll(MARKER_RE)) {
    starts.push((m.index ?? 0) + m[0].length);
    if (starts.length >= MAX_BLOCKS) break;
  }
  if (starts.length === 0) {
    for (const m of text.matchAll(BARE_HEADER_RE)) {
      starts.push((m.index ?? 0) + m[0].length);
      if (starts.length >= MAX_BLOCKS) break;
    }
  }
  let chosen: BlockHeaders | null = null;
  for (const start of starts) {
    const block = parseHeadersAt(text, start + (/^[ \t]*/.exec(text.slice(start, start + 200))?.[0].length ?? 0));
    if (!block) continue;
    chosen = block;
    if (classifySender(block.from)) break;
  }
  if (!chosen) return null;
  const { bodyStart, ...headers } = chosen;
  const body = text
    .slice(bodyStart)
    .split("\n")
    .map(unquote)
    .join("\n")
    .trim();
  return { ...headers, body };
}

export interface OriginalMessage {
  /** Lowercased address of the original sender. */
  from: string;
  fromName: string | null;
  /** Subject without forward prefixes. */
  subject: string;
  text: string;
  html: string;
  /** The forwarded message's own Date line, when this was a manual forward. */
  forwardedDate: string | null;
  /** True when the sender was recovered from a manually forwarded block. */
  forwarded: boolean;
}

/**
 * The message as the carrier sent it. Auto-forwarded and redirected mail keeps
 * the carrier's From, so it is returned as is (subject prefixes stripped).
 * Manual forwards ("Fwd:" with "---------- Forwarded message ---------",
 * "Begin forwarded message:", "-----Original Message-----", Outlook's
 * "From: … Sent: …" block) are unwrapped: sender, subject and body come from
 * the forwarded block. The HTML is kept whole.
 */
export function recoverOriginal(email: InboundEmail): OriginalMessage {
  const direct: OriginalMessage = {
    from: email.from,
    fromName: email.fromName,
    subject: stripForwardPrefix(email.subject),
    text: email.text,
    html: email.html,
    forwardedDate: null,
    forwarded: false,
  };
  if (classifySender(email.from)) return direct;
  const body = email.text.trim() ? email.text : htmlToText(email.html);
  const block = findForwardedBlock(body.replace(/\r\n?/g, "\n"));
  if (!block) return direct;
  return {
    from: block.from,
    fromName: block.fromName,
    subject: block.subject ? stripForwardPrefix(block.subject) : direct.subject,
    text: block.body,
    html: email.html,
    forwardedDate: block.date,
    forwarded: true,
  };
}
