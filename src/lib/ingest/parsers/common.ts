import type { CarrierId, DetectedTrackingNumber, ShipmentUpdate } from "@/lib/types";
import { findTrackingNumbers } from "@/lib/tracking";
import { findDeliveryWindow, findExpectedDate } from "../dates";

/** A shipment update before the email-level fields (eventAt, source) are filled in. */
export type ShipmentDraft = Omit<ShipmentUpdate, "eventAt" | "source">;

/** Everything a carrier parser needs, already unwrapped from forwards and decoded. */
export interface ParseContext {
  /** Original subject, forward prefixes removed. */
  subject: string;
  /** Plain-text body as sent (may be empty). */
  text: string;
  /** HTML body as sent (may be empty). */
  html: string;
  /** `htmlToText(html)`. */
  htmlText: string;
  /** Link targets from the HTML. */
  links: string[];
  /** The better of `text` / `htmlText` for reading prose. */
  body: string;
  /** Original sender address and display name. */
  from: string;
  fromName: string | null;
  /** The email's calendar date at the delivery address (YYYY-MM-DD), null if unknown. */
  refDate: string | null;
}

export interface ParserResult {
  updates: ShipmentDraft[];
  /** Why nothing was found, when that is interesting. */
  note?: string;
}

/** A draft with every optional fact unknown. */
export function draft(carrier: CarrierId, fields: Partial<ShipmentDraft> = {}): ShipmentDraft {
  return {
    carrier,
    trackingNumber: null,
    orderRef: null,
    shipper: null,
    description: null,
    status: null,
    expectedDelivery: null,
    expectedWindow: null,
    deliveredAt: null,
    ...fields,
  };
}

/**
 * How much of each body (and of the link list) is searched for tracking
 * numbers. Carrier emails put them in the first few kilobytes; the cap keeps
 * hostile input from making the search slow.
 */
export const MAX_SCAN_CHARS = 60_000;

/** Subject, both bodies and the HTML links: everything a tracking number could hide in. */
export function scanText(ctx: ParseContext): string {
  const parts = [ctx.subject, ctx.text.slice(0, MAX_SCAN_CHARS)];
  if (ctx.htmlText && ctx.htmlText !== ctx.text) parts.push(ctx.htmlText.slice(0, MAX_SCAN_CHARS));
  if (ctx.links.length) parts.push(ctx.links.join("\n").slice(0, MAX_SCAN_CHARS / 2));
  return parts.filter(Boolean).join("\n\n");
}

/** Drops failing check digits and degenerate numbers ("111111111111") that only pass by accident. */
export function plausible(numbers: DetectedTrackingNumber[]): DetectedTrackingNumber[] {
  return numbers.filter((d) => d.checksumValid !== false && !/^(.)\1+$/.test(d.trackingNumber));
}

/** Tracking numbers in the whole email whose check digit (if any) passes. */
export function trackingNumbersIn(ctx: ParseContext, carrierHint?: CarrierId): DetectedTrackingNumber[] {
  return plausible(findTrackingNumbers(scanText(ctx), carrierHint ? { carrierHint } : {}));
}

/** The opening of the body, where carriers put the headline (status words further down are often footers or trackers). */
export function lead(ctx: ParseContext, chars = 800): string {
  return ctx.body.slice(0, chars);
}

/** Expected date and window from the subject, then the body. */
export function expectedFrom(
  ctx: ParseContext,
  texts: string[] = [ctx.subject, ctx.body],
): { expectedDelivery: string | null; expectedWindow: string | null } {
  for (const text of texts) {
    if (!text) continue;
    const m = findExpectedDate(text, ctx.refDate);
    if (m) return { expectedDelivery: m.date, expectedWindow: findDeliveryWindow(text, m.end) };
  }
  let expectedWindow: string | null = null;
  for (const text of texts) expectedWindow ??= text ? findDeliveryWindow(text) : null;
  return { expectedDelivery: null, expectedWindow };
}

/** Collapses whitespace and trims; null for empty or implausible names. */
export function cleanShipper(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.replace(/\s+/g, " ").replace(/^[\s:,-]+|[\s:,.-]+$/g, "").trim();
  if (s.length < 2 || s.length > 80 || s.includes("@") || /^https?:/i.test(s) || !/[A-Za-z]/.test(s)) return null;
  return s;
}

/** One draft per tracking number, sharing the email-level facts. */
export function draftsFor(numbers: DetectedTrackingNumber[], facts: Partial<ShipmentDraft>): ShipmentDraft[] {
  return numbers.map((n) => draft(n.carrier, { ...facts, trackingNumber: n.trackingNumber }));
}

/** Keeps the numbers for `carrier` when there are any (a UPS email may mention a USPS-looking reference). */
export function preferCarrier(numbers: DetectedTrackingNumber[], carrier: CarrierId): DetectedTrackingNumber[] {
  const own = numbers.filter((n) => n.carrier === carrier);
  return own.length > 0 ? own : numbers;
}

/** Amazon order number ("113-1234567-1234567"). */
export const AMAZON_ORDER_RE = /\b(\d{3}-\d{7}-\d{7})\b/;
