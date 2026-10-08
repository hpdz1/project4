/**
 * SQLite schema, as an ordered list of migrations. MIGRATIONS[i] upgrades a
 * database from version i to i + 1; the current version lives in the
 * one-row `schema_version` table. Append new migrations; never edit old ones.
 *
 * Conventions: STRICT tables, ISO-8601 timestamps as TEXT (plus an INTEGER
 * `*_ms` copy where SQL has to sort or filter by time), booleans as INTEGER
 * 0/1, the programs checklist as a JSON object in TEXT.
 */
export const SCHEMA_VERSION_TABLE = `
CREATE TABLE IF NOT EXISTS schema_version (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL
) STRICT;
`;

export const MIGRATIONS: readonly string[] = [
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
];
