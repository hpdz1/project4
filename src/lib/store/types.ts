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
  close?(): void;
}
