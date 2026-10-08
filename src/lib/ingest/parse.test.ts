import { describe, expect, it } from "vitest";
import type { InboundEmail } from "@/lib/types";
import { parseEmail } from "./parse";
import { makeEmail } from "./test-helpers";

describe("parseEmail", () => {
  it("never throws, even on malformed input", () => {
    const bad = [
      {} as InboundEmail,
      { ...makeEmail(), subject: null } as unknown as InboundEmail,
      { ...makeEmail(), headers: null } as unknown as InboundEmail,
      makeEmail({ date: "not a date", subject: "UPS Update: Package Scheduled for Delivery Tomorrow", from: "mcinfo@ups.com", text: "1Z999AA10123456784" }),
    ];
    for (const email of bad) {
      const parsed = parseEmail(email);
      expect(["ignored", "ups"]).toContain(parsed.kind);
      expect(Array.isArray(parsed.updates)).toBe(true);
    }
    expect(parseEmail({} as InboundEmail)).toMatchObject({ kind: "ignored", updates: [], verification: null });
    expect(parseEmail({} as InboundEmail).note).toMatch(/^parse error/);
  });

  it("handles a date it cannot read by dropping relative dates only", () => {
    const parsed = parseEmail(
      makeEmail({ date: "not a date", subject: "UPS Update: Package Scheduled for Delivery Tomorrow", from: "mcinfo@ups.com", text: "1Z999AA10123456784" }),
    );
    expect(parsed.updates).toMatchObject([{ trackingNumber: "1Z999AA10123456784", expectedDelivery: null }]);
  });

  // Regression guard: each of these used to take seconds to minutes (quadratic regex scans).
  it.each<[string, Partial<InboundEmail>]>([
    ["unclosed tags", { html: "<a ".repeat(100_000) }],
    ["unclosed scripts with JSON-LD bait", { html: "<script>".repeat(40_000) + "application/ld+json" }],
    ["unterminated comments and declarations", { html: "<!--".repeat(50_000) + "<!x ".repeat(50_000) }],
    ["deeply nested microdata", { html: '<div itemscope itemtype="ParcelDelivery"><span itemprop="trackingNumber">'.repeat(4_000) }],
    ["entity junk", { html: "&#".repeat(100_000) + "&amp".repeat(50_000) }],
    ["address-like junk", { text: "a".repeat(300_000), headers: { to: "b".repeat(20_000) } }],
    ["junk in a Gmail confirmation", { from: "forwarding-noreply@google.com", subject: "Gmail Forwarding Confirmation", text: "a".repeat(300_000) }],
    ["a huge whitespace run", { from: "mcinfo@ups.com", text: `1${" ".repeat(300_000)}x` }],
    ["digit runs", { from: "mcinfo@ups.com", text: "1 ".repeat(150_000) }],
    ["many forward markers", { from: "sam@gmail.com", text: "---------- Forwarded message ---------\nFrom: x\n".repeat(6_000) }],
    ["repeated shipper prose", { from: "trackingupdates@fedex.com", text: "your package from ".repeat(16_000) }],
  ])("stays fast on hostile input: %s", (_label, fields) => {
    const started = performance.now();
    const parsed = parseEmail(makeEmail({ subject: "x", ...fields }));
    expect(parsed.updates).toEqual([]);
    expect(performance.now() - started).toBeLessThan(4_000);
  });

  it("sets eventAt to the email date, source to the kind, and dedupes repeated numbers", () => {
    const parsed = parseEmail(
      makeEmail({
        from: "mcinfo@ups.com",
        date: "2026-10-08T10:00:00.000Z",
        subject: "UPS Update: Package Scheduled for Delivery Today",
        text: "Tracking Number: 1Z999AA10123456784\nhttps://www.ups.com/track?tracknum=1Z999AA10123456784",
        html: '<a href="https://www.ups.com/track?tracknum=1Z999AA10123456784">1Z999AA10123456784</a>',
      }),
    );
    expect(parsed.updates).toHaveLength(1);
    expect(parsed.updates[0]).toMatchObject({ eventAt: "2026-10-08T10:00:00.000Z", source: "ups" });
  });

  it("resolves 'tomorrow' in the account's time zone when given", () => {
    // 02:00 UTC on the 9th is still the evening of the 8th in Chicago.
    const email = makeEmail({
      from: "mcinfo@ups.com",
      date: "2026-10-09T02:00:00.000Z",
      headers: { date: "Fri, 09 Oct 2026 02:00:00 +0000" },
      subject: "UPS Update: Package Scheduled for Delivery Tomorrow",
      text: "1Z999AA10123456784",
    });
    expect(parseEmail(email, { timezone: "America/Chicago" }).updates[0].expectedDelivery).toBe("2026-10-09");
    expect(parseEmail(email).updates[0].expectedDelivery).toBe("2026-10-10");
    expect(parseEmail(email, { timezone: "Not/AZone" }).updates[0].expectedDelivery).toBe("2026-10-10");
  });

  it("uses the Date header's offset without a time zone", () => {
    const email = makeEmail({
      from: "mcinfo@ups.com",
      date: "2026-10-09T02:00:00.000Z",
      headers: { date: "Thu, 08 Oct 2026 22:00:00 -0400" },
      subject: "UPS Update: Package Scheduled for Delivery Tomorrow",
      text: "1Z999AA10123456784",
    });
    expect(parseEmail(email).updates[0].expectedDelivery).toBe("2026-10-09");
  });

  it("recovers a manually forwarded carrier email and counts relative dates from the original", () => {
    const parsed = parseEmail(
      makeEmail({
        from: "sam@gmail.com",
        fromName: "Sam",
        date: "2026-10-08T15:00:00.000Z",
        subject: "Fwd: UPS Update: Package Scheduled for Delivery Tomorrow",
        text: [
          "---------- Forwarded message ---------",
          "From: UPS <mcinfo@ups.com>",
          "Date: Mon, Oct 5, 2026 at 6:12 AM",
          "Subject: UPS Update: Package Scheduled for Delivery Tomorrow",
          "To: <sam@gmail.com>",
          "",
          "Your package is arriving tomorrow.",
          "From ACME WIDGETS FULFILLMENT",
          "Tracking Number: 1Z999AA10987654328",
        ].join("\n"),
      }),
    );
    expect(parsed.kind).toBe("ups");
    expect(parsed.note).toBe("manual forward");
    expect(parsed.updates).toMatchObject([
      { trackingNumber: "1Z999AA10987654328", shipper: "ACME WIDGETS FULFILLMENT", expectedDelivery: "2026-10-06" },
    ]);
  });

  it("classifies a manual forward by subject when the forwarded header is missing", () => {
    const parsed = parseEmail(
      makeEmail({
        from: "sam@gmail.com",
        subject: "Fwd: UPS Update: Package Scheduled for Delivery Today",
        text: "look\n\nTracking Number: 1Z999AA10123456784",
      }),
    );
    expect(parsed.kind).toBe("ups");
    expect(parsed.updates).toMatchObject([{ trackingNumber: "1Z999AA10123456784", status: "out_for_delivery" }]);
  });

  it("returns forwarding confirmations before anything else", () => {
    const parsed = parseEmail(
      makeEmail({
        from: "forwarding-noreply@google.com",
        subject: "(Gmail Forwarding Confirmation - Receive Mail from sam@gmail.com",
        text: "sam@gmail.com has requested to automatically forward mail to your email\nhttps://mail-settings.google.com/mail/vf-%5Babc%5D-def\nTracking 1Z999AA10123456784",
      }),
    );
    expect(parsed).toEqual({
      kind: "forwarding_verification",
      updates: [],
      verification: {
        provider: "gmail",
        requestedBy: "sam@gmail.com",
        code: null,
        link: "https://mail-settings.google.com/mail/vf-%5Babc%5D-def",
        receivedAt: "2026-10-08T14:00:00.000Z",
      },
      note: null,
    });
  });

  it("ignores personal mail", () => {
    expect(parseEmail(makeEmail({ from: "pat@example.com", subject: "Lunch?", text: "Noon at the usual place? Call me at 555-0100." }))).toEqual({
      kind: "ignored",
      updates: [],
      verification: null,
      note: "no tracking numbers found",
    });
  });
});
