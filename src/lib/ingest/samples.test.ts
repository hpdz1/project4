import { describe, expect, it } from "vitest";
import { detectTrackingNumber } from "@/lib/tracking";
import type { ShipmentUpdate } from "@/lib/types";
import { addDays, localDateIn } from "./dates";
import { findInboundAlias } from "./forwarding";
import { parseEmail } from "./parse";
import { SAMPLE_AMAZON_ORDER, SAMPLE_TRACKING, SAMPLE_USER_EMAIL, sampleEmails } from "./samples";

const ALIAS = "r-k3j9x2m4q8w1";
const DOMAIN = "in.example.com";

type Expected = Omit<ShipmentUpdate, "eventAt">;

function expectedUpdates(today: string): Expected[][] {
  const base = { orderRef: null, description: null, expectedWindow: null, deliveredAt: null };
  return [
    [{ ...base, carrier: "usps", trackingNumber: SAMPLE_TRACKING.uspsDelivered, shipper: null, status: "delivered", expectedDelivery: null, source: "usps_alert", deliveredAt: "(email date)" }],
    [{ ...base, carrier: "ups", trackingNumber: SAMPLE_TRACKING.ups, shipper: "NORTHWIND HOME GOODS", status: "in_transit", expectedDelivery: addDays(today, 1), expectedWindow: "9:00 AM - 1:00 PM", source: "ups" }],
    [
      { ...base, carrier: "usps", trackingNumber: SAMPLE_TRACKING.uspsToday, shipper: "EXAMPLE OUTFITTERS CO", status: "in_transit", expectedDelivery: today, source: "usps_digest" },
      { ...base, carrier: "usps", trackingNumber: SAMPLE_TRACKING.uspsSoon, shipper: "ACME WIDGETS FULFILLMENT", status: "in_transit", expectedDelivery: addDays(today, 2), source: "usps_digest" },
    ],
    [{ ...base, carrier: "fedex", trackingNumber: SAMPLE_TRACKING.fedex, shipper: "Contoso Electronics", status: "in_transit", expectedDelivery: addDays(today, 3), expectedWindow: "by end of day", source: "fedex" }],
    [{ ...base, carrier: "amazon", trackingNumber: null, orderRef: SAMPLE_AMAZON_ORDER, shipper: "Amazon", description: "Trailblazer Insulated Water Bottle, 32 oz, Slate", status: "in_transit", expectedDelivery: addDays(today, 4), source: "amazon" }],
  ];
}

const CASES: [string, string, string | undefined][] = [
  ["mid-morning, Chicago", "2026-10-08T15:00:00Z", "America/Chicago"],
  ["just after local midnight", "2026-10-08T04:10:00Z", "America/New_York"],
  ["late evening, Los Angeles (UTC is already tomorrow)", "2026-10-09T05:30:00Z", "America/Los_Angeles"],
  ["year boundary, Tokyo", "2026-12-30T23:30:00Z", "Asia/Tokyo"],
  ["DST change day", "2026-11-01T18:00:00Z", "America/Denver"],
  ["default time zone", "2026-10-08T15:00:00Z", undefined],
];

describe.each(CASES)("sampleEmails (%s)", (_label, nowIso, timezone) => {
  const now = new Date(nowIso);
  const tz = timezone ?? "America/New_York";
  const today = localDateIn(now, tz);
  const samples = sampleEmails({ now, alias: ALIAS, inboundDomain: DOMAIN, timezone });

  it("round-trips through parseEmail to the expected updates", () => {
    const expected = expectedUpdates(today);
    expect(samples).toHaveLength(6);
    samples.slice(0, 5).forEach((email, i) => {
      const parsed = parseEmail(email, { timezone: tz });
      expect(parsed.verification).toBeNull();
      expect(parsed.note).toBeNull();
      const want = expected[i].map((u) => ({ ...u, deliveredAt: u.deliveredAt ? email.date : null, eventAt: email.date }));
      expect(parsed.updates, email.subject).toEqual(want);
      expect(parsed.kind).toBe(want[0].source);
    });
  });

  it("parses the same without a time zone (from the Date headers)", () => {
    for (const email of samples) {
      expect(parseEmail(email), email.subject).toEqual(parseEmail(email, { timezone: tz }));
    }
  });

  it("includes a Gmail forwarding confirmation", () => {
    const parsed = parseEmail(samples[5]);
    expect(parsed.kind).toBe("forwarding_verification");
    expect(parsed.verification).toMatchObject({ provider: "gmail", requestedBy: SAMPLE_USER_EMAIL, code: null });
    expect(parsed.verification?.link).toMatch(/^https:\/\/mail-settings\.google\.com\/mail\/vf-/);
  });

  it("uses only tracking numbers the tracking module detects, with valid check digits", () => {
    const numbers = samples.flatMap((s) => parseEmail(s).updates).filter((u) => u.trackingNumber);
    expect(numbers).toHaveLength(5);
    for (const u of numbers) {
      const detected = detectTrackingNumber(u.trackingNumber as string);
      expect(detected, u.trackingNumber as string).toMatchObject({ trackingNumber: u.trackingNumber, carrier: u.carrier, checksumValid: true });
    }
  });

  it("routes every sample to the alias", () => {
    for (const email of samples) {
      expect(email.recipients).toContain(`${ALIAS}@${DOMAIN}`);
      expect(findInboundAlias(email, DOMAIN)).toBe(ALIAS);
    }
  });

  it("dates every email relative to now: today (not in the future) except yesterday's delivery", () => {
    const days = samples.map((s) => localDateIn(new Date(s.date), tz));
    expect(days).toEqual([addDays(today, -1), today, today, today, today, today]);
    for (const s of samples) expect(new Date(s.date).getTime()).toBeLessThanOrEqual(now.getTime());
    const times = samples.map((s) => s.date);
    expect([...times].sort()).toEqual(times.slice(0, 1).concat(times.slice(1).sort()));
  });
});

describe("sampleEmails options", () => {
  it("falls back to the default zone for an unknown time zone", () => {
    const now = new Date("2026-10-08T15:00:00Z");
    expect(sampleEmails({ now, alias: ALIAS, inboundDomain: DOMAIN, timezone: "Mars/Olympus" })).toEqual(
      sampleEmails({ now, alias: ALIAS, inboundDomain: DOMAIN }),
    );
  });

  it("is deterministic", () => {
    const opts = { now: new Date("2026-10-08T15:00:00Z"), alias: ALIAS, inboundDomain: DOMAIN, timezone: "Europe/London" };
    expect(sampleEmails(opts)).toEqual(sampleEmails(opts));
  });
});
