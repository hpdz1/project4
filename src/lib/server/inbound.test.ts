import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SAMPLE_TRACKING, sampleEmails } from "@/lib/ingest";
import { MemoryStore } from "@/lib/store";
import type { InboundEmail } from "@/lib/types";
import { getServerConfig } from "./config";
import { hashKey } from "./crypto";
import { basicAuthPassword, bearerToken, handleInbound, senderDomain } from "./inbound";
import { resetRateLimits } from "./rate-limit";

const DOMAIN = "in.radar.test";
const ALIAS = "r-abcdefghijklmnop";
const config = getServerConfig({ INBOUND_DOMAIN: DOMAIN });
const NOW = new Date("2026-10-08T15:00:00Z");

async function storeWithAccount(): Promise<MemoryStore> {
  const store = new MemoryStore();
  await store.createAccount({
    id: "acct-1",
    alias: ALIAS,
    keyHash: hashKey("key"),
    country: "US",
    postalCode: "94107",
    region: "CA",
    timezone: "America/Los_Angeles",
    now: "2026-10-01T00:00:00.000Z",
  });
  return store;
}

function email(overrides: Partial<InboundEmail> = {}): InboundEmail {
  return {
    recipients: [`${ALIAS}@${DOMAIN}`],
    from: "mcinfo@ups.com",
    fromName: "UPS",
    subject: "UPS Update: Package Scheduled for Delivery Today",
    text: `Your package is on the way. Tracking Number: ${SAMPLE_TRACKING.ups}`,
    html: "",
    headers: {},
    date: "2026-10-08T14:00:00.000Z",
    ...overrides,
  };
}

describe("handleInbound", () => {
  beforeEach(() => resetRateLimits());
  afterEach(() => resetRateLimits());

  it("stores updates, verifications and a metadata-only log row", async () => {
    const store = await storeWithAccount();
    let n = 0;
    const samples = sampleEmails({ now: NOW, alias: ALIAS, inboundDomain: DOMAIN, timezone: "America/Los_Angeles" });
    const results = [];
    for (const e of samples) results.push(await handleInbound(e, NOW, { store, config, newId: () => `s${++n}` }));

    expect(results.map((r) => r.status)).toEqual(Array(6).fill("stored"));
    expect(results.map((r) => r.kind)).toEqual(["usps_alert", "ups", "usps_digest", "fedex", "amazon", "forwarding_verification"]);
    expect(results.map((r) => r.updates)).toEqual([1, 1, 2, 1, 1, 0]);

    const shipments = await store.listShipments("acct-1");
    expect(shipments).toHaveLength(6);
    expect(shipments.map((s) => s.trackingNumber)).toContain(SAMPLE_TRACKING.ups);

    const verifications = await store.listVerifications("acct-1", "2026-10-01T00:00:00Z");
    expect(verifications).toHaveLength(1);
    expect(verifications[0].provider).toBe("gmail");

    const log = await store.listEmailLog("acct-1");
    expect(log).toHaveLength(6);
    for (const row of log) {
      expect(Object.keys(row).sort()).toEqual(["kind", "note", "receivedAt", "senderDomain", "updates"]);
    }
    expect(log.map((r) => r.senderDomain)).toContain("ups.com");
    expect(JSON.stringify(log)).not.toContain("NORTHWIND");

    const stats = await store.getEmailStats("acct-1");
    expect(stats.count).toBe(6);
  });

  it("is unroutable without an alias on the inbound domain, or for an unknown alias", async () => {
    const store = await storeWithAccount();
    expect(await handleInbound(email({ recipients: ["someone@example.com"] }), NOW, { store, config })).toEqual({
      status: "unroutable",
    });
    expect(await handleInbound(email({ recipients: [`${ALIAS}@other.example`] }), NOW, { store, config })).toEqual({
      status: "unroutable",
    });
    expect(
      await handleInbound(email({ recipients: [`r-zzzzzzzzzzzzzzzz@${DOMAIN}`] }), NOW, { store, config }),
    ).toEqual({ status: "unroutable" });
    expect((await store.getEmailStats("acct-1")).count).toBe(0);
  });

  it("routes case-insensitively and through the alias as a +tag", async () => {
    const store = await storeWithAccount();
    const upper = await handleInbound(email({ recipients: [`${ALIAS.toUpperCase()}@IN.RADAR.TEST`] }), NOW, { store, config });
    expect(upper.status).toBe("stored");
    const tagged = await handleInbound(email({ recipients: [`in+${ALIAS}@${DOMAIN}`] }), NOW, { store, config });
    expect(tagged.status).toBe("stored");
  });

  it("drops mail beyond 300 per alias per day", async () => {
    const store = await storeWithAccount();
    const msg = email({ from: "friend@example.com", subject: "hi", text: "hello" });
    for (let i = 0; i < 300; i++) expect((await handleInbound(msg, NOW, { store, config })).status).toBe("stored");
    expect(await handleInbound(msg, NOW, { store, config })).toEqual({ status: "rate_limited" });
    expect((await store.getEmailStats("acct-1")).count).toBe(300);
    // Demo seeding opts out of the per-alias limit.
    expect((await handleInbound(msg, NOW, { store, config, rateLimit: false })).status).toBe("stored");
  });
});

describe("senderDomain", () => {
  it("returns the lowercase domain of an address", () => {
    expect(senderDomain("mcinfo@ups.com")).toBe("ups.com");
    expect(senderDomain("X@Email.InformedDelivery.USPS.com")).toBe("email.informeddelivery.usps.com");
    expect(senderDomain("")).toBeNull();
    expect(senderDomain("nobody")).toBeNull();
    expect(senderDomain("a@localhost")).toBeNull();
  });
});

describe("webhook credentials", () => {
  const req = (authorization?: string) =>
    new Request("http://localhost/", { headers: authorization ? { authorization } : {} });
  const basic = (s: string) => `Basic ${Buffer.from(s).toString("base64")}`;

  it("reads the Basic password (any username, colons allowed in the password)", () => {
    expect(basicAuthPassword(req(basic("postmark:s3cret")))).toBe("s3cret");
    expect(basicAuthPassword(req(basic(":s3cret")))).toBe("s3cret");
    expect(basicAuthPassword(req(basic("u:a:b")))).toBe("a:b");
    expect(basicAuthPassword(req(basic("no-colon")))).toBeNull();
    expect(basicAuthPassword(req("basic " + Buffer.from("u:p").toString("base64")))).toBe("p");
    expect(basicAuthPassword(req("Bearer s3cret"))).toBeNull();
    expect(basicAuthPassword(req("Basic !!!"))).toBeNull();
    expect(basicAuthPassword(req())).toBeNull();
  });

  it("reads the Bearer token", () => {
    expect(bearerToken(req("Bearer s3cret"))).toBe("s3cret");
    expect(bearerToken(req("bearer   s3cret  "))).toBe("s3cret");
    expect(bearerToken(req("Bearer"))).toBeNull();
    expect(bearerToken(req(basic("u:s3cret")))).toBeNull();
    expect(bearerToken(req())).toBeNull();
  });
});
