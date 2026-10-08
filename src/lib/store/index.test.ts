import { afterEach, describe, expect, it } from "vitest";
import { MemoryStore, SqliteStore, getStore, setStore, toAccountView, type AccountRecord } from "@/lib/store";

describe("toAccountView", () => {
  const record: AccountRecord = {
    id: "acc_1",
    alias: "r-k3j9x2m4q8w1",
    keyHash: "secret-hash",
    country: "US",
    postalCode: "60614",
    region: "IL",
    timezone: "America/Chicago",
    programs: { usps_informed_delivery: "done" },
    createdAt: "2026-10-08T12:00:00.000Z",
    updatedAt: "2026-10-09T12:00:00.000Z",
  };

  it("builds the inbound address and leaves out the key hash", () => {
    const view = toAccountView(record, "in.example.com");
    expect(view).toEqual({
      id: "acc_1",
      inboundAddress: "r-k3j9x2m4q8w1@in.example.com",
      country: "US",
      postalCode: "60614",
      region: "IL",
      timezone: "America/Chicago",
      programs: { usps_informed_delivery: "done" },
      createdAt: "2026-10-08T12:00:00.000Z",
    });
    expect(JSON.stringify(view)).not.toContain("secret-hash");
  });

  it("copies the programs map", () => {
    const view = toAccountView(record, "in.example.com");
    view.programs.ups_my_choice = "done";
    expect(record.programs).toEqual({ usps_informed_delivery: "done" });
  });
});

describe("getStore", () => {
  const originalPath = process.env.DATABASE_PATH;

  afterEach(() => {
    setStore(null);
    if (originalPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = originalPath;
  });

  it("opens one SqliteStore per process at DATABASE_PATH", async () => {
    process.env.DATABASE_PATH = ":memory:";
    const store = getStore();
    expect(store).toBeInstanceOf(SqliteStore);
    expect(getStore()).toBe(store);
    await store.createAccount({
      id: "acc_1",
      alias: "r-abc",
      keyHash: "h",
      country: "US",
      postalCode: null,
      region: null,
      timezone: "UTC",
      now: "2026-10-08T12:00:00.000Z",
    });
    expect((await getStore().getAccountById("acc_1"))?.alias).toBe("r-abc");
    store.close?.();
  });

  it("can be replaced, e.g. with a MemoryStore in tests", () => {
    const memory = new MemoryStore();
    setStore(memory);
    expect(getStore()).toBe(memory);
  });
});
