import type { InboundEmail, ParsedEmail, ShipmentUpdate, SourceKind } from "@/lib/types";
import { carrierHintForSender, classifyEmail, type CarrierSourceKind } from "./classify";
import { isValidTimeZone, localDateAtOffset, localDateIn, parseDateAt, parseMailDate, utcDate } from "./dates";
import { recoverOriginal, type OriginalMessage } from "./forwarding";
import { extractLinks, htmlToText } from "./html";
import { draftsFromMarkup } from "./jsonld";
import { parseAmazon } from "./parsers/amazon";
import type { ParseContext, ParserResult, ShipmentDraft } from "./parsers/common";
import { parseDhl } from "./parsers/dhl";
import { parseFedex } from "./parsers/fedex";
import { parseGeneric } from "./parsers/generic";
import { parseUps } from "./parsers/ups";
import { parseUspsAlert, parseUspsDigest } from "./parsers/usps";
import { parseForwardingVerification } from "./verification";

export interface ParseOptions {
  /**
   * IANA time zone of the delivery address (the account's), used to decide
   * what "today", "tomorrow" and year-less dates mean. Without it the offset
   * in the email's Date header is used, then UTC.
   */
  timezone?: string;
}

/** Most updates we take from one email. */
const MAX_UPDATES = 25;

const PARSERS: Record<CarrierSourceKind, (ctx: ParseContext) => ParserResult> = {
  usps_digest: parseUspsDigest,
  usps_alert: parseUspsAlert,
  ups: parseUps,
  fedex: parseFedex,
  amazon: parseAmazon,
  dhl: parseDhl,
};

/** The email's calendar date at the delivery address. */
function referenceDate(email: InboundEmail, original: OriginalMessage, timezone?: string): string | null {
  const sent = new Date(email.date);
  if (Number.isNaN(sent.getTime())) return null;
  let ref: string;
  if (timezone && isValidTimeZone(timezone)) {
    ref = localDateIn(sent, timezone);
  } else {
    const offset = parseMailDate(email.headers.date ?? "")?.offsetMinutes;
    ref = offset === null || offset === undefined ? utcDate(sent) : localDateAtOffset(sent, offset);
  }
  // A manual forward of an older email: relative dates count from the original's date.
  if (original.forwardedDate) {
    const forwarded = parseDateAt(original.forwardedDate, ref)?.date;
    if (forwarded && forwarded <= ref && forwarded >= `${Number(ref.slice(0, 4)) - 1}${ref.slice(4)}`) return forwarded;
  }
  return ref;
}

/**
 * Plain-text body with bounded whitespace: CRLF -> LF, runs of spaces/tabs
 * become one space, at most one blank line. Keeps every later regex linear.
 */
function tidyText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v\u00A0\u2000-\u200A\u202F\u205F\u3000]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function buildContext(email: InboundEmail, original: OriginalMessage, timezone?: string): ParseContext {
  const htmlText = htmlToText(original.html);
  const text = tidyText(original.text);
  // Prefer the plain text unless it's a stub ("view this email in a browser").
  const body = text.trim().length >= 200 || !htmlText ? text : htmlText.length > text.length ? htmlText : text;
  return {
    subject: original.subject,
    text,
    html: original.html,
    htmlText,
    links: extractLinks(original.html),
    body,
    from: original.from,
    fromName: original.fromName,
    refDate: referenceDate(email, original, timezone),
  };
}

function keyOf(d: ShipmentDraft): string | null {
  if (d.trackingNumber) return `tn:${d.trackingNumber}`;
  if (d.orderRef) return `order:${d.carrier}:${d.orderRef}`;
  return null;
}

/** Fills the empty fields of `base` from `extra`; `extra` wins where `preferExtra` (markup is the more reliable source). */
function mergeDraft(base: ShipmentDraft, extra: ShipmentDraft, preferExtra: boolean): ShipmentDraft {
  const out: ShipmentDraft = { ...base };
  const keys: (keyof ShipmentDraft)[] = [
    "trackingNumber", "orderRef", "shipper", "description", "status", "expectedDelivery", "expectedWindow", "deliveredAt",
  ];
  for (const k of keys) {
    const value = extra[k];
    if (value === null || value === undefined) continue;
    if (preferExtra || out[k] === null) (out as Record<string, unknown>)[k] = value;
  }
  if (out.carrier === "unknown" || (preferExtra && extra.carrier !== "unknown")) out.carrier = extra.carrier;
  return out;
}

/** Adds markup drafts to parser drafts: same shipment -> merged (markup wins), new shipment -> appended. */
function withMarkup(drafts: ShipmentDraft[], markup: ShipmentDraft[]): ShipmentDraft[] {
  const out = [...drafts];
  for (const m of markup) {
    const i = out.findIndex(
      (d) =>
        (m.trackingNumber && d.trackingNumber === m.trackingNumber) ||
        (!m.trackingNumber && m.orderRef && d.orderRef === m.orderRef),
    );
    if (i >= 0) out[i] = mergeDraft(out[i], m, true);
    else out.push(m);
  }
  return out;
}

function finalize(drafts: ShipmentDraft[], email: InboundEmail, source: SourceKind): ShipmentUpdate[] {
  const byKey = new Map<string, ShipmentDraft>();
  for (const d of drafts) {
    const key = keyOf(d);
    if (!key) continue; // never an update with neither a tracking number nor an order number
    const existing = byKey.get(key);
    byKey.set(key, existing ? mergeDraft(existing, d, false) : d);
    if (byKey.size >= MAX_UPDATES) break;
  }
  return [...byKey.values()].map((d) => ({
    ...d,
    deliveredAt: d.status === "delivered" ? d.deliveredAt ?? email.date : d.deliveredAt,
    eventAt: email.date,
    source,
  }));
}

function parseUnsafe(email: InboundEmail, opts: ParseOptions): ParsedEmail {
  const verification = parseForwardingVerification(email);
  if (verification) return { kind: "forwarding_verification", updates: [], verification, note: null };

  const original = recoverOriginal(email);
  const ctx = buildContext(email, original, opts.timezone);
  const carrierKind = classifyEmail(original.from, original.subject);
  const result = carrierKind
    ? PARSERS[carrierKind](ctx)
    : parseGeneric(ctx, carrierHintForSender(original.from));
  const markup = draftsFromMarkup(original.html);
  const kind: SourceKind = carrierKind ?? "generic";
  const updates = finalize(withMarkup(result.updates, markup), email, kind);

  if (updates.length === 0 && !carrierKind) {
    return { kind: "ignored", updates: [], verification: null, note: result.note ?? "no tracking numbers found" };
  }
  const note = updates.length === 0 ? result.note ?? "no tracking numbers found" : original.forwarded ? "manual forward" : null;
  return { kind, updates, verification: null, note };
}

/**
 * Reads one inbound email: a forwarding confirmation (Gmail etc.), a carrier
 * email (USPS digest/alert, UPS, FedEx, Amazon, DHL) with its shipment
 * updates, a generic email with recognizable tracking numbers, or "ignored".
 * Manual forwards are unwrapped first; schema.org ParcelDelivery markup, when
 * present, overrides what the text says. A carrier email with nothing in it
 * keeps its kind (the feed is alive) with zero updates and a note.
 *
 * Pure and total: it never throws; unexpected input yields kind "ignored".
 */
export function parseEmail(email: InboundEmail, opts: ParseOptions = {}): ParsedEmail {
  try {
    return parseUnsafe(email, opts);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { kind: "ignored", updates: [], verification: null, note: `parse error: ${message.slice(0, 200)}` };
  }
}
