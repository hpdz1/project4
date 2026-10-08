import { addDays, findDeliveryWindow, parseDateAt } from "../dates";
import { htmlToText } from "../html";
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
 * UPS / UPS My Choice ("UPS Update: Package Scheduled for Delivery Today",
 * "Your UPS Package was delivered", ...). The 2021+ HTML template has stable
 * element ids (shipperAndArrival, deliveryDateTime, trackingNumber); older and
 * plain-text versions use "Estimated Delivery Date:" labels.
 * See research/carrier-emails.md §2.
 */

const SHIPPER_HTML_RE =
  /\bid\s*=\s*["']?(?:m_\d+)?shipperAndArrival["']?[^<>]*>\s*(?:From|Shipper:?)\s*(?:<[^<>]{0,200}>\s*){0,3}([^<]{1,200})</i;
const SHIPPER_TEXT_RE = /^[ \t]*(?:From|Shipper)[ \t]*:?[ \t]+(?!:)([^\n]{1,200})$/im;
const DATETIME_HTML_RE = /\bid\s*=\s*["']?(?:m_\d+)?deliveryDateTime["']?[^<>]*>([\s\S]{0,400}?)<\/(?:td|p|span|div)>/i;

function shipperOf(ctx: ParseContext): string | null {
  const html = SHIPPER_HTML_RE.exec(ctx.html)?.[1];
  if (html) return cleanShipper(htmlToText(html));
  const text = SHIPPER_TEXT_RE.exec(ctx.body)?.[1];
  return cleanShipper(text);
}

/** "UPS Update: Package Scheduled for Delivery Tomorrow" etc. -> expected date relative to the email. */
function relativeFromSubject(subject: string, ref: string | null): string | null {
  if (!ref) return null;
  if (/\bdelivery\s+tomorrow\b|\barriving\s+tomorrow\b/i.test(subject)) return addDays(ref, 1);
  if (/\bdelivery\s+today\b|\barriving\s+today\b|live\s+map|pre-arrival/i.test(subject)) return ref;
  return null;
}

/** One update per UPS tracking number in the email. */
export function parseUps(ctx: ParseContext): ParserResult {
  const numbers = preferCarrier(trackingNumbersIn(ctx, "ups"), "ups");
  if (numbers.length === 0) return { updates: [], note: "no tracking numbers found" };

  const status = combineStatus(statusFromText(ctx.subject), statusFromText(lead(ctx)));

  let expectedDelivery: string | null = null;
  let expectedWindow: string | null = null;
  const dateTimeHtml = DATETIME_HTML_RE.exec(ctx.html)?.[1];
  if (dateTimeHtml) {
    const text = htmlToText(dateTimeHtml);
    expectedDelivery = parseDateAt(text, ctx.refDate)?.date ?? null;
    expectedWindow = findDeliveryWindow(`delivery ${text}`);
  }
  if (!expectedDelivery) {
    const found = expectedFrom(ctx, [ctx.body, ctx.subject]);
    expectedDelivery = found.expectedDelivery ?? relativeFromSubject(ctx.subject, ctx.refDate);
    expectedWindow ??= found.expectedWindow;
  }

  const delivered = status === "delivered";
  return {
    updates: draftsFor(numbers, {
      shipper: shipperOf(ctx),
      status,
      expectedDelivery: delivered ? null : expectedDelivery,
      expectedWindow: delivered ? null : expectedWindow,
    }),
  };
}
