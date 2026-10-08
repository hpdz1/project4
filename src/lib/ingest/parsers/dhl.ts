import { addDays } from "../dates";
import { combineStatus, statusFromText } from "../status";
import {
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
 * DHL Express On Demand Delivery and DHL shipment notifications. ODD uses the
 * same subject ("DHL On Demand Delivery") for every status, so the body
 * decides. See research/carrier-emails.md §5.
 */

const SHIPPER_RE = /\bwaybill\s+(?:number|no\.?)\s*\d+\s+from\s+(.{2,80}?)\s+(?:is|was|has|will)\b/i;
const WHEN_RE = /\bscheduled\s+for\s+delivery\s+(today|tomorrow)\b/i;

/** One update per DHL waybill in the email. */
export function parseDhl(ctx: ParseContext): ParserResult {
  const numbers = preferCarrier(trackingNumbersIn(ctx, "dhl"), "dhl");
  if (numbers.length === 0) return { updates: [], note: "no tracking numbers found" };

  const status = combineStatus(statusFromText(ctx.subject), statusFromText(lead(ctx)));
  let { expectedDelivery, expectedWindow } = expectedFrom(ctx);
  const when = WHEN_RE.exec(ctx.body)?.[1].toLowerCase();
  if (!expectedDelivery && when && ctx.refDate) expectedDelivery = when === "tomorrow" ? addDays(ctx.refDate, 1) : ctx.refDate;
  if (/\bby\s+end\s+of\s+day\b/i.test(ctx.body)) expectedWindow ??= "by end of day";

  const delivered = status === "delivered";
  return {
    updates: draftsFor(numbers, {
      shipper: cleanShipper(SHIPPER_RE.exec(ctx.body)?.[1]),
      status,
      expectedDelivery: delivered ? null : expectedDelivery,
      expectedWindow: delivered ? null : expectedWindow,
    }),
  };
}
