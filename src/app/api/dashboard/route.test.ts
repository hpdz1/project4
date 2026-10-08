import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MemoryStore } from "@/lib/store";
import { apiRequest, createTestAccount, resetTestEnv, setupTestEnv } from "@/lib/server/test-helpers";
import type { ApiError, DashboardResponse } from "@/lib/types";
import { GET } from "./route";

let store: MemoryStore;

beforeEach(() => {
  store = setupTestEnv();
});
afterEach(() => resetTestEnv());

describe("GET /api/dashboard", () => {
  it("is 401 without a session, and never cached", async () => {
    const res = await GET(apiRequest("/api/dashboard"));
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(((await res.json()) as ApiError).error.code).toBe("unauthorized");
  });

  it("answers 'not connected yet' for a new account", async () => {
    const { key, record } = await createTestAccount(store);
    const res = await GET(apiRequest("/api/dashboard", { session: key }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const dash = (await res.json()) as DashboardResponse;
    expect(dash.account).toMatchObject({ id: record.id, inboundAddress: `${record.alias}@in.radar.test` });
    expect(dash.answer).toMatchObject({ anythingComing: false, arrivingToday: 0, onTheWay: 0 });
    expect(dash.shipments).toEqual([]);
    expect(dash.emailsReceived).toBe(0);
    expect(dash.lastEmailAt).toBeNull();
    expect(dash.demoMode).toBe(true);
    expect(Date.parse(dash.generatedAt)).not.toBeNaN();
    expect(dash.feeds.map((f) => f.source)).toEqual(["usps_digest", "ups", "fedex", "amazon"]);
  });

  it("only shows forwarding confirmations from the last 48 hours", async () => {
    const { key, record } = await createTestAccount(store);
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
    await store.addVerification(record.id, { provider: "gmail", requestedBy: null, code: "111", link: null, receivedAt: hoursAgo(72) });
    await store.addVerification(record.id, { provider: "gmail", requestedBy: null, code: "222", link: null, receivedAt: hoursAgo(1) });
    const dash = (await (await GET(apiRequest("/api/dashboard", { session: key }))).json()) as DashboardResponse;
    expect(dash.verifications.map((v) => v.code)).toEqual(["222"]);
  });
});
