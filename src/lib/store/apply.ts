import type { ShipmentUpdate, StoredShipment } from "@/lib/types";
import { dedupeKey, mergeShipment } from "./merge";

/** The row access `applyShipmentUpdates` needs; each Store backs it with its own storage. */
export interface ShipmentRows {
  /** The account's row stored under `key`, if any. */
  byKey(key: string): StoredShipment | null;
  /** The account's rows whose orderRef equals `orderRef`. */
  byOrderRef(orderRef: string): StoredShipment[];
  /** Inserts (`isNew`) or replaces the row with `shipment.id`, storing it under `key`. */
  save(shipment: StoredShipment, key: string, isNew: boolean): void;
}

/**
 * Finds the stored row an update belongs to:
 * 1. the row with the update's own key ("tn:..." or "order:...");
 * 2. for an update with a tracking number AND an order ref (Amazon "Shipped"
 *    email): the order's tracking-less row, first by order key, else the one
 *    tracking-less row with that order ref (the earlier email may have named
 *    another carrier). That row is then re-keyed to the tracking number;
 * 3. for an order-only update: the single row with that order ref, even when
 *    it was already re-keyed to a tracking number. With several candidates
 *    (a split order) nothing matches and a new order row is created.
 */
function findRow(rows: ShipmentRows, u: ShipmentUpdate, key: string): StoredShipment | null {
  const own = rows.byKey(key);
  if (own !== null || !u.orderRef) return own;

  if (u.trackingNumber) {
    const orderKey = dedupeKey({ carrier: u.carrier, trackingNumber: null, orderRef: u.orderRef });
    const byOrderKey = orderKey === null ? null : rows.byKey(orderKey);
    if (byOrderKey !== null) return byOrderKey;
    const untracked = rows.byOrderRef(u.orderRef).filter((s) => s.trackingNumber === null);
    return untracked.length === 1 ? untracked[0] : null;
  }

  const sameOrder = rows.byOrderRef(u.orderRef);
  return sameOrder.length === 1 ? sameOrder[0] : null;
}

/**
 * Applies updates in order against `rows` (call inside a transaction).
 * Updates with no dedupe key are skipped. Returns each affected shipment
 * once, in its final state, in the order it was first touched.
 */
export function applyShipmentUpdates(
  rows: ShipmentRows,
  updates: readonly ShipmentUpdate[],
  newId: () => string,
): StoredShipment[] {
  const affected = new Map<string, StoredShipment>();
  for (const u of updates) {
    const key = dedupeKey(u);
    if (key === null) continue;
    const existing = findRow(rows, u, key);
    const merged = mergeShipment(existing, u, existing?.id ?? newId());
    rows.save(merged, dedupeKey(merged) ?? key, existing === null);
    affected.set(merged.id, merged);
  }
  return [...affected.values()];
}
