import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getAccount } from "@/app/api/account/route";
import { GET as getDashboard } from "@/app/api/dashboard/route";
import { POST as signIn } from "@/app/api/session/route";
import type { MemoryStore } from "@/lib/store";
import { apiRequest, createTestAccount, resetTestEnv, sessionCookie, setupTestEnv } from "@/lib/server/test-helpers";
import type { AccountCreatedResponse } from "@/lib/types";
import { POST } from "./route";

let store: MemoryStore;

beforeEach(() => {
  store = setupTestEnv();
});
afterEach(() => resetTestEnv());

describe("POST /api/account/key", () => {
  it("rotates the key: the old key stops working everywhere, the new one works", async () => {
    const { key: oldKey, record } = await createTestAccount(store);

    const res = await POST(apiRequest("/api/account/key", { method: "POST", session: oldKey }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const data = (await res.json()) as AccountCreatedResponse;
    expect(data.account.id).toBe(record.id);
    expect(data.accountKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(data.accountKey).not.toBe(oldKey);
    expect(data.demoMode).toBe(true);
    expect(sessionCookie(res)).toBe(data.accountKey);

    expect((await getAccount(apiRequest("/api/account", { session: oldKey }))).status).toBe(401);
    expect((await getDashboard(apiRequest("/api/dashboard", { session: oldKey }))).status).toBe(401);
    expect((await getAccount(apiRequest("/api/account", { session: data.accountKey }))).status).toBe(200);

    const oldSignIn = await signIn(apiRequest("/api/session", { method: "POST", body: { accountKey: oldKey } }));
    expect(oldSignIn.status).toBe(401);
    const newSignIn = await signIn(apiRequest("/api/session", { method: "POST", body: { accountKey: data.accountKey } }));
    expect(newSignIn.status).toBe(200);
  });

  it("needs a session and a same-origin request", async () => {
    const { key } = await createTestAccount(store);
    expect((await POST(apiRequest("/api/account/key", { method: "POST" }))).status).toBe(401);
    const crossSite = await POST(apiRequest("/api/account/key", { method: "POST", session: key, origin: "https://evil.example" }));
    expect(crossSite.status).toBe(403);
    expect((await getAccount(apiRequest("/api/account", { session: key }))).status).toBe(200);
  });
});
