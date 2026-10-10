import type {
  ForwardingVerification,
  ParsedEmail,
  ProgramId,
  ProgramState,
  ShipmentUpdate,
  SourceKind,
  StoredShipment,
} from "@/lib/types";

/** An account as stored. Never sent to the browser as-is (see `toAccountView`). */
export interface AccountRecord {
  id: string;
  /** Inbound alias, e.g. "r-k3j9x2m4q8w1". Unique, case-insensitive. */
  alias: string;
  /** SHA-256 hash of the secret sign-in key. Unique. */
  keyHash: string;
  country: string;
  postalCode: string | null;
  region: string | null;
  timezone: string;
  programs: Partial<Record<ProgramId, ProgramState>>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountInput {
  id: string;
  alias: string;
  keyHash: string;
  country: string;
  postalCode: string | null;
  region: string | null;
  timezone: string;
  /** ISO-8601; becomes createdAt and updatedAt. */
  now: string;
}

/** Fields to change; absent fields are left alone. */
export interface AccountPatch {
  country?: string;
  postalCode?: string | null;
  region?: string | null;
  timezone?: string;
  /** Merged into the stored map; `null` deletes that program's key. */
  programs?: Partial<Record<ProgramId, ProgramState | null>>;
  keyHash?: string;
}

/** One processed inbound email. Only metadata: raw bodies are never stored. */
export interface EmailLogEntry {
  /** ISO-8601 time the email was sent/received. */
  receivedAt: string;
  kind: ParsedEmail["kind"];
  /** Domain of the original sender, e.g. "ups.com". */
  senderDomain: string | null;
  /** Number of shipment updates the email produced. */
  updates: number;
  note: string | null;
}

/** Everything a Store holds about one account (see `Store.exportAccount`). */
export interface AccountSnapshot {
  account: AccountRecord;
  /** Newest activity first, like listShipments. */
  shipments: StoredShipment[];
  /** Newest first, like listEmailLog (at most EMAIL_LOG_LIMIT rows). */
  emailLog: EmailLogEntry[];
  /** Newest first (at most VERIFICATION_LIMIT). */
  verifications: ForwardingVerification[];
}

/** Rows deleted by `Store.purgeExpired`, per kind. */
export interface PurgeResult {
  shipments: number;
  emailLog: number;
  verifications: number;
}

export interface EmailStats {
  /** Every email ever recorded for the account (any kind). Not capped by the log size. */
  count: number;
  /** Newest `receivedAt` recorded, any kind. */
  lastAt: string | null;
  /** Newest email per carrier feed (only kinds that are a SourceKind), sorted by source. */
  feeds: { source: SourceKind; lastSeenAt: string }[];
}

/**
 * Persistence for accounts, shipments and email metadata.
 *
 * Contract (shared by every implementation, see store-contract.ts):
 * - Returned objects are copies; mutating them never changes stored data.
 * - Writes for an account that does not exist (applyUpdates, recordEmail,
 *   addVerification) are ignored, so a message racing an account deletion
 *   is dropped instead of failing.
 * - createAccount / updateAccount throw `DuplicateAccountError` when the id,
 *   alias (case-insensitive) or key hash is already taken.
 */
export interface Store {
  createAccount(input: CreateAccountInput): Promise<AccountRecord>;
  getAccountById(id: string): Promise<AccountRecord | null>;
  getAccountByKeyHash(keyHash: string): Promise<AccountRecord | null>;
  /** Case-insensitive. */
  getAccountByAlias(alias: string): Promise<AccountRecord | null>;
  /** null when the account does not exist. */
  updateAccount(id: string, patch: AccountPatch, now: string): Promise<AccountRecord | null>;
  /** Removes the account and ALL rows that belong to it. No-op when it does not exist. */
  deleteAccount(id: string): Promise<void>;
  /**
   * Merges updates into the account's shipments in one transaction (see
   * `applyShipmentUpdates` for how rows are matched). Updates without a
   * tracking number or order ref are skipped. `newId` is called once per new
   * row. Returns each affected shipment once, in its final state, in the
   * order it was first touched.
   */
  applyUpdates(accountId: string, updates: ShipmentUpdate[], newId: () => string): Promise<StoredShipment[]>;
  /** Newest activity first (lastEventAt, then firstSeenAt, then id). */
  listShipments(accountId: string): Promise<StoredShipment[]>;
  /** Deletes one shipment permanently. false if it does not exist or belongs to another account. */
  deleteShipment(accountId: string, shipmentId: string): Promise<boolean>;
  /** null if the shipment does not exist or belongs to another account. */
  setShipmentFlags(
    accountId: string,
    shipmentId: string,
    flags: { hidden?: boolean; userMarkedDelivered?: boolean },
  ): Promise<StoredShipment | null>;
  /**
   * Logs an email. Keeps the newest 200 log rows per account; bumps the
   * email count and, when `kind` is a SourceKind, that feed's lastSeenAt.
   */
  recordEmail(accountId: string, entry: EmailLogEntry): Promise<void>;
  /** Newest log rows first (by receivedAt, then insertion order). */
  listEmailLog(accountId: string, limit?: number): Promise<EmailLogEntry[]>;
  getEmailStats(accountId: string): Promise<EmailStats>;
  /** Keeps the newest 20 per account. */
  addVerification(accountId: string, v: ForwardingVerification): Promise<void>;
  /** Verifications with receivedAt >= sinceIso, newest first. Throws RangeError for an invalid sinceIso. */
  listVerifications(accountId: string, sinceIso: string): Promise<ForwardingVerification[]>;
  /**
   * Everything stored for the account (data portability), read as one
   * consistent snapshot. null when the account does not exist. The record
   * includes the key hash: map it with `toAccountView` before sending it out.
   */
  exportAccount(accountId: string): Promise<AccountSnapshot | null>;
  /**
   * Deletes expired rows across all accounts, in one transaction (see
   * docs/ARCHITECTURE.md "Retention"; the windows are in limits.ts). A row is
   * expired when its time is MORE than the window before `now`:
   * - shipments that are delivered (status "delivered" or marked by the
   *   user) whose deliveredAt, or lastEventAt when that is unset, is older
   *   than DELIVERED_RETENTION_MS;
   * - any shipment whose lastEventAt is older than STALE_SHIPMENT_RETENTION_MS;
   * - email log rows older than EMAIL_LOG_RETENTION_MS (the per-account
   *   EMAIL_LOG_LIMIT cap still applies on insert);
   * - forwarding verifications older than VERIFICATION_RETENTION_MS.
   * Unparseable stored times count as the oldest possible time. Email counts
   * and feed "last seen" times are kept. Throws RangeError for an invalid `now`.
   */
  purgeExpired(now: string): Promise<PurgeResult>;
  close?(): void;
}
