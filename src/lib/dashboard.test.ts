import { describe, expect, it } from "vitest";
import { trackingUrl } from "@/lib/tracking";
import type {
  AccountView,
  DashboardGroup,
  ForwardingVerification,
  SourceKind,
  StoredShipment,
} from "@/lib/types";
import { buildDashboard, type BuildDashboardInput } from "./dashboard";

// Thu, Oct 8 2026, 6:00 PM in New York (EDT, UTC-4).
const NOW = new Date("2026-10-08T22:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const MINUTE = 60 * 1000;

/** ISO time `ms` before NOW. */
const before = (ms: number, now: Date = NOW): string => new Date(now.getTime() - ms).toISOString();

function account(overrides: Partial<AccountView> = {}): AccountView {
  return {
    id: "acct1",
    inboundAddress: "r-k3j9x2m4q8w1@in.example.com",
    country: "US",
    postalCode: "10001",
    region: "NY",
    timezone: "America/New_York",
    programs: {},
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function shipment(overrides: Partial<StoredShipment> = {}): StoredShipment {
  return {
    id: "s1",
    carrier: "ups",
    trackingNumber: "1Z999AA10123456784",
    orderRef: null,
    shipper: "ACME OUTDOOR CO",
    description: null,
    status: "in_transit",
    expectedDelivery: null,
    expectedWindow: null,
    deliveredAt: null,
    firstSeenAt: "2026-10-05T12:00:00.000Z",
    lastEventAt: "2026-10-08T12:00:00.000Z",
    source: "ups",
    hidden: false,
    userMarkedDelivered: false,
    ...overrides,
  };
}

function build(overrides: Partial<BuildDashboardInput> = {}) {
  return buildDashboard({
    account: account(),
    shipments: [],
    feeds: [],
    verifications: [],
    emailsReceived: 3,
    lastEmailAt: "2026-10-08T12:00:00.000Z",
    now: NOW,
    demoMode: false,
    ...overrides,
  });
}

/** Group + headline of a single shipment, or null when it is left off the dashboard. */
function placementOf(s: Partial<StoredShipment>, overrides: Partial<BuildDashboardInput> = {}) {
  const res = build({ shipments: [shipment(s)], ...overrides });
  if (res.shipments.length === 0) return null;
  const [{ group, headline }] = res.shipments;
  return { group, headline };
}

interface PlacementCase {
  name: string;
  s: Partial<StoredShipment>;
  /** null = omitted. */
  group: DashboardGroup | null;
  headline?: string;
}

const NO_UPDATE = "no update since. Check with the carrier.";

const PLACEMENT_CASES: PlacementCase[] = [
  // Hidden
  { name: "hidden in-transit", s: { hidden: true }, group: null },
  { name: "hidden delivered", s: { hidden: true, status: "delivered", deliveredAt: before(HOUR) }, group: null },
  { name: "hidden out for delivery", s: { hidden: true, status: "out_for_delivery" }, group: null },
  { name: "hidden exception", s: { hidden: true, status: "exception" }, group: null },

  // Delivered
  {
    name: "delivered today shows the local time",
    s: { status: "delivered", deliveredAt: "2026-10-08T18:14:00.000Z" },
    group: "delivered_recently",
    headline: "Delivered today at 2:14 PM",
  },
  {
    name: "delivered yesterday",
    s: { status: "delivered", deliveredAt: "2026-10-07T15:00:00.000Z" },
    group: "delivered_recently",
    headline: "Delivered yesterday",
  },
  {
    name: "delivered 3 local days ago (UTC date is Oct 6, local is Oct 5)",
    s: { status: "delivered", deliveredAt: "2026-10-06T00:30:00.000Z" },
    group: "delivered_recently",
    headline: "Delivered Mon, Oct 5",
  },
  {
    name: "delivered exactly 72h ago is still recent",
    s: { status: "delivered", deliveredAt: before(72 * HOUR) },
    group: "delivered_recently",
    headline: "Delivered Mon, Oct 5",
  },
  {
    name: "delivered 72h + 1 min ago is omitted",
    s: { status: "delivered", deliveredAt: before(72 * HOUR + MINUTE) },
    group: null,
  },
  {
    name: "delivered with a future time (clock skew) counts as today",
    s: { status: "delivered", deliveredAt: "2026-10-08T23:00:00.000Z" },
    group: "delivered_recently",
    headline: "Delivered today at 7:00 PM",
  },
  {
    name: "delivered without deliveredAt uses lastEventAt, without a clock time",
    s: { status: "delivered", deliveredAt: null, lastEventAt: "2026-10-08T12:00:00.000Z" },
    group: "delivered_recently",
    headline: "Delivered today",
  },
  {
    name: "delivered without deliveredAt, yesterday",
    s: { status: "delivered", deliveredAt: null, lastEventAt: "2026-10-07T12:00:00.000Z" },
    group: "delivered_recently",
    headline: "Delivered yesterday",
  },
  {
    name: "delivered without deliveredAt, lastEventAt older than 72h",
    s: { status: "delivered", deliveredAt: null, lastEventAt: before(4 * DAY) },
    group: null,
  },
  {
    name: "delivered with an unparseable deliveredAt falls back to lastEventAt",
    s: { status: "delivered", deliveredAt: "yesterday-ish", lastEventAt: "2026-10-08T12:00:00.000Z" },
    group: "delivered_recently",
    headline: "Delivered today",
  },
  {
    name: "delivered with unparseable times is omitted",
    s: { status: "delivered", deliveredAt: null, lastEventAt: "garbage" },
    group: null,
  },
  {
    name: "user marked delivered (carrier still says in transit)",
    s: { status: "in_transit", userMarkedDelivered: true, lastEventAt: before(DAY) },
    group: "delivered_recently",
    headline: "Marked as delivered",
  },
  {
    name: "user marked delivered beats exception",
    s: { status: "exception", userMarkedDelivered: true, lastEventAt: before(DAY) },
    group: "delivered_recently",
    headline: "Marked as delivered",
  },
  {
    name: "user marked delivered beats an expected date today",
    s: { status: "in_transit", userMarkedDelivered: true, expectedDelivery: "2026-10-08", lastEventAt: before(DAY) },
    group: "delivered_recently",
    headline: "Marked as delivered",
  },
  {
    name: "user marked delivered with an old last event is omitted",
    s: { status: "in_transit", userMarkedDelivered: true, lastEventAt: before(5 * DAY) },
    group: null,
  },

  // Side states
  {
    name: "exception",
    s: { status: "exception", lastEventAt: before(20 * DAY) },
    group: "needs_attention",
    headline: "Delivery exception — check the carrier",
  },
  {
    name: "exception exactly 21 days old",
    s: { status: "exception", lastEventAt: before(21 * DAY) },
    group: "needs_attention",
    headline: "Delivery exception — check the carrier",
  },
  { name: "exception 21 days + 1 min old", s: { status: "exception", lastEventAt: before(21 * DAY + MINUTE) }, group: null },
  {
    name: "return to sender",
    s: { status: "return_to_sender", lastEventAt: before(2 * DAY) },
    group: "needs_attention",
    headline: "Returning to sender",
  },
  {
    name: "return to sender, stale",
    s: { status: "return_to_sender", lastEventAt: before(30 * DAY) },
    group: null,
  },
  {
    name: "available for pickup",
    s: { status: "available_for_pickup", lastEventAt: before(HOUR) },
    group: "needs_attention",
    headline: "Ready for pickup",
  },
  {
    name: "available for pickup, expected date today does not matter",
    s: { status: "available_for_pickup", expectedDelivery: "2026-10-08", lastEventAt: before(HOUR) },
    group: "needs_attention",
    headline: "Ready for pickup",
  },
  {
    name: "available for pickup, stale",
    s: { status: "available_for_pickup", lastEventAt: before(30 * DAY) },
    group: null,
  },
  { name: "exception with unparseable lastEventAt", s: { status: "exception", lastEventAt: "nope" }, group: null },

  // Out for delivery
  {
    name: "out for delivery today",
    s: { status: "out_for_delivery", lastEventAt: "2026-10-08T12:00:00.000Z" },
    group: "arriving_today",
    headline: "Out for delivery",
  },
  {
    name: "out for delivery today with a window",
    s: { status: "out_for_delivery", lastEventAt: "2026-10-08T12:00:00.000Z", expectedWindow: "2:15 PM - 6:15 PM" },
    group: "arriving_today",
    headline: "Out for delivery · 2:15 PM - 6:15 PM",
  },
  {
    name: "out for delivery late last night local time (already Oct 8 in UTC)",
    s: { status: "out_for_delivery", lastEventAt: "2026-10-08T03:00:00.000Z" },
    group: "needs_attention",
    headline: "Was out for delivery on Wed, Oct 7 — no delivery confirmation yet",
  },
  {
    name: "out for delivery 7 days ago",
    s: { status: "out_for_delivery", lastEventAt: "2026-10-01T15:00:00.000Z" },
    group: "needs_attention",
    headline: "Was out for delivery on Thu, Oct 1 — no delivery confirmation yet",
  },
  {
    name: "out for delivery 8 days ago is omitted",
    s: { status: "out_for_delivery", lastEventAt: "2026-09-30T15:00:00.000Z" },
    group: null,
  },
  {
    name: "out for delivery with unparseable lastEventAt",
    s: { status: "out_for_delivery", lastEventAt: "soon" },
    group: null,
  },

  // Expected today
  {
    name: "in transit, expected today",
    s: { expectedDelivery: "2026-10-08" },
    group: "arriving_today",
    headline: "Arriving today",
  },
  {
    name: "expected today with a window",
    s: { expectedDelivery: "2026-10-08", expectedWindow: "2:15 PM - 6:15 PM" },
    group: "arriving_today",
    headline: "Arriving today · 2:15 PM - 6:15 PM",
  },
  {
    name: "expected today with a blank window",
    s: { expectedDelivery: "2026-10-08", expectedWindow: "   " },
    group: "arriving_today",
    headline: "Arriving today",
  },
  {
    name: "pre-transit, expected today",
    s: { status: "pre_transit", expectedDelivery: "2026-10-08" },
    group: "arriving_today",
    headline: "Arriving today",
  },
  {
    name: "unknown status, expected today",
    s: { status: "unknown", expectedDelivery: "2026-10-08" },
    group: "arriving_today",
    headline: "Arriving today",
  },
  {
    name: "expected today wins over a stale last event",
    s: { expectedDelivery: "2026-10-08", lastEventAt: before(30 * DAY) },
    group: "arriving_today",
    headline: "Arriving today",
  },
  {
    name: "expected today with an unparseable last event",
    s: { expectedDelivery: "2026-10-08", lastEventAt: "garbage" },
    group: "arriving_today",
    headline: "Arriving today",
  },

  // Overdue
  {
    name: "expected yesterday, no news since",
    s: { expectedDelivery: "2026-10-07", lastEventAt: "2026-10-06T15:00:00.000Z" },
    group: "needs_attention",
    headline: `Expected Wed, Oct 7 — ${NO_UPDATE}`,
  },
  {
    name: "expected yesterday, last news on the expected day",
    s: { expectedDelivery: "2026-10-07", lastEventAt: "2026-10-07T15:00:00.000Z" },
    group: "needs_attention",
    headline: `Expected Wed, Oct 7 — ${NO_UPDATE}`,
  },
  {
    name: "expected 2 days ago, news after that date",
    s: { expectedDelivery: "2026-10-06", lastEventAt: "2026-10-07T15:00:00.000Z" },
    group: "needs_attention",
    headline: "Expected Tue, Oct 6 — running late. Check with the carrier.",
  },
  {
    name: "pre-transit expected 3 days ago",
    s: { status: "pre_transit", expectedDelivery: "2026-10-05", lastEventAt: "2026-10-01T15:00:00.000Z" },
    group: "needs_attention",
    headline: `Expected Mon, Oct 5 — ${NO_UPDATE}`,
  },
  {
    name: "expected 7 days ago",
    s: { expectedDelivery: "2026-10-01", lastEventAt: "2026-09-29T15:00:00.000Z" },
    group: "needs_attention",
    headline: `Expected Thu, Oct 1 — ${NO_UPDATE}`,
  },
  {
    name: "expected 8 days ago is omitted",
    s: { expectedDelivery: "2026-09-30", lastEventAt: "2026-09-29T15:00:00.000Z" },
    group: null,
  },
  {
    name: "expected 8 days ago is omitted even with fresh news",
    s: { expectedDelivery: "2026-09-30", lastEventAt: before(HOUR) },
    group: null,
  },

  // On the way
  {
    name: "in transit, expected tomorrow",
    s: { expectedDelivery: "2026-10-09" },
    group: "on_the_way",
    headline: "Expected tomorrow",
  },
  {
    name: "in transit, expected next Tuesday",
    s: { expectedDelivery: "2026-10-13" },
    group: "on_the_way",
    headline: "Expected Tue, Oct 13",
  },
  {
    name: "unknown status, expected next Tuesday",
    s: { status: "unknown", expectedDelivery: "2026-10-13" },
    group: "on_the_way",
    headline: "Expected Tue, Oct 13",
  },
  { name: "in transit, no date", s: {}, group: "on_the_way", headline: "On the way" },
  { name: "unknown status, no date", s: { status: "unknown" }, group: "on_the_way", headline: "On the way" },
  {
    name: "pre-transit, no date",
    s: { status: "pre_transit" },
    group: "on_the_way",
    headline: "Label created — not shipped yet",
  },
  {
    name: "pre-transit, expected tomorrow",
    s: { status: "pre_transit", expectedDelivery: "2026-10-09" },
    group: "on_the_way",
    headline: "Label created — expected tomorrow",
  },
  {
    name: "pre-transit, expected next Tuesday",
    s: { status: "pre_transit", expectedDelivery: "2026-10-13" },
    group: "on_the_way",
    headline: "Label created — expected Tue, Oct 13",
  },
  {
    name: "a window is only shown for today",
    s: { expectedDelivery: "2026-10-09", expectedWindow: "9 AM - 1 PM" },
    group: "on_the_way",
    headline: "Expected tomorrow",
  },
  {
    name: "in transit, last event exactly 21 days ago",
    s: { lastEventAt: before(21 * DAY) },
    group: "on_the_way",
    headline: "On the way",
  },
  { name: "in transit, last event 21 days + 1 min ago", s: { lastEventAt: before(21 * DAY + MINUTE) }, group: null },
  { name: "pre-transit label from 30 days ago", s: { status: "pre_transit", lastEventAt: before(30 * DAY) }, group: null },
  {
    name: "future expected date does not rescue a stale shipment",
    s: { expectedDelivery: "2026-10-13", lastEventAt: before(30 * DAY) },
    group: null,
  },
  { name: "in transit with unparseable lastEventAt", s: { lastEventAt: "garbage" }, group: null },
  {
    name: "impossible expected date is ignored",
    s: { expectedDelivery: "2026-02-30" },
    group: "on_the_way",
    headline: "On the way",
  },
  {
    name: "non-ISO expected date is ignored",
    s: { expectedDelivery: "next week" },
    group: "on_the_way",
    headline: "On the way",
  },
];

describe("buildDashboard: grouping and headlines", () => {
  it.each(PLACEMENT_CASES)("$name", ({ s, group, headline }) => {
    const placement = placementOf(s);
    if (group === null) {
      expect(placement).toBeNull();
    } else {
      expect(placement).toEqual({ group, headline });
    }
  });
});

describe("buildDashboard: time zones", () => {
  // 03:30 UTC on Oct 9 is still 8:30 PM on Thu, Oct 8 in Los Angeles (PDT, UTC-7).
  const TZ_NOW = new Date("2026-10-09T03:30:00.000Z");
  const EARLIER = "2026-10-06T12:00:00.000Z";

  interface TzCase {
    name: string;
    timezone: string;
    s: Partial<StoredShipment>;
    group: DashboardGroup;
    headline: string;
  }

  const TZ_CASES: TzCase[] = [
    {
      name: "LA: expected Oct 8 is today",
      timezone: "America/Los_Angeles",
      s: { expectedDelivery: "2026-10-08", lastEventAt: EARLIER },
      group: "arriving_today",
      headline: "Arriving today",
    },
    {
      name: "UTC: expected Oct 8 was yesterday",
      timezone: "UTC",
      s: { expectedDelivery: "2026-10-08", lastEventAt: EARLIER },
      group: "needs_attention",
      headline: `Expected Thu, Oct 8 — ${NO_UPDATE}`,
    },
    {
      name: "LA: expected Oct 9 is tomorrow",
      timezone: "America/Los_Angeles",
      s: { expectedDelivery: "2026-10-09", lastEventAt: EARLIER },
      group: "on_the_way",
      headline: "Expected tomorrow",
    },
    {
      name: "UTC: expected Oct 9 is today",
      timezone: "UTC",
      s: { expectedDelivery: "2026-10-09", lastEventAt: EARLIER },
      group: "arriving_today",
      headline: "Arriving today",
    },
    {
      name: "LA: out for delivery this morning",
      timezone: "America/Los_Angeles",
      s: { status: "out_for_delivery", lastEventAt: "2026-10-08T16:00:00.000Z" },
      group: "arriving_today",
      headline: "Out for delivery",
    },
    {
      name: "UTC: the same out-for-delivery email was yesterday",
      timezone: "UTC",
      s: { status: "out_for_delivery", lastEventAt: "2026-10-08T16:00:00.000Z" },
      group: "needs_attention",
      headline: "Was out for delivery on Thu, Oct 8 — no delivery confirmation yet",
    },
    {
      name: "LA: delivered this afternoon",
      timezone: "America/Los_Angeles",
      s: { status: "delivered", deliveredAt: "2026-10-08T21:14:00.000Z" },
      group: "delivered_recently",
      headline: "Delivered today at 2:14 PM",
    },
    {
      name: "UTC: the same delivery was yesterday",
      timezone: "UTC",
      s: { status: "delivered", deliveredAt: "2026-10-08T21:14:00.000Z" },
      group: "delivered_recently",
      headline: "Delivered yesterday",
    },
    {
      name: "Tokyo: already Oct 9, morning delivery",
      timezone: "Asia/Tokyo",
      s: { status: "delivered", deliveredAt: "2026-10-09T01:05:00.000Z" },
      group: "delivered_recently",
      headline: "Delivered today at 10:05 AM",
    },
    {
      name: "invalid zone falls back to UTC",
      timezone: "Mars/Olympus_Mons",
      s: { expectedDelivery: "2026-10-09", lastEventAt: EARLIER },
      group: "arriving_today",
      headline: "Arriving today",
    },
    {
      name: "empty zone falls back to UTC",
      timezone: "",
      s: { status: "delivered", deliveredAt: "2026-10-08T21:14:00.000Z" },
      group: "delivered_recently",
      headline: "Delivered yesterday",
    },
  ];

  it.each(TZ_CASES)("$name", ({ timezone, s, group, headline }) => {
    expect(placementOf(s, { now: TZ_NOW, account: account({ timezone }) })).toEqual({ group, headline });
  });

  it("keeps the account's time zone string as given, even when invalid", () => {
    const res = build({ now: TZ_NOW, account: account({ timezone: "Mars/Olympus_Mons" }) });
    expect(res.account.timezone).toBe("Mars/Olympus_Mons");
  });
});

describe("buildDashboard: tracking links", () => {
  it("links to the carrier's tracking page when there is a tracking number", () => {
    const [s] = build({ shipments: [shipment()] }).shipments;
    expect(s.trackingUrl).toBe(trackingUrl("ups", "1Z999AA10123456784"));
    expect(s.trackingUrl).toContain("ups.com");
  });

  it("has no link for an order reference without a tracking number", () => {
    const [s] = build({
      shipments: [shipment({ carrier: "amazon", trackingNumber: null, orderRef: "113-1234567-1234567", source: "amazon" })],
    }).shipments;
    expect(s.trackingUrl).toBeNull();
  });

  it("has no link for an unknown carrier", () => {
    const [s] = build({ shipments: [shipment({ carrier: "unknown", trackingNumber: "ABC123", source: "generic" })] })
      .shipments;
    expect(s.trackingUrl).toBeNull();
  });

  it("keeps every stored field and does not mutate the input", () => {
    const input = shipment({ expectedDelivery: "2026-10-13" });
    const snapshot = structuredClone(input);
    const [s] = build({ shipments: [input] }).shipments;
    expect(input).toEqual(snapshot);
    expect(s).toEqual({
      ...snapshot,
      group: "on_the_way",
      trackingUrl: trackingUrl("ups", "1Z999AA10123456784"),
      headline: "Expected Tue, Oct 13",
    });
  });
});

describe("buildDashboard: sort order", () => {
  const shipments: StoredShipment[] = [
    // arriving today
    shipment({ id: "a1", expectedDelivery: "2026-10-08", lastEventAt: "2026-10-07T12:00:00.000Z" }),
    shipment({ id: "a2", status: "out_for_delivery", lastEventAt: "2026-10-08T13:00:00.000Z" }),
    shipment({ id: "a3", expectedDelivery: "2026-10-08", lastEventAt: "2026-10-08T10:00:00.000Z" }),
    // on the way
    shipment({ id: "w1", lastEventAt: "2026-10-08T15:00:00.000Z" }),
    shipment({ id: "w2", expectedDelivery: "2026-10-13", lastEventAt: "2026-10-06T12:00:00.000Z" }),
    shipment({ id: "w3", expectedDelivery: "2026-10-09", lastEventAt: "2026-10-05T12:00:00.000Z" }),
    shipment({ id: "w4", expectedDelivery: "2026-10-13", lastEventAt: "2026-10-07T12:00:00.000Z" }),
    shipment({ id: "w6", lastEventAt: "2026-10-04T12:00:00.000Z" }),
    shipment({ id: "w5", lastEventAt: "2026-10-04T12:00:00.000Z" }),
    // needs attention
    shipment({ id: "n1", status: "exception", lastEventAt: "2026-10-08T09:00:00.000Z" }),
    shipment({ id: "n2", status: "out_for_delivery", lastEventAt: "2026-10-07T12:00:00.000Z" }),
    shipment({ id: "n3", expectedDelivery: "2026-10-06", lastEventAt: "2026-10-05T12:00:00.000Z" }),
    // delivered recently
    shipment({ id: "d1", status: "delivered", deliveredAt: "2026-10-08T15:00:00.000Z" }),
    shipment({
      id: "d2",
      status: "delivered",
      deliveredAt: "2026-10-07T15:00:00.000Z",
      lastEventAt: "2026-10-08T20:00:00.000Z",
    }),
    shipment({ id: "d3", userMarkedDelivered: true, lastEventAt: "2026-10-08T17:00:00.000Z" }),
    // omitted
    shipment({ id: "x1", hidden: true }),
    shipment({ id: "x2", lastEventAt: before(40 * DAY) }),
  ];
  const expected = ["a2", "a3", "a1", "w3", "w4", "w2", "w1", "w5", "w6", "n1", "n2", "n3", "d3", "d1", "d2"];

  it.each([
    ["as given", shipments],
    ["reversed", [...shipments].reverse()],
    ["interleaved", shipments.filter((_, i) => i % 2 === 0).concat(shipments.filter((_, i) => i % 2 === 1))],
  ])("orders groups and shipments within groups (%s)", (_, input) => {
    const res = build({ shipments: input });
    expect(res.shipments.map((s) => s.id)).toEqual(expected);
    expect(res.answer).toMatchObject({ arrivingToday: 3, onTheWay: 6, needsAttention: 3, deliveredRecently: 3 });
  });
});

describe("buildDashboard: answer", () => {
  /** `n` shipments of one kind with distinct ids. */
  const many = (n: number, prefix: string, s: Partial<StoredShipment>): StoredShipment[] =>
    Array.from({ length: n }, (_, i) => shipment({ id: `${prefix}${i}`, ...s }));

  it.each([
    { today: 1, onTheWay: 0, emails: 3, headline: "Yes — 1 package is arriving today." },
    { today: 2, onTheWay: 0, emails: 3, headline: "Yes — 2 packages are arriving today." },
    { today: 1, onTheWay: 2, emails: 3, headline: "Yes — 3 packages are on the way, 1 arriving today." },
    { today: 2, onTheWay: 1, emails: 3, headline: "Yes — 3 packages are on the way, 2 arriving today." },
    { today: 1, onTheWay: 1, emails: 3, headline: "Yes — 2 packages are on the way, 1 arriving today." },
    { today: 0, onTheWay: 1, emails: 3, headline: "Yes — 1 package is on the way." },
    { today: 0, onTheWay: 2, emails: 3, headline: "Yes — 2 packages are on the way." },
    { today: 0, onTheWay: 0, emails: 0, headline: "Not connected yet — we haven't received any carrier emails." },
    { today: 0, onTheWay: 0, emails: 5, headline: "Nothing on the way right now." },
  ])("$today today + $onTheWay on the way, $emails emails -> $headline", ({ today, onTheWay, emails, headline }) => {
    const res = build({
      emailsReceived: emails,
      shipments: [
        ...many(today, "t", { expectedDelivery: "2026-10-08" }),
        ...many(onTheWay, "w", { expectedDelivery: "2026-10-12" }),
      ],
    });
    expect(res.answer).toEqual({
      anythingComing: today + onTheWay > 0,
      headline,
      arrivingToday: today,
      onTheWay,
      needsAttention: 0,
      deliveredRecently: 0,
    });
  });

  it("does not count needs-attention or delivered packages as coming", () => {
    const res = build({
      shipments: [
        shipment({ id: "n1", status: "exception" }),
        shipment({ id: "d1", status: "delivered", deliveredAt: before(HOUR) }),
        shipment({ id: "h1", hidden: true, expectedDelivery: "2026-10-08" }),
      ],
    });
    expect(res.answer).toEqual({
      anythingComing: false,
      headline: "Nothing on the way right now.",
      arrivingToday: 0,
      onTheWay: 0,
      needsAttention: 1,
      deliveredRecently: 1,
    });
  });

  it("says not connected for an empty new account", () => {
    const res = build({ emailsReceived: 0, lastEmailAt: null });
    expect(res.answer.headline).toBe("Not connected yet — we haven't received any carrier emails.");
    expect(res.shipments).toEqual([]);
  });
});

describe("buildDashboard: feeds", () => {
  const DIGEST_NEVER =
    "No Informed Delivery Daily Digest yet — turn on Daily Digest emails in Informed Delivery and make sure your filter forwards them here.";
  const quiet = (days: number) =>
    `No Informed Delivery Daily Digest in ${days} days — check that your forwarding filter is still on.`;

  it("always lists the digest, UPS, FedEx and Amazon", () => {
    expect(build().feeds).toEqual([
      { source: "usps_digest", lastSeenAt: null, state: "never", hint: DIGEST_NEVER },
      { source: "ups", lastSeenAt: null, state: "never", hint: "We'll hear from UPS when a package is headed your way." },
      {
        source: "fedex",
        lastSeenAt: null,
        state: "never",
        hint: "We'll hear from FedEx when a package is headed your way.",
      },
      {
        source: "amazon",
        lastSeenAt: null,
        state: "never",
        hint: "We'll hear from Amazon when a package is headed your way.",
      },
    ]);
  });

  it.each([
    { name: "3 days ago", lastSeenAt: before(3 * DAY), state: "ok", hint: null },
    { name: "exactly 4 days ago", lastSeenAt: before(4 * DAY), state: "ok", hint: null },
    { name: "in the future (clock skew)", lastSeenAt: before(-HOUR), state: "ok", hint: null },
    { name: "4 days + 1 min ago", lastSeenAt: before(4 * DAY + MINUTE), state: "quiet", hint: quiet(4) },
    { name: "6 local days ago", lastSeenAt: "2026-10-02T13:00:00.000Z", state: "quiet", hint: quiet(6) },
    { name: "a month ago", lastSeenAt: "2026-09-08T13:00:00.000Z", state: "quiet", hint: quiet(30) },
  ])("digest last seen $name -> $state", ({ lastSeenAt, state, hint }) => {
    const [digest] = build({ feeds: [{ source: "usps_digest", lastSeenAt }] }).feeds;
    expect(digest).toEqual({ source: "usps_digest", lastSeenAt, state, hint });
  });

  it("counts quiet days in the account's time zone", () => {
    const now = new Date("2026-10-09T03:30:00.000Z");
    const feeds = [{ source: "usps_digest" as const, lastSeenAt: "2026-10-04T14:00:00.000Z" }];
    const la = build({ now, feeds, account: account({ timezone: "America/Los_Angeles" }) }).feeds[0];
    const utc = build({ now, feeds, account: account({ timezone: "UTC" }) }).feeds[0];
    expect(la.hint).toBe(quiet(4));
    expect(utc.hint).toBe(quiet(5));
  });

  it("per-package feeds are ok once seen, however long ago", () => {
    const lastSeenAt = "2026-06-01T12:00:00.000Z";
    const ups = build({ feeds: [{ source: "ups", lastSeenAt }] }).feeds.find((f) => f.source === "ups");
    expect(ups).toEqual({ source: "ups", lastSeenAt, state: "ok", hint: null });
  });

  it("adds other feeds once seen, in a fixed order", () => {
    const seen = (source: SourceKind) => ({ source, lastSeenAt: before(DAY) });
    const feeds = build({
      feeds: [seen("generic"), seen("dhl"), seen("amazon"), seen("usps_alert"), seen("usps_digest")],
    }).feeds;
    expect(feeds.map((f) => [f.source, f.state])).toEqual([
      ["usps_digest", "ok"],
      ["usps_alert", "ok"],
      ["ups", "never"],
      ["fedex", "never"],
      ["amazon", "ok"],
      ["dhl", "ok"],
      ["generic", "ok"],
    ]);
    expect(feeds.filter((f) => f.state === "ok").every((f) => f.hint === null)).toBe(true);
  });

  it("keeps the newest of duplicate rows and ignores unparseable times", () => {
    const newer = before(HOUR);
    const feeds = build({
      feeds: [
        { source: "fedex", lastSeenAt: before(10 * DAY) },
        { source: "fedex", lastSeenAt: newer },
        { source: "fedex", lastSeenAt: "garbage" },
        { source: "usps_digest", lastSeenAt: "garbage" },
        { source: "dhl", lastSeenAt: "garbage" },
      ],
    }).feeds;
    expect(feeds.find((f) => f.source === "fedex")).toEqual({ source: "fedex", lastSeenAt: newer, state: "ok", hint: null });
    expect(feeds.find((f) => f.source === "usps_digest")?.state).toBe("never");
    expect(feeds.some((f) => f.source === "dhl")).toBe(false);
  });
});

describe("buildDashboard: verifications", () => {
  const v = (code: string, receivedAt: string): ForwardingVerification => ({
    provider: "gmail",
    requestedBy: "me@gmail.com",
    code,
    link: null,
    receivedAt,
  });

  it("keeps those received in the last 48h, newest first", () => {
    const res = build({
      verifications: [
        v("47h", before(47 * HOUR)),
        v("49h", before(49 * HOUR)),
        v("1h", before(HOUR)),
        v("bad", "not a date"),
        v("48h", before(48 * HOUR)),
      ],
    });
    expect(res.verifications.map((x) => x.code)).toEqual(["1h", "47h", "48h"]);
    expect(res.verifications[0]).toEqual(v("1h", before(HOUR)));
  });

  it("is empty when there are none", () => {
    expect(build().verifications).toEqual([]);
  });
});

describe("buildDashboard: passthrough", () => {
  it.each([true, false])("passes account, email stats and demoMode=%s through", (demoMode) => {
    const acct = account({ timezone: "America/Chicago" });
    const res = build({ account: acct, emailsReceived: 7, lastEmailAt: "2026-10-08T21:00:00.000Z", demoMode });
    expect(res.account).toEqual(acct);
    expect(res.emailsReceived).toBe(7);
    expect(res.lastEmailAt).toBe("2026-10-08T21:00:00.000Z");
    expect(res.generatedAt).toBe("2026-10-08T22:00:00.000Z");
    expect(res.demoMode).toBe(demoMode);
  });
});
