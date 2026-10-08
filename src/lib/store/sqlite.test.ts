import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { MIGRATIONS } from "./sqlite-schema";
import { SqliteStore } from "./sqlite";
import { accountInput, describeStoreContract, shipmentUpdate } from "./store-contract";

const dir = mkdtempSync(join(tmpdir(), "package-radar-store-"));
let counter = 0;
const nextPath = () => join(dir, `db-${++counter}.sqlite`);

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Direct access to a database file, to inspect what SqliteStore wrote. */
interface RawDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...params: (string | number | null)[]): Record<string, unknown> | undefined;
    run(...params: (string | number | null)[]): unknown;
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
    raw.prepare("UPDATE accounts SET programs = ?").run('{"ups_my_choice":"done","usps_informed_delivery":"maybe"}');
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
