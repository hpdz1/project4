import type { CarrierId } from "@/lib/types";
import { combineStatus, statusFromText } from "../status";
import {
  cleanShipper,
  draftsFor,
  expectedFrom,
  lead,
  trackingNumbersIn,
  type ParseContext,
  type ParserResult,
} from "./common";

/**
 * Any other sender (a shop, a marketplace, a regional carrier): only
 * recognizable tracking numbers count, using the tracking module's
 * false-positive guards (check digits, nearby keywords, order/phone/price
 * labels). Return-label emails are skipped: their number is for a package
 * going away from the user.
 */

/** At most this many shipments from one generic email (a long order history is not news). */
const MAX_GENERIC_UPDATES = 10;

const RETURN_LABEL_RE =
  /\breturn\s+(?:shipping\s+)?label\b|\bprepaid\s+(?:return\s+)?label\b|\breturn\s+authori[sz]ation\b|\bRMA\s*(?:#|number|no\.?)|\bdrop\s+(?:it\s+)?off\s+(?:your|the)\s+(?:return|package)\b/i;
const INBOUND_RE = /\b(?:on\s+(?:its|the)\s+way\s+to\s+you|coming\s+to\s+you|arriving|out\s+for\s+delivery|has\s+shipped|was\s+delivered)\b/i;

/** Display names that are not a shipper ("no-reply", "Customer Service"...). */
const GENERIC_NAME_RE = /^(?:no-?reply|do\s*not\s*reply|notifications?|customer\s+(?:service|care|support)|support|info|team|shipping|orders?)$/i;

function shipperFromName(name: string | null): string | null {
  const s = cleanShipper(name?.replace(/\s*(?:<|\().*$/, ""));
  return s && !GENERIC_NAME_RE.test(s) ? s : null;
}

/** Tracking numbers with the email's status and dates; `carrierHint` comes from the sender's domain, if any. */
export function parseGeneric(ctx: ParseContext, carrierHint?: CarrierId): ParserResult {
  const headline = `${ctx.subject}\n${lead(ctx, 600)}`;
  if (RETURN_LABEL_RE.test(headline) && !INBOUND_RE.test(headline)) return { updates: [], note: "return label" };
  const numbers = trackingNumbersIn(ctx, carrierHint).slice(0, MAX_GENERIC_UPDATES);
  if (numbers.length === 0) return { updates: [], note: "no tracking numbers found" };

  const status = combineStatus(statusFromText(ctx.subject), statusFromText(lead(ctx)));
  const { expectedDelivery, expectedWindow } = expectedFrom(ctx);
  const delivered = status === "delivered";
  return {
    updates: draftsFor(numbers, {
      shipper: shipperFromName(ctx.fromName),
      status,
      expectedDelivery: delivered ? null : expectedDelivery,
      expectedWindow: delivered ? null : expectedWindow,
    }),
  };
}
