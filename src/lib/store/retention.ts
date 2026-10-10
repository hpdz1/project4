import type { StoredShipment } from "@/lib/types";
import {
  DELIVERED_RETENTION_MS,
  EMAIL_LOG_RETENTION_MS,
  STALE_SHIPMENT_RETENTION_MS,
  VERIFICATION_RETENTION_MS,
} from "./limits";
import { isoToMs, isoToSortMs } from "./time";

/** Epoch-ms cutoffs for one purge: a row whose time is strictly before its cutoff is expired. */
export interface RetentionCutoffs {
  deliveredMs: number;
  staleMs: number;
  emailLogMs: number;
  verificationMs: number;
}

/** The cutoffs for a purge at `now`. Throws RangeError for an unparseable `now`. */
export function retentionCutoffs(now: string): RetentionCutoffs {
  const nowMs = isoToMs(now);
  if (Number.isNaN(nowMs)) throw new RangeError(`Invalid now: ${now}`);
  return {
    deliveredMs: nowMs - DELIVERED_RETENTION_MS,
    staleMs: nowMs - STALE_SHIPMENT_RETENTION_MS,
    emailLogMs: nowMs - EMAIL_LOG_RETENTION_MS,
    verificationMs: nowMs - VERIFICATION_RETENTION_MS,
  };
}

/** Whether the shipment is a delivered one (by its status or the user's say-so). */
export function isDelivered(s: Pick<StoredShipment, "status" | "userMarkedDelivered">): boolean {
  return s.status === "delivered" || s.userMarkedDelivered;
}

/**
 * Whether retention deletes the shipment: no news since before the stale
 * cutoff, or delivered (deliveredAt, else lastEventAt) before the delivered
 * cutoff. Unparseable times count as the oldest possible time.
 */
export function isShipmentExpired(s: StoredShipment, cutoffs: RetentionCutoffs): boolean {
  const lastEventMs = isoToSortMs(s.lastEventAt);
  if (lastEventMs < cutoffs.staleMs) return true;
  if (!isDelivered(s)) return false;
  const deliveredMs = s.deliveredAt === null ? lastEventMs : isoToSortMs(s.deliveredAt);
  return deliveredMs < cutoffs.deliveredMs;
}
