/**
 * Persistence: the Store interface, shipment merge rules, and the memory
 * (tests) and SQLite (node:sqlite) implementations. Server-only: importing
 * this from a client component pulls node:fs into the browser bundle.
 * See docs/ARCHITECTURE.md ("src/lib/store").
 */
import type { AccountView } from "@/lib/types";
import { SqliteStore } from "./sqlite";
import type { AccountRecord, Store } from "./types";

export type {
  AccountPatch,
  AccountRecord,
  CreateAccountInput,
  EmailLogEntry,
  EmailStats,
  Store,
} from "./types";
export { applyShipmentUpdates, type ShipmentRows } from "./apply";
export { DuplicateAccountError } from "./errors";
export { EMAIL_LOG_LIMIT, VERIFICATION_LIMIT } from "./limits";
export { compareShipmentsNewestFirst, dedupeKey, mergeShipment } from "./merge";
export { MemoryStore } from "./memory";
export { SqliteStore } from "./sqlite";

/** Where the SQLite file lives when DATABASE_PATH is unset (relative to the working directory). */
export const DEFAULT_DATABASE_PATH = ".data/package-radar.db";

// Cached on globalThis so Next dev's hot reloads reuse one connection instead of leaking a new one per edit.
const globalStore = globalThis as typeof globalThis & { __packageRadarStore?: Store };

/**
 * The process-wide Store: a SqliteStore at `DATABASE_PATH` (default
 * ".data/package-radar.db"; ":memory:" for a throwaway database), opened on
 * first use.
 */
export function getStore(): Store {
  globalStore.__packageRadarStore ??= new SqliteStore(process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH);
  return globalStore.__packageRadarStore;
}

/**
 * Replaces the process-wide Store, e.g. with a MemoryStore in tests. `null`
 * forgets it, so the next getStore() opens the default again. The previous
 * store is not closed.
 */
export function setStore(store: Store | null): void {
  if (store === null) delete globalStore.__packageRadarStore;
  else globalStore.__packageRadarStore = store;
}

/** The public view of an account: no key hash, and the full inbound address instead of the bare alias. */
export function toAccountView(record: AccountRecord, inboundDomain: string): AccountView {
  return {
    id: record.id,
    inboundAddress: `${record.alias}@${inboundDomain}`,
    country: record.country,
    postalCode: record.postalCode,
    region: record.region,
    timezone: record.timezone,
    programs: { ...record.programs },
    createdAt: record.createdAt,
  };
}
