import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { MIGRATIONS, SCHEMA_VERSION_TABLE, type MigrationDatabase } from "./sqlite-schema";
import { RETENTION_SQL, SqliteStore } from "./sqlite";
import { accountInput, describeStoreContract, shipmentUpdate } from "./store-contract";

const dir = mkdtempSync(join(tmpdir(), "package-radar-store-"));
let counter = 0;
const nextPath = () => join(dir, `db-${++counter}.sqlite`);

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

type RawValue = null | number | bigint | string | Uint8Array;

/** Direct access to a database file, to inspect what SqliteStore wrote. */
interface RawDatabase extends MigrationDatabase {
  prepare(sql: string): {
    get(...params: RawValue[]): Record<string, RawValue> | undefined;
    run(...params: RawValue[]): unknown;
    all(...params: RawValue[]): Record<string, RawValue>[];
  };
  close(): void;
}

function openRaw(path: string): RawDatabase {
  const sqlite = process.getBuiltinModule("node:sqlite") as { DatabaseSync: new (path: string) => RawDatabase };
  return new sqlite.DatabaseSync(path);
}

describeStoreContract("SqliteStore", () => new SqliteStore(nextPath()));

describe("SqliteStore", () => {
  it("creates missing parent directories and persists across reopen", async () => {
    const path = join(dir, "nested", "deeper", "radar.db");
    const first = new SqliteStore(path);
    await first.createAccount(accountInput());
    await first.updateAccount("acc_1", { programs: { usps_informed_delivery: "done" } }, "2026-10-08T13:00:00.000Z");
    await first.applyUpdates("acc_1", [shipmentUpdate()], () => "shp_1");
    await first.recordEmail("acc_1", {
      receivedAt: "2026-10-08T13:00:00.000Z",
      kind: "ups",
      senderDomain: "ups.com",
      updates: 1,
      note: null,
    });
    first.close();
    expect(existsSync(path)).toBe(true);

    const second = new SqliteStore(path);
    expect((await second.getAccountByAlias("R-K3J9X2M4Q8W1"))?.programs).toEqual({ usps_informed_delivery: "done" });
    expect(await second.listShipments("acc_1")).toEqual([
      expect.objectContaining({ id: "shp_1", hidden: false, userMarkedDelivered: false }),
    ]);
    expect(await second.getEmailStats("acc_1")).toEqual({
      count: 1,
      lastAt: "2026-10-08T13:00:00.000Z",
      feeds: [{ source: "ups", lastSeenAt: "2026-10-08T13:00:00.000Z" }],
    });
    second.close();
  });

  it("records the schema version and reopens without migrating again", () => {
    const path = nextPath();
    new SqliteStore(path).close();
    new SqliteStore(path).close();
    const raw = openRaw(path);
    expect(raw.prepare("SELECT version FROM schema_version WHERE id = 1").get()).toEqual(
      expect.objectContaining({ version: MIGRATIONS.length }),
    );
    expect(raw.prepare("SELECT count(*) AS n FROM schema_version").get()).toEqual(expect.objectContaining({ n: 1 }));
    raw.close();
  });

  it("refuses a database written by a newer schema", () => {
    const path = nextPath();
    new SqliteStore(path).close();
    const raw = openRaw(path);
    raw.prepare("UPDATE schema_version SET version = ?").run(MIGRATIONS.length + 1);
    raw.close();
    expect(() => new SqliteStore(path)).toThrow(/newer than this build/);
  });

  it("uses WAL journaling", () => {
    const path = nextPath();
    const store = new SqliteStore(path);
    const raw = openRaw(path);
    expect(raw.prepare("PRAGMA journal_mode").get()).toEqual(expect.objectContaining({ journal_mode: "wal" }));
    raw.close();
    store.close();
  });

  it("shares data between two connections to the same file", async () => {
    const path = nextPath();
    const writer = new SqliteStore(path);
    const reader = new SqliteStore(path);
    await writer.createAccount(accountInput());
    await writer.applyUpdates("acc_1", [shipmentUpdate()], () => "shp_1");
    expect((await reader.listShipments("acc_1")).map((s) => s.id)).toEqual(["shp_1"]);
    writer.close();
    reader.close();
  });

  it("decodes unexpected stored values defensively", async () => {
    const path = nextPath();
    const store = new SqliteStore(path);
    await store.createAccount(accountInput());
    await store.applyUpdates("acc_1", [shipmentUpdate()], () => "shp_1");
    const raw = openRaw(path);
    raw
      .prepare("UPDATE accounts SET programs = ?")
      .run('{"ups_my_choice":"done","usps_informed_delivery":"maybe","Bad Key":"done","__proto__":"done"}');
    raw.prepare("UPDATE shipments SET status = 'teleported', carrier = 'owl', source = 'pigeon'").run();
    raw.close();
    expect((await store.getAccountById("acc_1"))?.programs).toEqual({ ups_my_choice: "done" });
    expect((await store.listShipments("acc_1"))[0]).toMatchObject({ status: "unknown", carrier: "unknown", source: "generic" });

    const raw2 = openRaw(path);
    raw2.prepare("UPDATE accounts SET programs = 'not json'").run();
    raw2.close();
    expect((await store.getAccountById("acc_1"))?.programs).toEqual({});
    store.close();
  });

  it("works in memory", async () => {
    const store = new SqliteStore(":memory:");
    await store.createAccount(accountInput());
    expect((await store.getAccountById("acc_1"))?.id).toBe("acc_1");
    store.close();
  });

  it("requires a path", () => {
    expect(() => new SqliteStore("  ")).toThrow(/needs a database path/);
  });
});

// ---------------------------------------------------------------------------
// Schema v2 migration (drops item descriptions, carrier-agnostic order keys, retention indexes)
// ---------------------------------------------------------------------------

const T1 = "2026-10-05T10:00:00.000Z";
const T2 = "2026-10-06T10:00:00.000Z";
const T3 = "2026-10-07T10:00:00.000Z";
const AMAZON_ORDER = "113-1111111-1111111";

interface V1Shipment {
  id: string;
  accountId: string;
  key: string;
  carrier: string;
  trackingNumber: string | null;
  orderRef: string | null;
  description: string | null;
  status: string;
  deliveredAt: string | null;
  firstSeenAt: string;
  lastEventAt: string;
  source: string;
}

/** Shipment rows as schema v1 stored them: with item descriptions and "order:<carrier>:<ref>" keys. */
const V1_SHIPMENTS: V1Shipment[] = [
  {
    id: "shp_order",
    accountId: "acc_1",
    key: `order:amazon:${AMAZON_ORDER}`,
    carrier: "amazon",
    trackingNumber: null,
    orderRef: AMAZON_ORDER,
    description: "Home pregnancy test",
    status: "pre_transit",
    deliveredAt: null,
    firstSeenAt: T1,
    lastEventAt: T1,
    source: "amazon",
  },
  {
    id: "shp_tn",
    accountId: "acc_1",
    key: "tn:1Z999AA10123456784",
    carrier: "ups",
    trackingNumber: "1Z999AA10123456784",
    orderRef: null,
    description: "Prescription refill",
    status: "delivered",
    deliveredAt: "2026-08-01T15:00:00+02:00",
    firstSeenAt: "2026-07-30T10:00:00Z",
    lastEventAt: "2026-08-01T15:00:00+02:00",
    source: "ups",
  },
  // Two tracking-less rows of one order under different carriers: only possible with v1 keys.
  {
    id: "shp_dup1",
    accountId: "acc_1",
    key: "order:amazon:A-1",
    carrier: "amazon",
    trackingNumber: null,
    orderRef: "A-1",
    description: "Duplicate one",
    status: "in_transit",
    deliveredAt: null,
    firstSeenAt: T1,
    lastEventAt: T1,
    source: "amazon",
  },
  {
    id: "shp_dup2",
    accountId: "acc_1",
    key: "order:unknown:A-1",
    carrier: "unknown",
    trackingNumber: null,
    orderRef: "A-1",
    description: "Duplicate two",
    status: "in_transit",
    deliveredAt: null,
    firstSeenAt: T2,
    lastEventAt: T2,
    source: "generic",
  },
  // The same order ref in another account is re-keyed independently.
  {
    id: "shp_other",
    accountId: "acc_2",
    key: `order:amazon:${AMAZON_ORDER}`,
    carrier: "amazon",
    trackingNumber: null,
    orderRef: AMAZON_ORDER,
    description: "Other account's item",
    status: "pre_transit",
    deliveredAt: null,
    firstSeenAt: T1,
    lastEventAt: T1,
    source: "amazon",
  },
];

/** Writes a schema-v1 database file (as the MVP left it) holding V1_SHIPMENTS. */
function createV1Database(path: string): void {
  const v1 = MIGRATIONS[0];
  if (typeof v1 !== "string") throw new Error("expected the v1 migration to be SQL");
  const raw = openRaw(path);
  raw.exec("PRAGMA journal_mode = WAL;");
  raw.exec(SCHEMA_VERSION_TABLE);
  raw.exec(v1);
  raw.prepare("INSERT INTO schema_version (id, version) VALUES (1, 1)").run();
  const insertAccount = raw.prepare(
    `INSERT INTO accounts (id, alias, key_hash, country, postal_code, region, timezone, programs, created_at, updated_at)
     VALUES (?, ?, ?, 'US', '60614', 'IL', 'America/Chicago', '{"usps_informed_delivery":"done"}', ?, ?)`,
  );
  insertAccount.run("acc_1", "r-k3j9x2m4q8w1", "hash-1", T1, T1);
  insertAccount.run("acc_2", "r-other", "hash-2", T1, T1);
  const insertShipment = raw.prepare(
    `INSERT INTO shipments (id, account_id, dedupe_key, carrier, tracking_number, order_ref, shipper, description, status,
       expected_delivery, expected_window, delivered_at, first_seen_at, last_event_at, source, hidden, user_marked_delivered)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, NULL, ?, ?, ?, ?, 0, 0)`,
  );
  for (const s of V1_SHIPMENTS) {
    insertShipment.run(
      s.id,
      s.accountId,
      s.key,
      s.carrier,
      s.trackingNumber,
      s.orderRef,
      s.description,
      s.status,
      s.deliveredAt,
      s.firstSeenAt,
      s.lastEventAt,
      s.source,
    );
  }
  raw.close();
}

function columnsOf(raw: RawDatabase, table: string): string[] {
  return raw.prepare("SELECT name FROM pragma_table_info(?)").all(table).map((row) => String(row.name));
}

/** What the v2 migration decides, per shipment row. */
function shipmentKeysAndTimes(raw: RawDatabase): Record<string, RawValue>[] {
  return raw.prepare("SELECT id, dedupe_key, last_event_ms, delivered_ms FROM shipments ORDER BY id").all();
}

function indexNames(raw: RawDatabase): string[] {
  return raw
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((row) => String(row.name));
}

describe("SqliteStore schema v2", () => {
  it("runs on a SQLite that supports ALTER TABLE ... DROP COLUMN (3.35+)", () => {
    const raw = openRaw(":memory:");
    const version = String(raw.prepare("SELECT sqlite_version() AS v").get()?.v);
    raw.close();
    const [major, minor] = version.split(".").map(Number);
    expect(major > 3 || (major === 3 && minor >= 35)).toBe(true);
  });

  it("gives a fresh database no description column", () => {
    const path = nextPath();
    new SqliteStore(path).close();
    const raw = openRaw(path);
    expect(columnsOf(raw, "shipments")).not.toContain("description");
    expect(columnsOf(raw, "shipments")).toEqual(expect.arrayContaining(["last_event_ms", "delivered_ms"]));
    raw.close();
  });

  it("migrates a v1 database: drops descriptions, re-keys order rows, backfills retention times", async () => {
    const path = nextPath();
    createV1Database(path);
    expect(readFileSync(path).toString("latin1")).toContain("Home pregnancy test");

    const store = new SqliteStore(path);
    const raw = openRaw(path);
    expect(raw.prepare("SELECT version FROM schema_version WHERE id = 1").get()?.version).toBe(MIGRATIONS.length);
    expect(columnsOf(raw, "shipments")).not.toContain("description");
    expect(shipmentKeysAndTimes(raw)).toEqual([
      { id: "shp_dup1", dedupe_key: "order:A-1", last_event_ms: Date.parse(T1), delivered_ms: null },
      // The newer duplicate keeps its v1 key (the new one is taken) and is still found by order ref.
      { id: "shp_dup2", dedupe_key: "order:unknown:A-1", last_event_ms: Date.parse(T2), delivered_ms: null },
      { id: "shp_order", dedupe_key: `order:${AMAZON_ORDER}`, last_event_ms: Date.parse(T1), delivered_ms: null },
      { id: "shp_other", dedupe_key: `order:${AMAZON_ORDER}`, last_event_ms: Date.parse(T1), delivered_ms: null },
      {
        id: "shp_tn",
        dedupe_key: "tn:1Z999AA10123456784",
        last_event_ms: Date.parse("2026-08-01T13:00:00Z"),
        delivered_ms: Date.parse("2026-08-01T13:00:00Z"),
      },
    ]);
    raw.close();

    // Everything else survives.
    expect((await store.getAccountById("acc_1"))?.programs).toEqual({ usps_informed_delivery: "done" });
    const listed = await store.listShipments("acc_1");
    expect(listed.map((s) => s.id).sort()).toEqual(["shp_dup1", "shp_dup2", "shp_order", "shp_tn"]);
    for (const s of listed) expect(s).not.toHaveProperty("description");
    expect(listed.find((s) => s.id === "shp_tn")).toMatchObject({
      carrier: "ups",
      status: "delivered",
      deliveredAt: "2026-08-01T15:00:00+02:00",
    });

    // The retention purge sees the backfilled times: delivered on Aug 1, gone by Oct 10.
    expect(await store.purgeExpired("2026-10-10T00:00:00.000Z")).toEqual({ shipments: 1, emailLog: 0, verifications: 0 });
    expect((await store.listShipments("acc_1")).map((s) => s.id).sort()).toEqual(["shp_dup1", "shp_dup2", "shp_order"]);

    // A FedEx email whose reference is the Amazon order number joins the migrated order row.
    const [joined] = await store.applyUpdates(
      "acc_1",
      [
        shipmentUpdate({
          carrier: "fedex",
          trackingNumber: "794612345678",
          orderRef: AMAZON_ORDER,
          status: "in_transit",
          eventAt: T2,
          source: "fedex",
        }),
      ],
      () => "new_1",
    );
    expect(joined).toMatchObject({ id: "shp_order", carrier: "fedex", trackingNumber: "794612345678", orderRef: AMAZON_ORDER });
    // The other account's row with the same order ref is untouched.
    expect(await store.listShipments("acc_2")).toEqual([
      expect.objectContaining({ id: "shp_other", carrier: "amazon", trackingNumber: null }),
    ]);

    // The duplicated order keeps working: the order key finds the older row, the order ref the newer one.
    const ids = ["new_2", "new_3", "new_4"];
    const nextId = () => ids.shift() ?? "unexpected";
    const order = { carrier: "amazon" as const, orderRef: "A-1", source: "amazon" as const };
    const [first] = await store.applyUpdates("acc_1", [shipmentUpdate({ ...order, trackingNumber: "TBA222", eventAt: T3 })], nextId);
    expect(first).toMatchObject({ id: "shp_dup1", trackingNumber: "TBA222" });
    const [second] = await store.applyUpdates("acc_1", [shipmentUpdate({ ...order, trackingNumber: "TBA333", eventAt: T3 })], nextId);
    expect(second).toMatchObject({ id: "shp_dup2", trackingNumber: "TBA333", carrier: "amazon" });
    const [orderOnly] = await store.applyUpdates("acc_1", [shipmentUpdate({ ...order, trackingNumber: null, eventAt: T3 })], nextId);
    expect(orderOnly.id).toBe("new_2");
    store.close();

    // The dropped descriptions are overwritten in the file, not just unlinked (secure_delete).
    const bytes = readFileSync(path).toString("latin1");
    for (const s of V1_SHIPMENTS) expect(bytes).not.toContain(s.description);
  });

  it("is idempotent: re-running the v2 migration, or reopening, changes nothing", () => {
    const path = nextPath();
    createV1Database(path);
    new SqliteStore(path).close();

    const raw = openRaw(path);
    const keysAndTimes = shipmentKeysAndTimes(raw);
    const indexes = indexNames(raw);
    expect(indexes).toEqual(
      expect.arrayContaining(["email_log_received", "shipments_delivered", "shipments_last_event", "verifications_received"]),
    );

    const v2 = MIGRATIONS[1];
    if (typeof v2 !== "function") throw new Error("expected the v2 migration to be a function");
    raw.exec("BEGIN IMMEDIATE");
    v2(raw);
    raw.exec("COMMIT");
    expect(shipmentKeysAndTimes(raw)).toEqual(keysAndTimes);
    expect(indexNames(raw)).toEqual(indexes);

    // As if another process had not recorded the version yet: the store migrates again cleanly.
    raw.prepare("UPDATE schema_version SET version = 1").run();
    raw.close();
    new SqliteStore(path).close();
    const after = openRaw(path);
    expect(after.prepare("SELECT version FROM schema_version WHERE id = 1").get()?.version).toBe(MIGRATIONS.length);
    expect(shipmentKeysAndTimes(after)).toEqual(keysAndTimes);
    expect(indexNames(after)).toEqual(indexes);
    after.close();
  });

  it("uses an index for every retention delete", () => {
    const path = nextPath();
    new SqliteStore(path).close();
    const raw = openRaw(path);
    const plan = (sql: string) =>
      raw
        .prepare(`EXPLAIN QUERY PLAN ${sql}`)
        .all(0)
        .map((row) => String(row.detail))
        .join("\n");
    expect(plan(RETENTION_SQL.staleShipments)).toMatch(/USING (COVERING )?INDEX shipments_last_event\b/);
    expect(plan(RETENTION_SQL.deliveredShipments)).toMatch(/USING (COVERING )?INDEX shipments_delivered\b/);
    expect(plan(RETENTION_SQL.emailLog)).toMatch(/USING (COVERING )?INDEX email_log_received\b/);
    expect(plan(RETENTION_SQL.verifications)).toMatch(/USING (COVERING )?INDEX verifications_received\b/);
    raw.close();
  });

  it("overwrites deleted and purged shipments in the file", async () => {
    const path = nextPath();
    const store = new SqliteStore(path);
    await store.createAccount(accountInput());
    await store.applyUpdates(
      "acc_1",
      [
        shipmentUpdate({ trackingNumber: "KEEP1", shipper: "SHIPPER-KEPT-QX" }),
        shipmentUpdate({ trackingNumber: "DEL1", shipper: "SHIPPER-DELETED-QX" }),
        shipmentUpdate({ trackingNumber: "OLD1", shipper: "SHIPPER-PURGED-QX", eventAt: "2026-01-01T00:00:00.000Z" }),
      ],
      (() => {
        let n = 0;
        return () => `shp_${++n}`;
      })(),
    );
    expect(await store.deleteShipment("acc_1", "shp_2")).toBe(true);
    expect((await store.purgeExpired("2026-10-08T12:00:00.000Z")).shipments).toBe(1);
    store.close();
    const bytes = readFileSync(path).toString("latin1");
    expect(bytes).toContain("SHIPPER-KEPT-QX");
    expect(bytes).not.toContain("SHIPPER-DELETED-QX");
    expect(bytes).not.toContain("SHIPPER-PURGED-QX");
  });
});
