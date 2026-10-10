import { isoToSortMs } from "./time";

/**
 * SQLite schema, as an ordered list of migrations. MIGRATIONS[i] upgrades a
 * database from version i to i + 1; the current version lives in the
 * one-row `schema_version` table. Each runs in its own transaction. Append
 * new migrations; never edit old ones. A migration is SQL, or a function for
 * steps that need to look at the schema or data first; either way it must be
 * idempotent (safe to run on a database that already has its changes).
 *
 * Conventions: STRICT tables, ISO-8601 timestamps as TEXT (plus an INTEGER
 * `*_ms` copy where SQL has to sort or filter by time), booleans as INTEGER
 * 0/1, the programs checklist as a JSON object in TEXT.
 */

type SqlValue = null | number | bigint | string | Uint8Array;

/** The slice of a node:sqlite database a migration function uses. */
export interface MigrationDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: SqlValue[]): unknown;
    all(...params: SqlValue[]): Record<string, SqlValue>[];
  };
}

export type Migration = string | ((db: MigrationDatabase) => void);

function hasColumn(db: MigrationDatabase, table: string, column: string): boolean {
  return db.prepare(`SELECT 1 AS found FROM pragma_table_info(?) WHERE name = ?`).all(table, column).length > 0;
}

/**
 * v2 (worldwide + privacy):
 * - drops shipments.description: item descriptions can reveal sensitive
 *   purchases, so they are never stored (the connection runs with
 *   secure_delete, so the old values are overwritten, not just unlinked);
 * - order rows are keyed "order:<ref>" instead of "order:<carrier>:<ref>",
 *   so a carrier email whose reference is an order number joins the order's
 *   row. When an account has several tracking-less rows for one order ref
 *   (only possible under the old keys), the oldest takes the new key and the
 *   others keep theirs;
 * - adds last_event_ms / delivered_ms and the indexes the retention purge
 *   filters by.
 */
function migrateV2(db: MigrationDatabase): void {
  if (hasColumn(db, "shipments", "description")) db.exec("ALTER TABLE shipments DROP COLUMN description");

  db.exec(`
    UPDATE shipments SET dedupe_key = 'order:' || order_ref
    WHERE tracking_number IS NULL AND order_ref IS NOT NULL AND order_ref <> ''
      AND dedupe_key <> 'order:' || order_ref
      AND rowid = (
        SELECT min(s2.rowid) FROM shipments AS s2
        WHERE s2.account_id = shipments.account_id AND s2.order_ref = shipments.order_ref
          AND s2.tracking_number IS NULL)
      AND NOT EXISTS (
        SELECT 1 FROM shipments AS s3
        WHERE s3.account_id = shipments.account_id AND s3.dedupe_key = 'order:' || shipments.order_ref);
  `);

  if (!hasColumn(db, "shipments", "last_event_ms")) {
    db.exec("ALTER TABLE shipments ADD COLUMN last_event_ms INTEGER NOT NULL DEFAULT 0");
  }
  if (!hasColumn(db, "shipments", "delivered_ms")) db.exec("ALTER TABLE shipments ADD COLUMN delivered_ms INTEGER");
  const setTimes = db.prepare("UPDATE shipments SET last_event_ms = ?, delivered_ms = ? WHERE rowid = ?");
  for (const row of db.prepare("SELECT rowid AS rid, last_event_at, delivered_at FROM shipments").all()) {
    const lastEventAt = typeof row.last_event_at === "string" ? row.last_event_at : "";
    const deliveredAt = typeof row.delivered_at === "string" ? row.delivered_at : null;
    setTimes.run(isoToSortMs(lastEventAt), deliveredAt === null ? null : isoToSortMs(deliveredAt), row.rid);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS shipments_last_event ON shipments (last_event_ms);
    CREATE INDEX IF NOT EXISTS shipments_delivered ON shipments (coalesce(delivered_ms, last_event_ms))
      WHERE status = 'delivered' OR user_marked_delivered = 1;
    CREATE INDEX IF NOT EXISTS email_log_received ON email_log (received_ms);
    CREATE INDEX IF NOT EXISTS verifications_received ON verifications (received_ms);
  `);
}

export const SCHEMA_VERSION_TABLE = `
CREATE TABLE IF NOT EXISTS schema_version (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL
) STRICT;
`;

export const MIGRATIONS: readonly Migration[] = [
  // v1: initial schema.
  `
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    alias TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    country TEXT NOT NULL,
    postal_code TEXT,
    region TEXT,
    timezone TEXT NOT NULL,
    programs TEXT NOT NULL DEFAULT '{}',
    email_count INTEGER NOT NULL DEFAULT 0,
    last_email_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;
  CREATE UNIQUE INDEX IF NOT EXISTS accounts_alias_lower ON accounts (lower(alias));
  CREATE UNIQUE INDEX IF NOT EXISTS accounts_key_hash ON accounts (key_hash);

  CREATE TABLE IF NOT EXISTS shipments (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    dedupe_key TEXT NOT NULL,
    carrier TEXT NOT NULL,
    tracking_number TEXT,
    order_ref TEXT,
    shipper TEXT,
    description TEXT,
    status TEXT NOT NULL,
    expected_delivery TEXT,
    expected_window TEXT,
    delivered_at TEXT,
    first_seen_at TEXT NOT NULL,
    last_event_at TEXT NOT NULL,
    source TEXT NOT NULL,
    hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
    user_marked_delivered INTEGER NOT NULL DEFAULT 0 CHECK (user_marked_delivered IN (0, 1))
  ) STRICT;
  CREATE UNIQUE INDEX IF NOT EXISTS shipments_account_key ON shipments (account_id, dedupe_key);
  CREATE INDEX IF NOT EXISTS shipments_account_order ON shipments (account_id, order_ref);

  CREATE TABLE IF NOT EXISTS email_log (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    received_at TEXT NOT NULL,
    received_ms INTEGER NOT NULL,
    kind TEXT NOT NULL,
    sender_domain TEXT,
    updates INTEGER NOT NULL,
    note TEXT
  ) STRICT;
  CREATE INDEX IF NOT EXISTS email_log_account ON email_log (account_id, received_ms DESC, seq DESC);

  CREATE TABLE IF NOT EXISTS email_feeds (
    account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    PRIMARY KEY (account_id, source)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS verifications (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    requested_by TEXT,
    code TEXT,
    link TEXT,
    received_at TEXT NOT NULL,
    received_ms INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX IF NOT EXISTS verifications_account ON verifications (account_id, received_ms DESC, seq DESC);
  `,
  migrateV2,
];
