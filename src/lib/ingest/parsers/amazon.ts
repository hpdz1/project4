import type { ShipmentStatus } from "@/lib/types";
import { statusFromText } from "../status";
import {
  AMAZON_ORDER_RE,
  draft,
  expectedFrom,
  trackingNumbersIn,
  type ParseContext,
  type ParserResult,
  type ShipmentDraft,
} from "./common";

/**
 * Amazon shipment notifications ("Shipped: "…"", "Out for delivery: …",
 * "Delivered: Your Amazon.com order #…", "Delivery update: …"). Amazon emails
 * rarely carry a carrier tracking number; the order number is the key. Every
 * template prints a progress bar ("Ordered Shipped Out for delivery
 * Delivered"), so status comes from the subject and headline, never from
 * those words. See research/carrier-emails.md §4.
 */

const SUBJECT_STATUS: readonly [RegExp, ShipmentStatus][] = [
  [/^(?:delivered\s*:|your\s+amazon(?:\.[a-z.]+)?\s+(?:order|package)\s+has\s+arrived)/i, "delivered"],
  [/^(?:out\s+for\s+delivery\s*:|arriving\s+today\s*:)/i, "out_for_delivery"],
  [/(?:a\s+package\s+to\s+pick\s+up|ready\s+for\s+pick\s?-?up)/i, "available_for_pickup"],
  [/^(?:shipped\s*:|your\s+amazon(?:\.[a-z.]+)?\s+order\b.*\bhas\s+(?:shipped|been\s+dispatched)|your\s+package\s+was\s+shipped)/i, "in_transit"],
  [/^ordered\s*:/i, "pre_transit"],
];

/** The progress bar, on one line (table cells) or one word per line. */
const PROGRESS_BAR_RE = /\bOrdered\s+Shipped\s+Out\s+for\s+delivery\s+Delivered\b/gi;
const PROGRESS_LINE_RE = /^\s*(?:ordered|shipped|out for delivery|delivered)\s*$/gim;
const ORDER_LABEL_RE = /\border\s*(?:#|number|no\.?)\s*:?\s*(\d{3}-\d{7}-\d{7})\b/i;
const ORDER_LINK_RE = /[?&](?:orderId|orderID|order_id)=(\d{3}-\d{7}-\d{7})\b/i;
const QUANTITY_RE = /^\s*(?:quantity|qty)\s*:?\s*\d+\b/i;
/** Item title in a subject: quoted ("Shipped: “…”") or truncated with an ellipsis ("Delivery update: Example Widget..."). */
const SUBJECT_TITLE_RES = [/^[a-z ]+:\s*["“”'‘’](.+?)["“”'‘’]?\s*$/i, /^[a-z ]+:\s*(.+?(?:\.{3}|…))\s*$/i];

function withoutProgressBar(text: string): string {
  return text.replace(PROGRESS_BAR_RE, " ").replace(PROGRESS_LINE_RE, "");
}

function subjectStatus(subject: string): ShipmentStatus | null {
  for (const [re, status] of SUBJECT_STATUS) if (re.test(subject)) return status;
  return null;
}

function orderNumberOf(ctx: ParseContext, body: string): string | null {
  return (
    AMAZON_ORDER_RE.exec(ctx.subject)?.[1] ??
    ORDER_LABEL_RE.exec(body)?.[1] ??
    ORDER_LABEL_RE.exec(ctx.htmlText)?.[1] ??
    ctx.links.map((l) => ORDER_LINK_RE.exec(l)?.[1]).find(Boolean) ??
    AMAZON_ORDER_RE.exec(body)?.[1] ??
    null
  );
}

function cleanTitle(raw: string): string | null {
  const s = raw
    .replace(/^[\s*•·-]+/, "")
    .replace(/(?:\.{3}|…)\s*$/, "")
    .replace(/\s+/g, " ")
    .replace(/[\s,;:]+$/, "")
    .trim();
  return s.length >= 3 && s.length <= 200 ? s : null;
}

/** Item title: the line before "Quantity: N", else the title in the subject. */
function descriptionOf(ctx: ParseContext, body: string): string | null {
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = 1; i < lines.length; i++) {
    if (!QUANTITY_RE.test(lines[i])) continue;
    const title = cleanTitle(lines[i - 1]);
    if (title && !/^(?:order|total|\$)/i.test(title)) return title;
  }
  for (const re of SUBJECT_TITLE_RES) {
    const title = re.exec(ctx.subject)?.[1];
    if (title) return cleanTitle(title);
  }
  return null;
}

/**
 * One update per Amazon shipment: carrier and tracking number when the email
 * carries a carrier number (UPS, USPS, TBA...), else carrier "amazon" keyed by
 * the order number. Emails with no shipment status (marketing, receipts) are
 * skipped.
 */
export function parseAmazon(ctx: ParseContext): ParserResult {
  const body = withoutProgressBar(ctx.body);
  // The subject is authoritative; the body only decides when the subject is silent ("Delivery update: …").
  const status = subjectStatus(ctx.subject) ?? statusFromText(ctx.subject) ?? statusFromText(body.slice(0, 800));
  if (!status) return { updates: [], note: "no shipment status" };

  const orderRef = orderNumberOf(ctx, body);
  const numbers = trackingNumbersIn({ ...ctx, body, text: withoutProgressBar(ctx.text), htmlText: withoutProgressBar(ctx.htmlText) });
  if (!orderRef && numbers.length === 0) return { updates: [], note: "no order or tracking number" };

  const delivered = status === "delivered";
  const { expectedDelivery, expectedWindow } = delivered
    ? { expectedDelivery: null, expectedWindow: null }
    : expectedFrom({ ...ctx, body }, [body, ctx.subject]);
  const facts: Partial<ShipmentDraft> = {
    orderRef,
    shipper: "Amazon",
    description: descriptionOf(ctx, body),
    status,
    expectedDelivery,
    expectedWindow,
  };
  if (numbers.length > 0) {
    return { updates: numbers.map((n) => draft(n.carrier, { ...facts, trackingNumber: n.trackingNumber })) };
  }
  return { updates: [draft("amazon", facts)] };
}
