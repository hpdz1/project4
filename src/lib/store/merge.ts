import type { CarrierId, ShipmentStatus, ShipmentUpdate, StoredShipment } from "@/lib/types";
import { compareIso, maxIso, minIso } from "./time";

/**
 * Row identity for a shipment within an account: "tn:<tracking number>"
 * (any carrier), else "order:<order ref>" (any carrier, so a FedEx or UPS
 * email whose reference is an Amazon order number finds the Amazon order's
 * row), else null (the update cannot be stored).
 */
export function dedupeKey(u: Pick<ShipmentUpdate, "carrier" | "trackingNumber" | "orderRef">): string | null {
  if (u.trackingNumber) return `tn:${u.trackingNumber}`;
  if (u.orderRef) return `order:${u.orderRef}`;
  return null;
}

/** The normal forward progression. Statuses outside it (exception, pickup, return) are side states. */
const PROGRESSION: Partial<Record<ShipmentStatus, number>> = {
  unknown: 0,
  pre_transit: 1,
  in_transit: 2,
  out_for_delivery: 3,
  delivered: 4,
};

/** A newer email may only move a delivered package to one of these. */
const AFTER_DELIVERED: ReadonlySet<ShipmentStatus> = new Set<ShipmentStatus>(["exception", "return_to_sender"]);

function nextStatus(current: ShipmentStatus, incoming: ShipmentStatus | null, newer: boolean): ShipmentStatus {
  // "unknown" carries no information, so it never overwrites what we know.
  if (incoming === null || incoming === "unknown") return current;
  if (newer) {
    if (current === "delivered" && !AFTER_DELIVERED.has(incoming)) return current;
    return incoming;
  }
  // An email that arrives out of order may only push the package forward.
  const from = PROGRESSION[current];
  const to = PROGRESSION[incoming];
  return from !== undefined && to !== undefined && to > from ? incoming : current;
}

function nextCarrier(existing: StoredShipment, u: ShipmentUpdate, trackingNumber: string | null): CarrierId {
  if (existing.carrier === "unknown") return u.carrier;
  // An order row (no tracking number yet, e.g. an Amazon order confirmation) that now gets
  // its tracking number: the carrier that owns the number wins.
  if (existing.trackingNumber === null && u.trackingNumber !== null && u.carrier !== "unknown") return u.carrier;
  // Amazon hands many orders to USPS/UPS/...: the carrier that owns the tracking number wins.
  if (
    existing.carrier === "amazon" &&
    u.carrier !== "amazon" &&
    u.carrier !== "unknown" &&
    u.trackingNumber !== null &&
    u.trackingNumber === trackingNumber
  ) {
    return u.carrier;
  }
  return existing.carrier;
}

/** Takes the update's value when it has one and it is newer, or when nothing is stored yet. */
function pick(current: string | null, incoming: string | null, newer: boolean): string | null {
  return incoming !== null && (newer || current === null) ? incoming : current;
}

/**
 * Folds one email's facts into a stored shipment (or creates one with `id`).
 * Pure. Emails can arrive out of order, so "newer" means
 * `u.eventAt >= existing.lastEventAt`:
 * - status: a newer email wins, except "delivered" is sticky (only an
 *   exception or return-to-sender may replace it); an older email only moves
 *   the status forward along unknown < pre_transit < in_transit <
 *   out_for_delivery < delivered. A status of "unknown" never overwrites.
 * - deliveredAt is set when the status becomes delivered (kept while it stays
 *   delivered) and cleared when it stops being delivered.
 * - expected date/window: newer non-null values win; otherwise fill blanks.
 * - tracking number, order ref, shipper: fill blanks only. (Item
 *   descriptions are never stored: they can reveal sensitive purchases.)
 * - carrier: replaces "unknown"; on a row without a tracking number, the
 *   carrier of the update that brings one wins (an Amazon order row joined
 *   by a FedEx email whose reference is the order number becomes FedEx);
 *   and "amazon" gives way to the specific carrier that owns the same
 *   tracking number.
 * - user flags (hidden, userMarkedDelivered) are never touched.
 */
export function mergeShipment(existing: StoredShipment | null, u: ShipmentUpdate, id: string): StoredShipment {
  if (existing === null) {
    const status = u.status ?? "unknown";
    return {
      id,
      carrier: u.carrier,
      trackingNumber: u.trackingNumber,
      orderRef: u.orderRef,
      shipper: u.shipper,
      status,
      expectedDelivery: u.expectedDelivery,
      expectedWindow: u.expectedWindow,
      deliveredAt: status === "delivered" ? (u.deliveredAt ?? u.eventAt) : null,
      firstSeenAt: u.eventAt,
      lastEventAt: u.eventAt,
      source: u.source,
      hidden: false,
      userMarkedDelivered: false,
    };
  }

  const newer = compareIso(u.eventAt, existing.lastEventAt) >= 0;
  const status = nextStatus(existing.status, u.status, newer);
  const trackingNumber = existing.trackingNumber ?? u.trackingNumber;

  let deliveredAt: string | null = null;
  if (status === "delivered") {
    if (existing.status === "delivered" && existing.deliveredAt !== null) deliveredAt = existing.deliveredAt;
    else if (u.status === "delivered") deliveredAt = u.deliveredAt ?? u.eventAt;
    else deliveredAt = existing.deliveredAt ?? existing.lastEventAt;
  }

  return {
    id: existing.id,
    carrier: nextCarrier(existing, u, trackingNumber),
    trackingNumber,
    orderRef: existing.orderRef ?? u.orderRef,
    shipper: existing.shipper ?? u.shipper,
    status,
    expectedDelivery: pick(existing.expectedDelivery, u.expectedDelivery, newer),
    expectedWindow: pick(existing.expectedWindow, u.expectedWindow, newer),
    deliveredAt,
    firstSeenAt: minIso(existing.firstSeenAt, u.eventAt),
    lastEventAt: maxIso(existing.lastEventAt, u.eventAt),
    source: newer ? u.source : existing.source,
    hidden: existing.hidden,
    userMarkedDelivered: existing.userMarkedDelivered,
  };
}

/** Sort order for listShipments: newest activity first, then newest first-seen, then id. */
export function compareShipmentsNewestFirst(a: StoredShipment, b: StoredShipment): number {
  return (
    compareIso(b.lastEventAt, a.lastEventAt) ||
    compareIso(b.firstSeenAt, a.firstSeenAt) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}
