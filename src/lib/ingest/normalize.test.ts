import { describe, expect, it } from "vitest";
import { InboundPayloadError, MAX_BODY_CHARS, fromPostmark, fromRawJson } from "./normalize";

const RECEIVED = new Date("2026-10-08T18:00:00Z");

/** Shape of a real Postmark inbound webhook for a Gmail auto-forwarded UPS email (research/inbound-plumbing.md §1). */
function postmarkPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    FromName: "UPS",
    MessageStream: "inbound",
    From: "mcinfo@ups.com",
    FromFull: { Email: "MCInfo@UPS.com", Name: "UPS", MailboxHash: "" },
    To: "sam@gmail.com",
    ToFull: [{ Email: "Sam@Gmail.com", Name: "Sam", MailboxHash: "" }],
    Cc: "",
    CcFull: [],
    Bcc: "",
    BccFull: [],
    OriginalRecipient: "R-K3J9X2M4Q8W1@in.example.com",
    Subject: "UPS Update: Package Scheduled for Delivery Today",
    MessageID: "73e6d360-66eb-11e1-8e72-a8206ea7d3ea",
    ReplyTo: "",
    MailboxHash: "",
    Date: "Thu, 8 Oct 2026 06:12:44 -0400",
    TextBody: "Your package is arriving today.",
    HtmlBody: "<p>Your package is arriving today.</p>",
    StrippedTextReply: "",
    Tag: "",
    Headers: [
      { Name: "X-Spam-Status", Value: "No" },
      { Name: "X-Forwarded-To", Value: "r-k3j9x2m4q8w1@in.example.com" },
      { Name: "X-Forwarded-For", Value: "sam@gmail.com r-k3j9x2m4q8w1@in.example.com" },
      { Name: "Delivered-To", Value: "sam@gmail.com" },
      { Name: "Received", Value: "by 2002:a05 with SMTP id one" },
      { Name: "Received", Value: "by 2002:a06 with SMTP id two" },
    ],
    Attachments: [],
    ...overrides,
  };
}

describe("fromPostmark", () => {
  it("normalizes a Postmark inbound payload", () => {
    const email = fromPostmark(postmarkPayload(), RECEIVED);
    expect(email).toEqual({
      recipients: ["sam@gmail.com", "r-k3j9x2m4q8w1@in.example.com"],
      from: "mcinfo@ups.com",
      fromName: "UPS",
      subject: "UPS Update: Package Scheduled for Delivery Today",
      text: "Your package is arriving today.",
      html: "<p>Your package is arriving today.</p>",
      headers: {
        "x-spam-status": "No",
        "x-forwarded-to": "r-k3j9x2m4q8w1@in.example.com",
        "x-forwarded-for": "sam@gmail.com r-k3j9x2m4q8w1@in.example.com",
        "delivered-to": "sam@gmail.com",
        received: "by 2002:a05 with SMTP id one\nby 2002:a06 with SMTP id two",
        date: "Thu, 8 Oct 2026 06:12:44 -0400",
      },
      date: "2026-10-08T10:12:44.000Z",
    });
  });

  it("collects Cc, Bcc and the X-Original-To / To headers", () => {
    const email = fromPostmark(
      postmarkPayload({
        ToFull: [],
        To: "",
        CcFull: [{ Email: "cc@example.com", Name: "" }],
        BccFull: [{ Email: "bcc@example.com", Name: "" }],
        OriginalRecipient: "",
        Headers: [
          { Name: "X-Original-To", Value: "r-k3j9x2m4q8w1@in.example.com" },
          { Name: "To", Value: '"Doe, Jane" <jane@example.com>, cc@example.com' },
        ],
      }),
      RECEIVED,
    );
    expect(email.recipients).toEqual(["cc@example.com", "bcc@example.com", "r-k3j9x2m4q8w1@in.example.com", "jane@example.com"]);
  });

  it("falls back to receivedAt for a missing, unreadable or far-future Date", () => {
    expect(fromPostmark(postmarkPayload({ Date: undefined }), RECEIVED).date).toBe(RECEIVED.toISOString());
    expect(fromPostmark(postmarkPayload({ Date: "someday" }), RECEIVED).date).toBe(RECEIVED.toISOString());
    expect(fromPostmark(postmarkPayload({ Date: "Thu, 8 Oct 2099 06:12:44 -0400" }), RECEIVED).date).toBe(
      RECEIVED.toISOString(),
    );
  });

  it("uses From when FromFull is absent, and tolerates nulls and missing optional fields", () => {
    const email = fromPostmark(
      { From: "UPS <mcinfo@ups.com>", Subject: null, TextBody: null, HtmlBody: undefined, ToFull: null, Headers: null },
      RECEIVED,
    );
    expect(email).toMatchObject({ from: "mcinfo@ups.com", fromName: "UPS", subject: "", text: "", html: "", headers: {} });
  });

  it("caps bodies at 1,000,000 characters", () => {
    const big = "x".repeat(MAX_BODY_CHARS + 10);
    const email = fromPostmark(postmarkPayload({ TextBody: big, HtmlBody: big }), RECEIVED);
    expect(email.text).toHaveLength(MAX_BODY_CHARS);
    expect(email.html).toHaveLength(MAX_BODY_CHARS);
  });

  it("ignores prototype-polluting header names", () => {
    const email = fromPostmark(postmarkPayload({ Headers: [{ Name: "__proto__", Value: "x" }] }), RECEIVED);
    expect(Object.keys(email.headers)).toEqual(["date"]);
  });

  it.each([
    ["null", null],
    ["a string", "hello"],
    ["an array", [postmarkPayload()]],
    ["no sender at all", { Subject: "hi" }],
    ["TextBody not a string", postmarkPayload({ TextBody: 123 })],
    ["ToFull not a list", postmarkPayload({ ToFull: "sam@gmail.com" })],
    ["ToFull entry without Email", postmarkPayload({ ToFull: [{ Name: "x" }] })],
    ["Headers with the wrong shape", postmarkPayload({ Headers: [{ name: "a", value: "b" }] })],
    ["FromFull not an object", postmarkPayload({ FromFull: "mcinfo@ups.com" })],
  ])("rejects %s", (_label, payload) => {
    expect(() => fromPostmark(payload, RECEIVED)).toThrow(InboundPayloadError);
  });

  it("names the bad field in the error message", () => {
    expect(() => fromPostmark(postmarkPayload({ TextBody: 123 }), RECEIVED)).toThrow(/TextBody/);
  });
});

describe("fromRawJson", () => {
  it("normalizes the generic shape with header records", () => {
    const email = fromRawJson(
      {
        from: '"FedEx Delivery Manager" <TrackingUpdates@fedex.com>',
        to: "r-k3j9x2m4q8w1@in.example.com",
        subject: "FedEx Shipment 398765432103: Your package is on its way",
        text: "Hi, Sam.",
        headers: { "Delivered-To": "sam@gmail.com", "X-Forwarded-To": "r-k3j9x2m4q8w1@in.example.com" },
        date: "Thu, 08 Oct 2026 09:30:00 -0500",
      },
      RECEIVED,
    );
    expect(email).toEqual({
      recipients: ["r-k3j9x2m4q8w1@in.example.com", "sam@gmail.com"],
      from: "trackingupdates@fedex.com",
      fromName: "FedEx Delivery Manager",
      subject: "FedEx Shipment 398765432103: Your package is on its way",
      text: "Hi, Sam.",
      html: "",
      headers: {
        "delivered-to": "sam@gmail.com",
        "x-forwarded-to": "r-k3j9x2m4q8w1@in.example.com",
        date: "Thu, 08 Oct 2026 09:30:00 -0500",
      },
      date: "2026-10-08T14:30:00.000Z",
    });
  });

  it("accepts to/cc lists, {name,value} headers, a bare from and an ISO date", () => {
    const email = fromRawJson(
      {
        from: "auto-reply@usps.com",
        to: ["Sam <sam@gmail.com>", "r-k3j9x2m4q8w1@in.example.com"],
        cc: "Pat <pat@example.com>",
        headers: [
          { name: "Subject", value: "USPS® Item Delivered" },
          { name: "X-Original-To", value: "r-k3j9x2m4q8w1@in.example.com" },
        ],
        date: "2026-10-08T17:07:00Z",
      },
      RECEIVED,
    );
    expect(email).toMatchObject({
      recipients: ["sam@gmail.com", "r-k3j9x2m4q8w1@in.example.com", "pat@example.com"],
      from: "auto-reply@usps.com",
      fromName: null,
      subject: "USPS® Item Delivered",
      date: "2026-10-08T17:07:00.000Z",
    });
  });

  it("uses receivedAt when there is no date", () => {
    expect(fromRawJson({ from: "a@b.co", to: "c@d.co" }, RECEIVED).date).toBe(RECEIVED.toISOString());
  });

  it.each([
    ["undefined", undefined],
    ["a number", 42],
    ["missing from", { to: "r-k3j9x2m4q8w1@in.example.com" }],
    ["missing to", { from: "a@b.co" }],
    ["to as a number", { from: "a@b.co", to: 1 }],
    ["html not a string", { from: "a@b.co", to: "c@d.co", html: { x: 1 } }],
    ["header values not strings", { from: "a@b.co", to: "c@d.co", headers: { a: 1 } }],
  ])("rejects %s", (_label, payload) => {
    expect(() => fromRawJson(payload, RECEIVED)).toThrow(InboundPayloadError);
  });
});
