import type { ForwardingVerification, ShipmentUpdate, SourceKind, StoredShipment } from "@/lib/types";
import { applyShipmentUpdates, type ShipmentRows } from "./apply";
import { DuplicateAccountError } from "./errors";
import { isSourceKind, patchPrograms } from "./guards";
import { EMAIL_LOG_LIMIT, VERIFICATION_LIMIT } from "./limits";
import { compareShipmentsNewestFirst } from "./merge";
import { isShipmentExpired, retentionCutoffs } from "./retention";
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

interface ShipmentRow {
  key: string;
  shipment: StoredShipment;
}

interface Sequenced<T> {
  seq: number;
  ms: number;
  value: T;
}

interface AccountData {
  record: AccountRecord;
  /** By shipment id. */
  shipments: Map<string, ShipmentRow>;
  /** Newest first. */
  log: Sequenced<EmailLogEntry>[];
  emailCount: number;
  lastEmailAt: string | null;
  feeds: Map<SourceKind, string>;
  /** Newest first. */
  verifications: Sequenced<ForwardingVerification>[];
}

const copyAccount = (r: AccountRecord): AccountRecord => ({ ...r, programs: { ...r.programs } });

const newestFirst = <T>(a: Sequenced<T>, b: Sequenced<T>): number => b.ms - a.ms || b.seq - a.seq;

/** Rows over a working copy of one account's shipments, so applyUpdates can commit all-or-nothing. */
function rowsOver(shipments: Map<string, ShipmentRow>): ShipmentRows {
  return {
    byKey(key) {
      for (const row of shipments.values()) if (row.key === key) return { ...row.shipment };
      return null;
    },
    byOrderRef(orderRef) {
      return [...shipments.values()]
        .filter((row) => row.shipment.orderRef === orderRef)
        .map((row) => ({ ...row.shipment }));
    },
    save(shipment, key) {
      shipments.set(shipment.id, { key, shipment: { ...shipment } });
    },
  };
}

/** In-process Store with the same contract as SqliteStore. For tests and local experiments. */
export class MemoryStore implements Store {
  private readonly accounts = new Map<string, AccountData>();
  private seq = 0;

  async createAccount(input: CreateAccountInput): Promise<AccountRecord> {
    if (this.accounts.has(input.id)) throw new DuplicateAccountError("id");
    if (this.findAccount((r) => r.alias.toLowerCase() === input.alias.toLowerCase())) {
      throw new DuplicateAccountError("alias");
    }
    if (this.findAccount((r) => r.keyHash === input.keyHash)) throw new DuplicateAccountError("keyHash");

    const record: AccountRecord = {
      id: input.id,
      alias: input.alias,
      keyHash: input.keyHash,
      country: input.country,
      postalCode: input.postalCode,
      region: input.region,
      timezone: input.timezone,
      programs: {},
      createdAt: input.now,
      updatedAt: input.now,
    };
    this.accounts.set(record.id, {
      record,
      shipments: new Map(),
      log: [],
      emailCount: 0,
      lastEmailAt: null,
      feeds: new Map(),
      verifications: [],
    });
    return copyAccount(record);
  }

  async getAccountById(id: string): Promise<AccountRecord | null> {
    const data = this.accounts.get(id);
    return data ? copyAccount(data.record) : null;
  }

  async getAccountByKeyHash(keyHash: string): Promise<AccountRecord | null> {
    const record = this.findAccount((r) => r.keyHash === keyHash);
    return record ? copyAccount(record) : null;
  }

  async getAccountByAlias(alias: string): Promise<AccountRecord | null> {
    const wanted = alias.toLowerCase();
    const record = this.findAccount((r) => r.alias.toLowerCase() === wanted);
    return record ? copyAccount(record) : null;
  }

  async updateAccount(id: string, patch: AccountPatch, now: string): Promise<AccountRecord | null> {
    const data = this.accounts.get(id);
    if (!data) return null;
    if (patch.keyHash !== undefined && this.findAccount((r) => r.keyHash === patch.keyHash && r.id !== id)) {
      throw new DuplicateAccountError("keyHash");
    }
    const current = data.record;
    data.record = {
      ...current,
      country: patch.country ?? current.country,
      postalCode: patch.postalCode !== undefined ? patch.postalCode : current.postalCode,
      region: patch.region !== undefined ? patch.region : current.region,
      timezone: patch.timezone ?? current.timezone,
      programs: patch.programs ? patchPrograms(current.programs, patch.programs) : { ...current.programs },
      keyHash: patch.keyHash ?? current.keyHash,
      updatedAt: now,
    };
    return copyAccount(data.record);
  }

  async deleteAccount(id: string): Promise<void> {
    this.accounts.delete(id);
  }

  async applyUpdates(accountId: string, updates: ShipmentUpdate[], newId: () => string): Promise<StoredShipment[]> {
    const data = this.accounts.get(accountId);
    if (!data) return [];
    const working = new Map(data.shipments);
    const affected = applyShipmentUpdates(rowsOver(working), updates, newId);
    data.shipments = working;
    return affected;
  }

  async listShipments(accountId: string): Promise<StoredShipment[]> {
    const data = this.accounts.get(accountId);
    if (!data) return [];
    return [...data.shipments.values()].map((row) => ({ ...row.shipment })).sort(compareShipmentsNewestFirst);
  }

  async deleteShipment(accountId: string, shipmentId: string): Promise<boolean> {
    return this.accounts.get(accountId)?.shipments.delete(shipmentId) ?? false;
  }

  async setShipmentFlags(
    accountId: string,
    shipmentId: string,
    flags: { hidden?: boolean; userMarkedDelivered?: boolean },
  ): Promise<StoredShipment | null> {
    const row = this.accounts.get(accountId)?.shipments.get(shipmentId);
    if (!row) return null;
    row.shipment = {
      ...row.shipment,
      hidden: flags.hidden ?? row.shipment.hidden,
      userMarkedDelivered: flags.userMarkedDelivered ?? row.shipment.userMarkedDelivered,
    };
    return { ...row.shipment };
  }

  async recordEmail(accountId: string, entry: EmailLogEntry): Promise<void> {
    const data = this.accounts.get(accountId);
    if (!data) return;
    data.log.push({ seq: ++this.seq, ms: isoToSortMs(entry.receivedAt), value: { ...entry } });
    data.log.sort(newestFirst);
    data.log.length = Math.min(data.log.length, EMAIL_LOG_LIMIT);
    data.emailCount += 1;
    data.lastEmailAt = data.lastEmailAt === null ? entry.receivedAt : maxIso(data.lastEmailAt, entry.receivedAt);
    if (isSourceKind(entry.kind)) {
      const seen = data.feeds.get(entry.kind);
      data.feeds.set(entry.kind, seen === undefined ? entry.receivedAt : maxIso(seen, entry.receivedAt));
    }
  }

  async listEmailLog(accountId: string, limit: number = EMAIL_LOG_LIMIT): Promise<EmailLogEntry[]> {
    const log = this.accounts.get(accountId)?.log ?? [];
    return log.slice(0, Math.max(0, limit)).map((row) => ({ ...row.value }));
  }

  async getEmailStats(accountId: string): Promise<EmailStats> {
    const data = this.accounts.get(accountId);
    if (!data) return { count: 0, lastAt: null, feeds: [] };
    const feeds = [...data.feeds.entries()]
      .map(([source, lastSeenAt]) => ({ source, lastSeenAt }))
      .sort((a, b) => (a.source < b.source ? -1 : a.source > b.source ? 1 : 0));
    return { count: data.emailCount, lastAt: data.lastEmailAt, feeds };
  }

  async addVerification(accountId: string, v: ForwardingVerification): Promise<void> {
    const data = this.accounts.get(accountId);
    if (!data) return;
    data.verifications.push({ seq: ++this.seq, ms: isoToSortMs(v.receivedAt), value: { ...v } });
    data.verifications.sort(newestFirst);
    data.verifications.length = Math.min(data.verifications.length, VERIFICATION_LIMIT);
  }

  async listVerifications(accountId: string, sinceIso: string): Promise<ForwardingVerification[]> {
    const since = isoToMs(sinceIso);
    if (Number.isNaN(since)) throw new RangeError(`Invalid sinceIso: ${sinceIso}`);
    const list = this.accounts.get(accountId)?.verifications ?? [];
    return list.filter((row) => row.ms >= since).map((row) => ({ ...row.value }));
  }

  async exportAccount(accountId: string): Promise<AccountSnapshot | null> {
    const data = this.accounts.get(accountId);
    if (!data) return null;
    return {
      account: copyAccount(data.record),
      shipments: [...data.shipments.values()].map((row) => ({ ...row.shipment })).sort(compareShipmentsNewestFirst),
      emailLog: data.log.map((row) => ({ ...row.value })),
      verifications: data.verifications.map((row) => ({ ...row.value })),
    };
  }

  async purgeExpired(now: string): Promise<PurgeResult> {
    const cutoffs = retentionCutoffs(now);
    const result: PurgeResult = { shipments: 0, emailLog: 0, verifications: 0 };
    for (const data of this.accounts.values()) {
      for (const [id, row] of data.shipments) {
        if (!isShipmentExpired(row.shipment, cutoffs)) continue;
        data.shipments.delete(id);
        result.shipments += 1;
      }
      const log = data.log.filter((row) => row.ms >= cutoffs.emailLogMs);
      result.emailLog += data.log.length - log.length;
      data.log = log;
      const verifications = data.verifications.filter((row) => row.ms >= cutoffs.verificationMs);
      result.verifications += data.verifications.length - verifications.length;
      data.verifications = verifications;
    }
    return result;
  }

  close(): void {
    this.accounts.clear();
  }

  private findAccount(match: (record: AccountRecord) => boolean): AccountRecord | null {
    for (const data of this.accounts.values()) if (match(data.record)) return data.record;
    return null;
  }
}
