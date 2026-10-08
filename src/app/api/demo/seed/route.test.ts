import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getDashboard } from "@/app/api/dashboard/route";
import type { MemoryStore } from "@/lib/store";
import { apiRequest, createTestAccount, resetTestEnv, setupTestEnv } from "@/lib/server/test-helpers";
import type { ApiError, DashboardResponse } from "@/lib/types";
import { POST } from "./route";

let store: MemoryStore;

beforeEach(() => {
  store = setupTestEnv();
});
afterEach(() => resetTestEnv());

const seed = (session?: string, origin?: string | null) => POST(apiRequest("/api/demo/seed", { method: "POST", session, origin }));

describe("POST /api/demo/seed", () => {
  it("feeds the sample emails into the signed-in account", async () => {
    const { key, record } = await createTestAccount(store);
    const res = await seed(key);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ added: 6, updates: 6 });

    const dash = (await (await getDashboard(apiRequest("/api/dashboard", { session: key }))).json()) as DashboardResponse;
    expect(dash.demoMode).toBe(true);
    expect(dash.shipments).toHaveLength(6);
    expect(dash.verifications).toHaveLength(1);
    expect((await store.getEmailStats(record.id)).count).toBe(6);

    // Seeding again updates the same shipments instead of duplicating them.
    expect((await seed(key)).status).toBe(200);
    expect(await store.listShipments(record.id)).toHaveLength(6);
  });

  it("is 403 demo_disabled when DEMO_MODE=0", async () => {
    vi.stubEnv("DEMO_MODE", "0");
    const { key, record } = await createTestAccount(store);
    const res = await seed(key);
    expect(res.status).toBe(403);
    expect(((await res.json()) as ApiError).error.code).toBe("demo_disabled");
    expect(await store.listShipments(record.id)).toEqual([]);

    const dash = (await (await getDashboard(apiRequest("/api/dashboard", { session: key }))).json()) as DashboardResponse;
    expect(dash.demoMode).toBe(false);
  });

  it("is off by default in production", async () => {
    vi.stubEnv("DEMO_MODE", "");
    vi.stubEnv("NODE_ENV", "production");
    const { key } = await createTestAccount(store);
    expect((await seed(key)).status).toBe(403);
  });

  it("needs a session and a same-origin request", async () => {
    const { key } = await createTestAccount(store);
    expect((await seed()).status).toBe(401);
    expect((await seed(key, null)).status).toBe(403);
  });

  it("is limited to 20 seeds per hour per account", async () => {
    const { key } = await createTestAccount(store);
    for (let i = 0; i < 20; i++) expect((await seed(key)).status).toBe(200);
    const res = await seed(key);
    expect(res.status).toBe(429);
    expect(((await res.json()) as ApiError).error.code).toBe("rate_limited");
  });
});
