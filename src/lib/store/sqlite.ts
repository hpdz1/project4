import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  ForwardingVerification,
  ProgramId,
  ProgramState,
  ShipmentUpdate,
  StoredShipment,
} from "@/lib/types";
import { applyShipmentUpdates, type ShipmentRows } from "./apply";
import { DuplicateAccountError } from "./errors";
import {
  isCarrierId,
  isEmailKind,
  isShipmentStatus,
  isSourceKind,
  isVerificationProvider,
  patchPrograms,
  sanitizePrograms,
} from "./guards";
import { EMAIL_LOG_LIMIT, VERIFICATION_LIMIT } from "./limits";
import { compareShipmentsNewestFirst } from "./merge";
import { retentionCutoffs } from "./retention";
import { MIGRATIONS, SCHEMA_VERSION_TABLE } from "./sqlite-schema";
import { isoToMs, isoToSortMs, maxIso } from "./time";
import type {
  AccountPatch,
  AccountRecord,
  AccountSnapshot,
  CreateAccountInput,
  EmailLogEntry,
  EmailStats,
  PurgeResult,
  Store,
} from "./types";

// ---------------------------------------------------------------------------
// The slice of node:sqlite we use. Typed locally because the project's
// @types/node (v20) has no node:sqlite declarations, and loaded with
// process.getBuiltinModule so neither tsc nor the bundler has to resolve it.
// ---------------------------------------------------------------------------

type SqlValue = null | number | bigint | string | Uint8Array;
type Row = Record<string, SqlValue>;

interface Statement {
  run(...params: SqlValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: SqlValue[]): Row | undefined;
  all(...params: SqlValue[]): Row[];
}

interface Database {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  close(): void;
}

interface SqliteModule {
  DatabaseSync: new (path: string) => Database;
}

function openDatabase(path: string): Database {
  const sqlite = process.getBuiltinModule("node:sqlite") as SqliteModule | undefined;
  if (!sqlite || typeof sqlite.DatabaseSync !== "function") {
    throw new Error("node:sqlite is not available: Package Radar needs Node.js 22.13 or newer.");
  }
  return new sqlite.DatabaseSync(path);
}

// ---------------------------------------------------------------------------
// Row decoding
// ---------------------------------------------------------------------------

function text(row: Row, column: string): string {
  const value = row[column];
  if (typeof value !== "string") throw new TypeError(`Expected TEXT in column ${column}`);
  return value;
}

function textOrNull(row: Row, column: string): string | null {
  const value = row[column];
  return value === null || value === undefined ? null : text(row, column);
}

function int(row: Row, column: string): number {
  const value = row[column];
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  throw new TypeError(`Expected INTEGER in column ${column}`);
}

/** Only well-formed entries survive (see `sanitizePrograms`); anything else reads as an empty checklist. */
function decodePrograms(json: string): Partial<Record<ProgramId, ProgramState>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {};
  }
  return sanitizePrograms(parsed);
}

function decodeAccount(row: Row): AccountRecord {
  return {
    id: text(row, "id"),
    alias: text(row, "alias"),
    keyHash: text(row, "key_hash"),
    country: text(row, "country"),
    postalCode: textOrNull(row, "postal_code"),
    region: textOrNull(row, "region"),
    timezone: text(row, "timezone"),
    programs: decodePrograms(text(row, "programs")),
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
  };
}

function decodeShipment(row: Row): StoredShipment {
  const carrier = text(row, "carrier");
  const status = text(row, "status");
  const source = text(row, "source");
  return {
    id: text(row, "id"),
    carrier: isCarrierId(carrier) ? carrier : "unknown",
    trackingNumber: textOrNull(row, "tracking_number"),
    orderRef: textOrNull(row, "order_ref"),
    shipper: textOrNull(row, "shipper"),
    status: isShipmentStatus(status) ? status : "unknown",
    expectedDelivery: textOrNull(row, "expected_delivery"),
    expectedWindow: textOrNull(row, "expected_window"),
    deliveredAt: textOrNull(row, "delivered_at"),
    firstSeenAt: text(row, "first_seen_at"),
    lastEventAt: text(row, "last_event_at"),
    source: isSourceKind(source) ? source : "generic",
    hidden: int(row, "hidden") !== 0,
    userMarkedDelivered: int(row, "user_marked_delivered") !== 0,
  };
}

function decodeLogEntry(row: Row): EmailLogEntry {
  const kind = text(row, "kind");
  return {
    receivedAt: text(row, "received_at"),
    kind: isEmailKind(kind) ? kind : "ignored",
    senderDomain: textOrNull(row, "sender_domain"),
    updates: int(row, "updates"),
    note: textOrNull(row, "note"),
  };
}

function decodeVerification(row: Row): ForwardingVerification {
  const provider = text(row, "provider");
  return {
    provider: isVerificationProvider(provider) ? provider : "other",
    requestedBy: textOrNull(row, "requested_by"),
    code: textOrNull(row, "code"),
    link: textOrNull(row, "link"),
    receivedAt: text(row, "received_at"),
  };
}

/** Maps a UNIQUE-constraint error on `accounts` to the field that clashed. */
function duplicateField(error: unknown): DuplicateAccountError["field"] | null {
  const message = error instanceof Error ? error.message : "";
  if (!message.includes("UNIQUE constraint failed")) return null;
  if (message.includes("accounts.id")) return "id";
  if (message.includes("accounts.key_hash")) return "keyHash";
  if (message.includes("accounts_alias_lower")) return "alias";
  return null;
}

/** Every column a shipment write sets (besides id, account_id and dedupe_key), in `shipmentValues` order. */
const SHIPMENT_COLUMN_LIST = [
  "carrier",
  "tracking_number",
  "order_ref",
  "shipper",
  "status",
  "expected_delivery",
  "expected_window",
  "delivered_at",
  "first_seen_at",
  "last_event_at",
  "source",
  "hidden",
  "user_marked_delivered",
  "last_event_ms",
  "delivered_ms",
] as const;

const SHIPMENT_COLUMNS = SHIPMENT_COLUMN_LIST.join(", ");
const SHIPMENT_PLACEHOLDERS = SHIPMENT_COLUMN_LIST.map(() => "?").join(", ");

/** Values for SHIPMENT_COLUMN_LIST, in order. */
function shipmentValues(s: StoredShipment): SqlValue[] {
  return [
    s.carrier,
    s.trackingNumber,
    s.orderRef,
    s.shipper,
    s.status,
    s.expectedDelivery,
    s.expectedWindow,
    s.deliveredAt,
    s.firstSeenAt,
    s.lastEventAt,
    s.source,
    s.hidden ? 1 : 0,
    s.userMarkedDelivered ? 1 : 0,
    isoToSortMs(s.lastEventAt),
    s.deliveredAt === null ? null : isoToSortMs(s.deliveredAt),
  ];
}

/**
 * The retention deletes behind purgeExpired, each taking one cutoff in epoch
 * ms and each backed by an index from schema v2. The delivered query repeats
 * the shipments_delivered partial index's WHERE clause verbatim, which is
 * what lets SQLite use that index. Exported so tests can check the plans.
 */
export const RETENTION_SQL = {
  staleShipments: "DELETE FROM shipments WHERE last_event_ms < ?",
  deliveredShipments: `DELETE FROM shipments WHERE (status = 'delivered' OR user_marked_delivered = 1)
    AND coalesce(delivered_ms, last_event_ms) < ?`,
  emailLog: "DELETE FROM email_log WHERE received_ms < ?",
  verifications: "DELETE FROM verifications WHERE received_ms < ?",
} as const;

function prepareStatements(db: Database) {
  const p = (sql: string) => db.prepare(sql);
  return {
    accountExists: p("SELECT 1 AS found FROM accounts WHERE id = ?"),
    accountById: p("SELECT * FROM accounts WHERE id = ?"),
    accountByKeyHash: p("SELECT * FROM accounts WHERE key_hash = ?"),
    accountByAlias: p("SELECT * FROM accounts WHERE lower(alias) = lower(?)"),
    insertAccount: p(
      `INSERT INTO accounts (id, alias, key_hash, country, postal_code, region, timezone, programs, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '{}', ?, ?)`,
    ),
    updateAccount: p(
      `UPDATE accounts SET country = ?, postal_code = ?, region = ?, timezone = ?, programs = ?, key_hash = ?, updated_at = ?
       WHERE id = ?`,
    ),
    deleteAccount: p("DELETE FROM accounts WHERE id = ?"),

    shipmentByKey: p("SELECT * FROM shipments WHERE account_id = ? AND dedupe_key = ?"),
    shipmentsByOrderRef: p("SELECT * FROM shipments WHERE account_id = ? AND order_ref = ? ORDER BY rowid"),
    shipmentById: p("SELECT * FROM shipments WHERE account_id = ? AND id = ?"),
    shipmentsByAccount: p("SELECT * FROM shipments WHERE account_id = ?"),
    insertShipment: p(
      `INSERT INTO shipments (id, account_id, dedupe_key, ${SHIPMENT_COLUMNS})
       VALUES (?, ?, ?, ${SHIPMENT_PLACEHOLDERS})`,
    ),
    updateShipment: p(
      `UPDATE shipments SET dedupe_key = ?, (${SHIPMENT_COLUMNS}) = (${SHIPMENT_PLACEHOLDERS})
       WHERE account_id = ? AND id = ?`,
    ),
    deleteShipment: p("DELETE FROM shipments WHERE account_id = ? AND id = ?"),
    setShipmentFlags: p(
      `UPDATE shipments SET hidden = coalesce(?, hidden), user_marked_delivered = coalesce(?, user_marked_delivered)
       WHERE account_id = ? AND id = ?`,
    ),

    insertLog: p(
      `INSERT INTO email_log (account_id, received_at, received_ms, kind, sender_domain, updates, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ),
    pruneLog: p(
      `DELETE FROM email_log WHERE account_id = ? AND seq NOT IN (
         SELECT seq FROM email_log WHERE account_id = ? ORDER BY received_ms DESC, seq DESC LIMIT ?)`,
    ),
    listLog: p("SELECT * FROM email_log WHERE account_id = ? ORDER BY received_ms DESC, seq DESC LIMIT ?"),
    allLog: p("SELECT * FROM email_log WHERE account_id = ? ORDER BY received_ms DESC, seq DESC"),
    emailStats: p("SELECT email_count, last_email_at FROM accounts WHERE id = ?"),
    setEmailStats: p("UPDATE accounts SET email_count = ?, last_email_at = ? WHERE id = ?"),
    feed: p("SELECT last_seen_at FROM email_feeds WHERE account_id = ? AND source = ?"),
    upsertFeed: p(
      `INSERT INTO email_feeds (account_id, source, last_seen_at) VALUES (?, ?, ?)
       ON CONFLICT (account_id, source) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
    ),
    feeds: p("SELECT source, last_seen_at FROM email_feeds WHERE account_id = ? ORDER BY source"),

    insertVerification: p(
      `INSERT INTO verifications (account_id, provider, requested_by, code, link, received_at, received_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ),
    pruneVerifications: p(
      `DELETE FROM verifications WHERE account_id = ? AND seq NOT IN (
         SELECT seq FROM verifications WHERE account_id = ? ORDER BY received_ms DESC, seq DESC LIMIT ?)`,
    ),
    listVerifications: p(
      `SELECT * FROM verifications WHERE account_id = ? AND received_ms >= ? ORDER BY received_ms DESC, seq DESC`,
    ),
    allVerifications: p("SELECT * FROM verifications WHERE account_id = ? ORDER BY received_ms DESC, seq DESC"),

    purgeStaleShipments: p(RETENTION_SQL.staleShipments),
    purgeDeliveredShipments: p(RETENTION_SQL.deliveredShipments),
    purgeLog: p(RETENTION_SQL.emailLog),
    purgeVerifications: p(RETENTION_SQL.verifications),
  };
}

/**
 * Runs `fn` in a transaction, rolling back on error. IMMEDIATE (the default)
 * takes the write lock up front; DEFERRED suits read-only work that wants one
 * consistent snapshot.
 */
function transaction<T>(db: Database, fn: () => T, mode: "IMMEDIATE" | "DEFERRED" = "IMMEDIATE"): T {
  db.exec(`BEGIN ${mode}`);
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // SQLite already rolled back (e.g. after SQLITE_FULL); keep the original error.
    }
    throw error;
  }
}

/** Brings the schema up to MIGRATIONS.length. Safe to run from several processes at once. */
function migrate(db: Database): void {
  db.exec(SCHEMA_VERSION_TABLE);
  const readVersion = () => {
    const row = db.prepare("SELECT version FROM schema_version WHERE id = 1").get();
    return row ? int(row, "version") : 0;
  };
  const target = MIGRATIONS.length;
  if (readVersion() > target) {
    throw new Error(`Database schema v${readVersion()} is newer than this build supports (v${target}).`);
  }
  for (let version = readVersion(); version < target; version = readVersion()) {
    transaction(db, () => {
      if (readVersion() !== version) return; // another process migrated meanwhile
      const migration = MIGRATIONS[version];
      if (typeof migration === "string") db.exec(migration);
      else migration(db);
      db.prepare(
        `INSERT INTO schema_version (id, version) VALUES (1, ?)
         ON CONFLICT (id) DO UPDATE SET version = excluded.version`,
      ).run(version + 1);
    });
  }
}

/**
 * Store backed by a SQLite file through Node's built-in node:sqlite
 * (synchronous; methods are async only to match the Store interface).
 * Creates the parent directory and the schema on first use. Pass ":memory:"
 * for a throwaway database.
 */
export class SqliteStore implements Store {
  private readonly db: Database;
  private readonly sql: ReturnType<typeof prepareStatements>;

  constructor(path: string) {
    if (path.trim() === "") throw new Error("SqliteStore needs a database path (or \":memory:\").");
    if (path !== ":memory:" && !path.startsWith("file:")) mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = openDatabase(path);
    try {
      // secure_delete overwrites deleted content with zeros, so purged or deleted rows (and the
      // description column dropped by schema v2) don't linger in free space of the file.
      this.db.exec(
        "PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; " +
          "PRAGMA secure_delete = ON;",
      );
      migrate(this.db);
      this.sql = prepareStatements(this.db);
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  async createAccount(input: CreateAccountInput): Promise<AccountRecord> {
    if (this.sql.accountExists.get(input.id)) throw new DuplicateAccountError("id");
    if (this.sql.accountByAlias.get(input.alias)) throw new DuplicateAccountError("alias");
    if (this.sql.accountByKeyHash.get(input.keyHash)) throw new DuplicateAccountError("keyHash");
    try {
      this.sql.insertAccount.run(
        input.id,
        input.alias,
        input.keyHash,
        input.country,
        input.postalCode,
        input.region,
        input.timezone,
        input.now,
        input.now,
      );
    } catch (error) {
      const field = duplicateField(error);
      throw field ? new DuplicateAccountError(field) : error;
    }
    return this.requireAccount(input.id);
  }

  async getAccountById(id: string): Promise<AccountRecord | null> {
    const row = this.sql.accountById.get(id);
    return row ? decodeAccount(row) : null;
  }

  async getAccountByKeyHash(keyHash: string): Promise<AccountRecord | null> {
    const row = this.sql.accountByKeyHash.get(keyHash);
    return row ? decodeAccount(row) : null;
  }

  async getAccountByAlias(alias: string): Promise<AccountRecord | null> {
    const row = this.sql.accountByAlias.get(alias);
    return row ? decodeAccount(row) : null;
  }

  async updateAccount(id: string, patch: AccountPatch, now: string): Promise<AccountRecord | null> {
    return transaction(this.db, () => {
      const row = this.sql.accountById.get(id);
      if (!row) return null;
      const current = decodeAccount(row);
      if (patch.keyHash !== undefined && patch.keyHash !== current.keyHash && this.sql.accountByKeyHash.get(patch.keyHash)) {
        throw new DuplicateAccountError("keyHash");
      }
      const programs = patch.programs ? patchPrograms(current.programs, patch.programs) : current.programs;
      try {
        this.sql.updateAccount.run(
          patch.country ?? current.country,
          patch.postalCode !== undefined ? patch.postalCode : current.postalCode,
          patch.region !== undefined ? patch.region : current.region,
          patch.timezone ?? current.timezone,
          JSON.stringify(programs),
          patch.keyHash ?? current.keyHash,
          now,
          id,
        );
      } catch (error) {
        const field = duplicateField(error);
        throw field ? new DuplicateAccountError(field) : error;
      }
      return this.requireAccount(id);
    });
  }

  async deleteAccount(id: string): Promise<void> {
    // shipments, email_log, email_feeds and verifications go with it (ON DELETE CASCADE).
    this.sql.deleteAccount.run(id);
  }

  async applyUpdates(accountId: string, updates: ShipmentUpdate[], newId: () => string): Promise<StoredShipment[]> {
    return transaction(this.db, () => {
      if (!this.sql.accountExists.get(accountId)) return [];
      const rows: ShipmentRows = {
        byKey: (key) => {
          const row = this.sql.shipmentByKey.get(accountId, key);
          return row ? decodeShipment(row) : null;
        },
        byOrderRef: (orderRef) => this.sql.shipmentsByOrderRef.all(accountId, orderRef).map(decodeShipment),
        save: (shipment, key, isNew) => {
          if (isNew) this.sql.insertShipment.run(shipment.id, accountId, key, ...shipmentValues(shipment));
          else this.sql.updateShipment.run(key, ...shipmentValues(shipment), accountId, shipment.id);
        },
      };
      return applyShipmentUpdates(rows, updates, newId);
    });
  }

  async listShipments(accountId: string): Promise<StoredShipment[]> {
    return this.sql.shipmentsByAccount.all(accountId).map(decodeShipment).sort(compareShipmentsNewestFirst);
  }

  async deleteShipment(accountId: string, shipmentId: string): Promise<boolean> {
    return Number(this.sql.deleteShipment.run(accountId, shipmentId).changes) > 0;
  }

  async setShipmentFlags(
    accountId: string,
    shipmentId: string,
    flags: { hidden?: boolean; userMarkedDelivered?: boolean },
  ): Promise<StoredShipment | null> {
    const flag = (value: boolean | undefined) => (value === undefined ? null : value ? 1 : 0);
    this.sql.setShipmentFlags.run(flag(flags.hidden), flag(flags.userMarkedDelivered), accountId, shipmentId);
    const row = this.sql.shipmentById.get(accountId, shipmentId);
    return row ? decodeShipment(row) : null;
  }

  async recordEmail(accountId: string, entry: EmailLogEntry): Promise<void> {
    transaction(this.db, () => {
      const stats = this.sql.emailStats.get(accountId);
      if (!stats) return;
      this.sql.insertLog.run(
        accountId,
        entry.receivedAt,
        isoToSortMs(entry.receivedAt),
        entry.kind,
        entry.senderDomain,
        entry.updates,
        entry.note,
      );
      this.sql.pruneLog.run(accountId, accountId, EMAIL_LOG_LIMIT);

      const lastAt = textOrNull(stats, "last_email_at");
      this.sql.setEmailStats.run(
        int(stats, "email_count") + 1,
        lastAt === null ? entry.receivedAt : maxIso(lastAt, entry.receivedAt),
        accountId,
      );

      if (isSourceKind(entry.kind)) {
        const feed = this.sql.feed.get(accountId, entry.kind);
        const seen = feed ? text(feed, "last_seen_at") : null;
        this.sql.upsertFeed.run(accountId, entry.kind, seen === null ? entry.receivedAt : maxIso(seen, entry.receivedAt));
      }
    });
  }

  async listEmailLog(accountId: string, limit: number = EMAIL_LOG_LIMIT): Promise<EmailLogEntry[]> {
    return this.sql.listLog.all(accountId, Math.max(0, Math.floor(limit))).map(decodeLogEntry);
  }

  async getEmailStats(accountId: string): Promise<EmailStats> {
    const stats = this.sql.emailStats.get(accountId);
    if (!stats) return { count: 0, lastAt: null, feeds: [] };
    const feeds: EmailStats["feeds"] = [];
    for (const row of this.sql.feeds.all(accountId)) {
      const source = text(row, "source");
      if (isSourceKind(source)) feeds.push({ source, lastSeenAt: text(row, "last_seen_at") });
    }
    return { count: int(stats, "email_count"), lastAt: textOrNull(stats, "last_email_at"), feeds };
  }

  async addVerification(accountId: string, v: ForwardingVerification): Promise<void> {
    transaction(this.db, () => {
      if (!this.sql.accountExists.get(accountId)) return;
      this.sql.insertVerification.run(
        accountId,
        v.provider,
        v.requestedBy,
        v.code,
        v.link,
        v.receivedAt,
        isoToSortMs(v.receivedAt),
      );
      this.sql.pruneVerifications.run(accountId, accountId, VERIFICATION_LIMIT);
    });
  }

  async listVerifications(accountId: string, sinceIso: string): Promise<ForwardingVerification[]> {
    const since = isoToMs(sinceIso);
    if (Number.isNaN(since)) throw new RangeError(`Invalid sinceIso: ${sinceIso}`);
    return this.sql.listVerifications.all(accountId, since).map(decodeVerification);
  }

  async exportAccount(accountId: string): Promise<AccountSnapshot | null> {
    return transaction(
      this.db,
      () => {
        const row = this.sql.accountById.get(accountId);
        if (!row) return null;
        return {
          account: decodeAccount(row),
          shipments: this.sql.shipmentsByAccount.all(accountId).map(decodeShipment).sort(compareShipmentsNewestFirst),
          emailLog: this.sql.allLog.all(accountId).map(decodeLogEntry),
          verifications: this.sql.allVerifications.all(accountId).map(decodeVerification),
        };
      },
      "DEFERRED",
    );
  }

  async purgeExpired(now: string): Promise<PurgeResult> {
    const cutoffs = retentionCutoffs(now);
    return transaction(this.db, () => {
      const deleted = (statement: Statement, cutoff: number) => Number(statement.run(cutoff).changes);
      return {
        shipments:
          deleted(this.sql.purgeStaleShipments, cutoffs.staleMs) +
          deleted(this.sql.purgeDeliveredShipments, cutoffs.deliveredMs),
        emailLog: deleted(this.sql.purgeLog, cutoffs.emailLogMs),
        verifications: deleted(this.sql.purgeVerifications, cutoffs.verificationMs),
      };
    });
  }

  /** Closes the database. The store cannot be used afterwards. */
  close(): void {
    this.db.close();
  }

  private requireAccount(id: string): AccountRecord {
    const row = this.sql.accountById.get(id);
    if (!row) throw new Error(`Account ${id} vanished during a write`);
    return decodeAccount(row);
  }
}
