import { combineStatus, statusFromText } from "../status";
import {
  AMAZON_ORDER_RE,
  cleanShipper,
  draftsFor,
  expectedFrom,
  lead,
  preferCarrier,
  trackingNumbersIn,
  type ParseContext,
  type ParserResult,
} from "./common";

/**
 * FedEx / FedEx Delivery Manager ("FedEx Shipment 612…: Your package is now out
 * for delivery today", "Your shipment was delivered 885…"). Bodies are
 * uppercase labels followed by values (SCHEDULED DELIVERY, TRACKING NUMBER,
 * FROM, REFERENCE). Links are usually opaque click trackers, so the subject
 * and labels matter most. See research/carrier-emails.md §3.
 */

const SHIPPER_PROSE_RE =
  /\b(?:your|a)\s+(?:package|packages|shipment|shipments|delivery)\s+from\s+(.{2,80}?)\s+(?:is|are|was|were|will|has|have)\b/i;
const SHIPPER_DELAY_RE = /\bdelay\s+with\s+your\s+(?:package|shipment)\s+from\s+(.{2,80}?)[.\n]/i;
/** "FROM" label (case-sensitive: FedEx prints labels in capitals) followed by the shipper's name. */
const SHIPPER_LABEL_RE = /(?:^|\n)[ \t]*FROM[ \t]*(?:\n[ \t]*|:?[ \t]+)([^\n]+)/;
const REFERENCE_RE = /\bREFERENCE\b[\s:]*([^\n]{1,80})/;

function shipperOf(ctx: ParseContext): string | null {
  for (const text of [ctx.body, ctx.subject]) {
    const m = SHIPPER_PROSE_RE.exec(text) ?? SHIPPER_DELAY_RE.exec(text);
    const name = cleanShipper(m?.[1]);
    if (name) return name;
  }
  return cleanShipper(SHIPPER_LABEL_RE.exec(ctx.body)?.[1]);
}

/** One update per FedEx tracking number (multi-piece emails list several). */
export function parseFedex(ctx: ParseContext): ParserResult {
  const numbers = preferCarrier(trackingNumbersIn(ctx, "fedex"), "fedex");
  if (numbers.length === 0) return { updates: [], note: "no tracking numbers found" };

  const status = combineStatus(statusFromText(ctx.subject), statusFromText(lead(ctx)));
  const { expectedDelivery, expectedWindow } = expectedFrom(ctx);
  // FedEx puts the Amazon order number in REFERENCE for Amazon orders; it links the two.
  const reference = REFERENCE_RE.exec(ctx.body)?.[1];
  const orderRef = reference ? AMAZON_ORDER_RE.exec(reference)?.[1] ?? null : null;

  const delivered = status === "delivered";
  return {
    updates: draftsFor(numbers, {
      orderRef,
      shipper: shipperOf(ctx),
      status,
      expectedDelivery: delivered ? null : expectedDelivery,
      expectedWindow: delivered ? null : expectedWindow,
    }),
  };
}
