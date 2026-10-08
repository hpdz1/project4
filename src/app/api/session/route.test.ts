import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MemoryStore } from "@/lib/store";
import { generateAccountKey } from "@/lib/server/crypto";
import { apiRequest, createTestAccount, resetTestEnv, sessionCookie, setupTestEnv } from "@/lib/server/test-helpers";
import type { AccountResponse, ApiError } from "@/lib/types";
import { DELETE, POST } from "./route";

let store: MemoryStore;

beforeEach(() => {
  store = setupTestEnv();
});
afterEach(() => resetTestEnv());

const signIn = (body: unknown, origin?: string | null) =>
  POST(apiRequest("/api/session", { method: "POST", body, origin }));

describe("POST /api/session", () => {
  it("signs in with a valid key and sets the cookie", async () => {
    const { key, record } = await createTestAccount(store);
    const res = await signIn({ accountKey: `  ${key}\n` });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const data = (await res.json()) as AccountResponse;
    expect(data.account.id).toBe(record.id);
    expect(data.account.inboundAddress).toBe(`${record.alias}@in.radar.test`);
    expect(data.demoMode).toBe(true);
    expect(sessionCookie(res)).toBe(key);
  });

  it("answers every failure the same way", async () => {
    await createTestAccount(store);
    const messages = new Set<string>();
    for (const accountKey of [generateAccountKey(), "short", "x".repeat(300), "not a key at all!", ""]) {
      const res = await signIn({ accountKey });
      expect(res.status, accountKey).toBe(401);
      expect(sessionCookie(res)).toBeNull();
      const { error } = (await res.json()) as ApiError;
      expect(error.code).toBe("unauthorized");
      messages.add(error.message);
    }
    expect(messages.size).toBe(1);
  });

  it("rejects malformed requests", async () => {
    expect((await signIn({})).status).toBe(400);
    expect((await signIn({ accountKey: 123 })).status).toBe(400);
    expect((await signIn({ key: "x" })).status).toBe(400);
    const form = await POST(apiRequest("/api/session", { method: "POST", rawBody: "accountKey=x", contentType: "text/plain" }));
    expect(form.status).toBe(415);
  });

  it("requires a same-origin request (no login CSRF)", async () => {
    const { key } = await createTestAccount(store);
    expect((await signIn({ accountKey: key }, null)).status).toBe(403);
    expect((await signIn({ accountKey: key }, "https://evil.example")).status).toBe(403);
  });

  it("limits sign-in attempts to 20 per hour per client, right or wrong", async () => {
    const { key } = await createTestAccount(store);
    for (let i = 0; i < 19; i++) expect((await signIn({ accountKey: generateAccountKey() })).status).toBe(401);
    expect((await signIn({ accountKey: key })).status).toBe(200);
    const limited = await signIn({ accountKey: key });
    expect(limited.status).toBe(429);
    expect(((await limited.json()) as ApiError).error.code).toBe("rate_limited");
    expect(limited.headers.get("retry-after")).toMatch(/^\d+$/);
  });
});

describe("DELETE /api/session", () => {
  it("clears the cookie (even without a session)", async () => {
    const { key } = await createTestAccount(store);
    const res = await DELETE(apiRequest("/api/session", { method: "DELETE", session: key }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sessionCookie(res)).toBe("");
    expect(await store.getAccountByKeyHash("nope")).toBeNull();

    const anonymous = await DELETE(apiRequest("/api/session", { method: "DELETE" }));
    expect(anonymous.status).toBe(200);
  });

  it("requires a same-origin request", async () => {
    expect((await DELETE(apiRequest("/api/session", { method: "DELETE", origin: "https://evil.example" }))).status).toBe(403);
  });
});
