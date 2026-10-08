import { describe, expect, it } from "vitest";
import type { DashboardShipment, ForwardingVerification } from "@/lib/types";
import {
  GROUP_ORDER,
  accountKeyFromInput,
  describeVerification,
  extraWindow,
  formatClockTime,
  formatRelativeTime,
  groupShipments,
  keyFromHash,
  plural,
  safeExternalUrl,
  shipmentStatusDisplay,
  shipmentTitle,
  signInLink,
  truncateMiddle,
  visibleFeeds,
} from "./format";

const NOW = "2026-10-08T18:00:00.000Z";

describe("formatRelativeTime", () => {
  it.each([
    ["2026-10-08T17:59:30.000Z", "just now"],
    ["2026-10-08T18:00:30.000Z", "just now"], // slightly in the future
    ["2026-10-08T17:59:00.000Z", "1 minute ago"],
    ["2026-10-08T17:15:00.000Z", "45 minutes ago"],
    ["2026-10-08T17:00:00.000Z", "1 hour ago"],
    ["2026-10-08T16:00:00.000Z", "2 hours ago"],
    ["2026-10-07T17:00:00.000Z", "yesterday"],
    ["2026-10-05T18:00:00.000Z", "3 days ago"],
    ["2026-08-01T12:00:00.000Z", "on Aug 1"],
    ["2025-12-30T12:00:00.000Z", "on Dec 30, 2025"],
  ])("%s -> %s", (iso, expected) => {
    expect(formatRelativeTime(iso, NOW, "UTC")).toBe(expected);
  });

  it("accepts Date and epoch values for now", () => {
    expect(formatRelativeTime("2026-10-08T16:00:00Z", new Date(NOW), "UTC")).toBe("2 hours ago");
    expect(formatRelativeTime("2026-10-08T16:00:00Z", Date.parse(NOW), "UTC")).toBe("2 hours ago");
  });

  it("returns null for bad input", () => {
    expect(formatRelativeTime("yesterday", NOW)).toBeNull();
    expect(formatRelativeTime(NOW, "nope")).toBeNull();
  });
});

describe("formatClockTime", () => {
  it("formats in the given zone with plain spaces", () => {
    expect(formatClockTime("2026-10-08T19:14:00Z", "America/Chicago")).toBe("2:14 PM");
    expect(formatClockTime("2026-10-08T09:05:00Z", "UTC")).toBe("9:05 AM");
    expect(formatClockTime("not a date")).toBeNull();
  });
});

describe("plural", () => {
  it("handles one and many", () => {
    expect(plural(1, "email")).toBe("1 email");
    expect(plural(0, "email")).toBe("0 emails");
    expect(plural(2, "package")).toBe("2 packages");
  });
});

describe("sign-in keys", () => {
  const key = "Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZmdoaWo";

  it("builds the link with the key in the fragment", () => {
    expect(signInLink("https://radar.example/", key)).toBe(`https://radar.example/signin#key=${key}`);
  });

  it("reads the key from a fragment", () => {
    expect(keyFromHash(`#key=${key}`)).toBe(key);
    expect(keyFromHash(`key=${key}`)).toBe(key);
    expect(keyFromHash(`#foo=1&key=${encodeURIComponent(key)}`)).toBe(key);
    expect(keyFromHash("#key=short")).toBeNull();
    expect(keyFromHash("#key=%E0%A4%A")).toBeNull();
    expect(keyFromHash("#other=1")).toBeNull();
    expect(keyFromHash("")).toBeNull();
  });

  it("accepts a pasted link, fragment or bare key", () => {
    expect(accountKeyFromInput(`  https://radar.example/signin#key=${key}\n`)).toBe(key);
    expect(accountKeyFromInput(`#key=${key}`)).toBe(key);
    expect(accountKeyFromInput(`key=${key}`)).toBe(key);
    expect(accountKeyFromInput(`"${key}"`)).toBe(key);
    expect(accountKeyFromInput(key)).toBe(key);
    expect(accountKeyFromInput("hello world")).toBeNull();
    expect(accountKeyFromInput("https://radar.example/signin")).toBeNull();
    expect(accountKeyFromInput("   ")).toBeNull();
  });
});

describe("truncateMiddle", () => {
  it("keeps short values and shortens long ones to the limit", () => {
    expect(truncateMiddle("1Z999AA10123456784")).toBe("1Z999AA10123456784");
    const long = "9400111899223197428497";
    const short = truncateMiddle(long, 16);
    expect(short).toHaveLength(16);
    expect(short).toBe("94001118…7428497");
    expect(truncateMiddle("ABCDEFGHIJ", 3)).toBe("A…J");
  });
});

function shipment(overrides: Partial<DashboardShipment>): DashboardShipment {
  return {
    id: "s1",
    carrier: "ups",
    trackingNumber: "1Z999AA10123456784",
    orderRef: null,
    shipper: null,
    description: null,
    status: "in_transit",
    expectedDelivery: null,
    expectedWindow: null,
    deliveredAt: null,
    firstSeenAt: NOW,
    lastEventAt: NOW,
    source: "ups",
    hidden: false,
    userMarkedDelivered: false,
    group: "on_the_way",
    trackingUrl: null,
    headline: "On the way",
    ...overrides,
  };
}

describe("groupShipments", () => {
  it("returns non-empty groups in display order, keeping server order", () => {
    const list = [
      shipment({ id: "a", group: "delivered_recently" }),
      shipment({ id: "b", group: "arriving_today" }),
      shipment({ id: "c", group: "on_the_way" }),
      shipment({ id: "d", group: "arriving_today" }),
    ];
    const groups = groupShipments(list);
    expect(groups.map((g) => g.group)).toEqual(["arriving_today", "on_the_way", "delivered_recently"]);
    expect(groups[0].shipments.map((s) => s.id)).toEqual(["b", "d"]);
    expect(groups[0].label).toBe("Arriving today");
    expect(GROUP_ORDER).toHaveLength(4);
  });
});

describe("shipment display", () => {
  it("titles by description, shipper or order", () => {
    expect(shipmentTitle(shipment({ shipper: "NORTHWIND HOME GOODS" }))).toBe("From NORTHWIND HOME GOODS");
    expect(shipmentTitle(shipment({ description: "Water bottle", shipper: "Amazon" }))).toBe(
      "Water bottle — from Amazon",
    );
    expect(shipmentTitle(shipment({ orderRef: "112-4589301-7765432" }))).toBe("Order 112-4589301-7765432");
    expect(shipmentTitle(shipment({ shipper: "  " }))).toBe("Package");
  });

  it("shows the window only when the headline doesn't", () => {
    expect(extraWindow(shipment({ expectedWindow: "9:00 AM - 1:00 PM", headline: "Expected tomorrow" }))).toBe(
      "9:00 AM - 1:00 PM",
    );
    expect(
      extraWindow(shipment({ expectedWindow: "9:00 AM - 1:00 PM", headline: "Arriving today · 9:00 AM - 1:00 PM" })),
    ).toBeNull();
    expect(extraWindow(shipment({}))).toBeNull();
  });

  it("labels statuses, including the user's Got it", () => {
    expect(shipmentStatusDisplay(shipment({ status: "exception" }))).toEqual({ label: "Exception", tone: "danger" });
    expect(shipmentStatusDisplay(shipment({ status: "in_transit", userMarkedDelivered: true })).label).toBe(
      "Marked received",
    );
  });
});

describe("forwarding confirmations", () => {
  const base: ForwardingVerification = {
    provider: "gmail",
    requestedBy: "me@gmail.com",
    code: null,
    link: null,
    receivedAt: NOW,
  };

  it("describes code, link and both", () => {
    expect(describeVerification({ ...base, code: "123456789", link: "https://mail.google.com/mail/vf-x" })).toBe(
      "Gmail sent a confirmation code: 123456789 — paste it in Gmail, or open the confirmation link.",
    );
    expect(describeVerification({ ...base, link: "https://mail.google.com/mail/vf-x" })).toMatch(
      /^Gmail sent a confirmation link\. Open it and confirm on Gmail's page/,
    );
    expect(describeVerification({ ...base, provider: "yahoo", code: "42" })).toMatch(/^Yahoo Mail sent a confirmation code: 42/);
    expect(describeVerification(base)).toMatch(/couldn't read a code or link/);
  });

  it("only allows https links", () => {
    expect(safeExternalUrl("https://mail-settings.google.com/mail/vf-%5Babc%5D")).toBe(
      "https://mail-settings.google.com/mail/vf-%5Babc%5D",
    );
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("http://mail.google.com/x")).toBeNull();
    expect(safeExternalUrl("not a url")).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
  });
});

describe("visibleFeeds", () => {
  const feeds = [
    { source: "usps_digest" as const, state: "never" as const },
    { source: "usps_alert" as const, state: "ok" as const },
    { source: "ups" as const, state: "never" as const },
  ];

  it("keeps everything in the US", () => {
    expect(visibleFeeds(feeds, "US")).toEqual(feeds);
  });

  it("hides never-seen USPS feeds elsewhere", () => {
    expect(visibleFeeds(feeds, "GB").map((f) => f.source)).toEqual(["usps_alert", "ups"]);
  });
});
