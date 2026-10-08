import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getDashboard } from "@/app/api/dashboard/route";
import { SAMPLE_AMAZON_ORDER, SAMPLE_TRACKING, SAMPLE_USER_EMAIL, sampleEmails } from "@/lib/ingest";
import type { MemoryStore } from "@/lib/store";
import {
  TEST_INBOUND_DOMAIN,
  TEST_INBOUND_SECRET,
  apiRequest,
  createTestAccount,
  resetTestEnv,
  setupTestEnv,
  toRawJson,
} from "@/lib/server/test-helpers";
import type { ApiError, DashboardResponse } from "@/lib/types";
import { POST } from "./route";

let store: MemoryStore;

beforeEach(() => {
  store = setupTestEnv();
});
afterEach(() => resetTestEnv());

const deliver = (body: unknown, authorization: string | null = `Bearer ${TEST_INBOUND_SECRET}`) =>
  POST(
    apiRequest("/api/inbound/raw", {
      method: "POST",
      body,
      origin: null,
      headers: authorization ? { authorization } : {},
    }),
  );

describe("POST /api/inbound/raw", () => {
  it("ingests the sample emails end to end; the dashboard shows the shipments and the Gmail confirmation", async () => {
    const { key, record } = await createTestAccount(store, { timezone: "America/Chicago" });
    const emails = sampleEmails({ now: new Date(), alias: record.alias, inboundDomain: TEST_INBOUND_DOMAIN, timezone: "America/Chicago" });
    const results = [];
    for (const email of emails) {
      const res = await deliver(toRawJson(email));
      expect(res.status, email.subject).toBe(200);
      results.push((await res.json()) as { ok: boolean; status: string; kind: string });
    }
    expect(results.map((r) => r.status)).toEqual(Array(6).fill("stored"));
    expect(results.map((r) => r.kind)).toEqual(["usps_alert", "ups", "usps_digest", "fedex", "amazon", "forwarding_verification"]);

    const res = await getDashboard(apiRequest("/api/dashboard", { session: key }));
    expect(res.status).toBe(200);
    const dash = (await res.json()) as DashboardResponse;
    expect(dash.emailsReceived).toBe(6);
    expect(dash.shipments).toHaveLength(6);
    const byNumber = Object.fromEntries(dash.shipments.map((s) => [s.trackingNumber ?? s.orderRef, s]));
    expect(byNumber[SAMPLE_TRACKING.uspsToday].group).toBe("arriving_today");
    expect(byNumber[SAMPLE_TRACKING.ups].group).toBe("on_the_way");
    expect(byNumber[SAMPLE_TRACKING.ups].shipper).toBe("NORTHWIND HOME GOODS");
    expect(byNumber[SAMPLE_TRACKING.fedex].carrier).toBe("fedex");
    expect(byNumber[SAMPLE_TRACKING.uspsDelivered].group).toBe("delivered_recently");
    expect(byNumber[SAMPLE_AMAZON_ORDER].carrier).toBe("amazon");
    expect(dash.answer).toMatchObject({ anythingComing: true, arrivingToday: 1, onTheWay: 4, deliveredRecently: 1 });

    expect(dash.verifications).toHaveLength(1);
    expect(dash.verifications[0]).toMatchObject({ provider: "gmail", requestedBy: SAMPLE_USER_EMAIL });
    expect(dash.verifications[0].link).toMatch(/^https:\/\/mail-settings\.google\.com\/mail\/vf-/);

    const feeds = Object.fromEntries(dash.feeds.map((f) => [f.source, f.state]));
    expect(feeds).toMatchObject({ usps_digest: "ok", ups: "ok", fedex: "ok", amazon: "ok" });
  });

  it("answers 200 for unroutable mail", async () => {
    const res = await deliver({ from: "mcinfo@ups.com", to: "nobody@example.com", subject: "hi", text: "hello" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: "unroutable" });
  });

  it("requires the Bearer secret (401 with a challenge)", async () => {
    const body = { from: "a@b.example", to: "c@d.example" };
    const basic = `Basic ${Buffer.from(`x:${TEST_INBOUND_SECRET}`).toString("base64")}`;
    for (const auth of [null, "Bearer wrong", `Bearer ${TEST_INBOUND_SECRET}x`, basic, TEST_INBOUND_SECRET]) {
      const res = await deliver(body, auth);
      expect(res.status, String(auth)).toBe(401);
      expect(res.headers.get("www-authenticate")).toMatch(/^Bearer realm=/);
    }
  });

  it("rejects payloads of the wrong shape with 400 invalid_input", async () => {
    for (const body of [{ to: "x@y.example" }, { from: 1, to: "x@y.example" }, ["from"], "text"]) {
      const res = await deliver(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(((await res.json()) as ApiError).error.code).toBe("invalid_input");
    }
  });
});
