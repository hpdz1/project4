import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_TRACKING } from "@/lib/ingest";
import type { MemoryStore } from "@/lib/store";
import {
  TEST_INBOUND_DOMAIN,
  TEST_INBOUND_SECRET,
  apiRequest,
  createTestAccount,
  resetTestEnv,
  setupTestEnv,
} from "@/lib/server/test-helpers";
import type { ApiError } from "@/lib/types";
import { POST } from "./route";

let store: MemoryStore;

beforeEach(() => {
  store = setupTestEnv();
});
afterEach(() => resetTestEnv());

const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;

/** A Postmark inbound payload for a UPS alert Gmail auto-forwarded to `to`. */
function postmarkPayload(to: string) {
  return {
    FromName: "UPS",
    MessageStream: "inbound",
    From: "mcinfo@ups.com",
    FromFull: { Email: "mcinfo@ups.com", Name: "UPS", MailboxHash: "" },
    To: "sam.example@gmail.com",
    ToFull: [{ Email: "sam.example@gmail.com", Name: "", MailboxHash: "" }],
    Cc: "",
    CcFull: [],
    Bcc: "",
    BccFull: [],
    OriginalRecipient: to,
    Subject: "UPS Update: Package Scheduled for Delivery Today",
    MessageID: "73e6d360-66eb-11e1-8e72-a8206ea7d3ea",
    ReplyTo: "",
    MailboxHash: "",
    Date: new Date(Date.now() - 3_600_000).toUTCString(),
    TextBody: `Hi Sam,\nYour package is arriving today.\nTracking Number: ${SAMPLE_TRACKING.ups}\n`,
    HtmlBody: "",
    StrippedTextReply: "",
    Tag: "",
    Headers: [
      { Name: "X-Forwarded-To", Value: to },
      { Name: "X-Forwarded-For", Value: `sam.example@gmail.com ${to}` },
    ],
    Attachments: [],
  };
}

const deliver = (body: unknown, authorization: string | null = basic("postmark", TEST_INBOUND_SECRET), extra: Record<string, string> = {}) =>
  POST(
    apiRequest("/api/inbound/postmark", {
      method: "POST",
      body,
      origin: null,
      headers: { ...(authorization ? { authorization } : {}), ...extra },
    }),
  );

describe("POST /api/inbound/postmark", () => {
  it("stores a routable email (any username, password = INBOUND_SECRET)", async () => {
    const { record } = await createTestAccount(store);
    const res = await deliver(postmarkPayload(`${record.alias}@${TEST_INBOUND_DOMAIN}`), basic("anything", TEST_INBOUND_SECRET));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: "stored", kind: "ups", updates: 1 });
    const [shipment] = await store.listShipments(record.id);
    expect(shipment).toMatchObject({ carrier: "ups", trackingNumber: SAMPLE_TRACKING.ups });
    expect((await store.listEmailLog(record.id))[0]).toMatchObject({ kind: "ups", senderDomain: "ups.com", updates: 1 });
  });

  it("answers 200 for well-formed but unroutable mail", async () => {
    await createTestAccount(store);
    for (const to of [`r-zzzzzzzzzzzzzzzz@${TEST_INBOUND_DOMAIN}`, "someone@elsewhere.example"]) {
      const res = await deliver(postmarkPayload(to));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, status: "unroutable" });
    }
  });

  it("is 401 with a Basic challenge for a missing or wrong secret", async () => {
    const { record } = await createTestAccount(store);
    const payload = postmarkPayload(`${record.alias}@${TEST_INBOUND_DOMAIN}`);
    for (const auth of [null, basic("postmark", "wrong"), basic("postmark", ""), `Bearer ${TEST_INBOUND_SECRET}`, basic(TEST_INBOUND_SECRET, "x")]) {
      const res = await deliver(payload, auth);
      expect(res.status, String(auth)).toBe(401);
      expect(res.headers.get("www-authenticate")).toMatch(/^Basic realm=/);
      expect(((await res.json()) as ApiError).error.code).toBe("unauthorized");
    }
    expect(await store.listShipments(record.id)).toEqual([]);
  });

  it("is 503 inbound_disabled when INBOUND_SECRET is not set (never accepts an empty secret)", async () => {
    vi.stubEnv("INBOUND_SECRET", "");
    for (const auth of [null, basic("postmark", ""), basic("", "")]) {
      const res = await deliver(postmarkPayload("x@y.example"), auth);
      expect(res.status).toBe(503);
      expect(((await res.json()) as ApiError).error.code).toBe("inbound_disabled");
    }
  });

  it("rejects bad payloads: 400 for the wrong shape, 415 for non-JSON, 413 over 2 MB", async () => {
    const shape = await deliver({ Subject: "no sender" });
    expect(shape.status).toBe(400);
    expect(((await shape.json()) as ApiError).error.code).toBe("invalid_input");

    const notJson = await POST(
      apiRequest("/api/inbound/postmark", {
        method: "POST",
        rawBody: "From=x",
        contentType: "application/x-www-form-urlencoded",
        headers: { authorization: basic("p", TEST_INBOUND_SECRET) },
      }),
    );
    expect(notJson.status).toBe(415);

    const big = postmarkPayload("x@y.example");
    big.HtmlBody = "x".repeat(2 * 1024 * 1024 + 10);
    const tooBig = await deliver(big);
    expect(tooBig.status).toBe(413);
    expect(((await tooBig.json()) as ApiError).error.code).toBe("payload_too_large");
  });

  it("does not need a browser Origin (server-to-server)", async () => {
    const res = await deliver(postmarkPayload("x@y.example"), basic("p", TEST_INBOUND_SECRET), { origin: "https://postmarkapp.com" });
    expect(res.status).toBe(200);
  });
});
