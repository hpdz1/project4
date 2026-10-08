import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getDashboard } from "@/app/api/dashboard/route";
import { POST as seedDemo } from "@/app/api/demo/seed/route";
import type { MemoryStore } from "@/lib/store";
import {
  TEST_INBOUND_DOMAIN,
  apiRequest,
  resetTestEnv,
  sessionCookie,
  sessionCookieLine,
  setupTestEnv,
} from "@/lib/server/test-helpers";
import type { AccountCreatedResponse, AccountResponse, ApiError, DashboardResponse } from "@/lib/types";
import { DELETE, GET, PATCH, POST } from "./route";

let store: MemoryStore;

beforeEach(() => {
  store = setupTestEnv();
});
afterEach(() => resetTestEnv());

async function signUp(body: unknown = { country: "US", postalCode: "94107", region: "CA", timezone: "America/Los_Angeles" }) {
  const res = await POST(apiRequest("/api/account", { method: "POST", body }));
  expect(res.status).toBe(201);
  const data = (await res.json()) as AccountCreatedResponse;
  return { res, data, key: data.accountKey };
}

async function errorOf(res: Response): Promise<ApiError["error"]> {
  return ((await res.json()) as ApiError).error;
}

describe("POST /api/account", () => {
  it("creates an account, sets the session cookie, and the dashboard works with it", async () => {
    const { res, data, key } = await signUp();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(data.demoMode).toBe(true);
    expect(data.account).toMatchObject({
      country: "US",
      postalCode: "94107",
      region: "CA",
      timezone: "America/Los_Angeles",
      programs: {},
    });
    expect(data.account.inboundAddress).toMatch(new RegExp(`^r-[a-z2-7]{16}@${TEST_INBOUND_DOMAIN.replace(/\./g, "\\.")}$`));
    expect(JSON.stringify(data)).not.toMatch(/keyHash|alias"/);

    expect(sessionCookie(res)).toBe(key);
    const line = sessionCookieLine(res) ?? "";
    expect(line).toContain("HttpOnly");
    expect(line.toLowerCase()).toContain("samesite=lax");

    const stored = await store.getAccountById(data.account.id);
    expect(stored?.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.keyHash).not.toBe(key);

    const me = await GET(apiRequest("/api/account", { session: key }));
    expect(me.status).toBe(200);
    expect(((await me.json()) as AccountResponse).account).toEqual(data.account);

    const dash = await getDashboard(apiRequest("/api/dashboard", { session: key }));
    expect(dash.status).toBe(200);
    expect(dash.headers.get("cache-control")).toBe("no-store");
    const dashboard = (await dash.json()) as DashboardResponse;
    expect(dashboard.account.id).toBe(data.account.id);
    expect(dashboard.answer.anythingComing).toBe(false);
  });

  it("normalizes country, postcode, region and time zone", async () => {
    const { data } = await signUp({ country: "uk", postalCode: " sw1a  1aa ", region: "", timezone: "europe/london" });
    expect(data.account).toMatchObject({ country: "GB", postalCode: "SW1A 1AA", region: null, timezone: "Europe/London" });
  });

  it("defaults a missing or unknown time zone to America/New_York", async () => {
    expect((await signUp({ country: "US" })).data.account.timezone).toBe("America/New_York");
    expect((await signUp({ country: "US", timezone: "Mars/Olympus_Mons" })).data.account.timezone).toBe("America/New_York");
    expect((await signUp({ country: "US", timezone: 42 })).data.account.timezone).toBe("America/New_York");
  });

  it("accepts the 'Other' country code ZZ", async () => {
    expect((await signUp({ country: "ZZ" })).data.account.country).toBe("ZZ");
  });

  it("rejects invalid input with 400 invalid_input", async () => {
    for (const body of [{}, { country: "USA" }, { country: 1 }, { country: "US", postalCode: "<script>" }, { country: "US", region: "California!" }, []]) {
      const res = await POST(apiRequest("/api/account", { method: "POST", body }));
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect((await errorOf(res)).code).toBe("invalid_input");
    }
    expect(await store.getAccountByKeyHash("x")).toBeNull();
  });

  it("rejects bad bodies: 415 for non-JSON, 400 for malformed JSON, 413 when too large", async () => {
    const form = await POST(apiRequest("/api/account", { method: "POST", rawBody: "country=US", contentType: "application/x-www-form-urlencoded" }));
    expect(form.status).toBe(415);
    expect((await errorOf(form)).code).toBe("unsupported_media_type");

    const broken = await POST(apiRequest("/api/account", { method: "POST", rawBody: '{"country":' }));
    expect(broken.status).toBe(400);
    expect((await errorOf(broken)).code).toBe("invalid_json");

    const huge = await POST(apiRequest("/api/account", { method: "POST", body: { country: "US", pad: "x".repeat(20_000) } }));
    expect(huge.status).toBe(413);
    expect((await errorOf(huge)).code).toBe("payload_too_large");
  });

  it("requires a same-origin Origin header (403)", async () => {
    for (const origin of [null, "https://evil.example", "http://radar.test.evil.example"]) {
      const res = await POST(apiRequest("/api/account", { method: "POST", body: { country: "US" }, origin }));
      expect(res.status).toBe(403);
      expect((await errorOf(res)).code).toBe("forbidden");
      expect(sessionCookie(res)).toBeNull();
    }
  });

  it("limits account creation to 10 per hour per client", async () => {
    for (let i = 0; i < 10; i++) await signUp({ country: "US" });
    const res = await POST(apiRequest("/api/account", { method: "POST", body: { country: "US" } }));
    expect(res.status).toBe(429);
    expect((await errorOf(res)).code).toBe("rate_limited");
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("keys the limit by X-Forwarded-For client behind a trusted proxy", async () => {
    vi.stubEnv("TRUST_PROXY", "1");
    const from = (ip: string) =>
      POST(apiRequest("/api/account", { method: "POST", body: { country: "US" }, headers: { "x-forwarded-for": ip } }));
    for (let i = 0; i < 10; i++) expect((await from("203.0.113.1")).status).toBe(201);
    expect((await from("203.0.113.1")).status).toBe(429);
    expect((await from("203.0.113.2")).status).toBe(201);
    // A client can't dodge the limit by prepending its own X-Forwarded-For value.
    expect((await from("198.51.100.77, 203.0.113.1")).status).toBe(429);
  });

  it("uses Secure cookies in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { res } = await signUp({ country: "US" });
    expect(sessionCookieLine(res)).toContain("Secure");
  });
});

describe("GET /api/account", () => {
  it("is 401 without a valid session", async () => {
    const none = await GET(apiRequest("/api/account"));
    expect(none.status).toBe(401);
    expect(none.headers.get("cache-control")).toBe("no-store");
    expect((await errorOf(none)).code).toBe("unauthorized");
    expect((await GET(apiRequest("/api/account", { session: "A".repeat(43) }))).status).toBe(401);
  });
});

describe("PATCH /api/account", () => {
  it("updates location, time zone and the program checklist", async () => {
    const { key } = await signUp();
    const res = await PATCH(
      apiRequest("/api/account", {
        method: "PATCH",
        session: key,
        body: { postalCode: "10001", region: "ny", timezone: "America/New_York", programs: { usps_informed_delivery: "done", ups_my_choice: "skipped" } },
      }),
    );
    expect(res.status).toBe(200);
    const { account } = (await res.json()) as AccountResponse;
    expect(account).toMatchObject({
      country: "US",
      postalCode: "10001",
      region: "NY",
      timezone: "America/New_York",
      programs: { usps_informed_delivery: "done", ups_my_choice: "skipped" },
    });

    const cleared = await PATCH(
      apiRequest("/api/account", { method: "PATCH", session: key, body: { programs: { ups_my_choice: null }, postalCode: null } }),
    );
    const after = ((await cleared.json()) as AccountResponse).account;
    expect(after.programs).toEqual({ usps_informed_delivery: "done" });
    expect(after.postalCode).toBeNull();
    expect(after.region).toBe("NY");
  });

  it("rejects unknown programs, states and time zones", async () => {
    const { key } = await signUp();
    for (const body of [{ programs: { not_a_program: "done" } }, { programs: { ups_my_choice: "maybe" } }, { timezone: "Nowhere/City" }, { country: "United States" }]) {
      const res = await PATCH(apiRequest("/api/account", { method: "PATCH", session: key, body }));
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect((await errorOf(res)).code).toBe("invalid_input");
    }
  });

  it("needs a session and a same-origin request", async () => {
    const { key } = await signUp();
    expect((await PATCH(apiRequest("/api/account", { method: "PATCH", body: { region: "NY" } }))).status).toBe(401);
    expect((await PATCH(apiRequest("/api/account", { method: "PATCH", session: key, origin: null, body: { region: "NY" } }))).status).toBe(403);
  });
});

describe("DELETE /api/account", () => {
  it("deletes the account and all its data, and clears the cookie", async () => {
    const { data, key } = await signUp();
    expect((await seedDemo(apiRequest("/api/demo/seed", { method: "POST", session: key }))).status).toBe(200);
    expect(await store.listShipments(data.account.id)).not.toHaveLength(0);

    const res = await DELETE(apiRequest("/api/account", { method: "DELETE", session: key }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sessionCookie(res)).toBe("");

    expect(await store.getAccountById(data.account.id)).toBeNull();
    expect(await store.listShipments(data.account.id)).toEqual([]);
    expect((await store.getEmailStats(data.account.id)).count).toBe(0);
    expect(await store.listVerifications(data.account.id, "2000-01-01T00:00:00Z")).toEqual([]);
    expect((await GET(apiRequest("/api/account", { session: key }))).status).toBe(401);
  });

  it("needs a session and a same-origin request", async () => {
    const { data, key } = await signUp();
    expect((await DELETE(apiRequest("/api/account", { method: "DELETE" }))).status).toBe(401);
    expect((await DELETE(apiRequest("/api/account", { method: "DELETE", session: key, origin: "https://evil.example" }))).status).toBe(403);
    expect(await store.getAccountById(data.account.id)).not.toBeNull();
  });
});
