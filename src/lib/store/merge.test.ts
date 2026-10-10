import { describe, expect, it } from "vitest";
import type { ShipmentStatus, ShipmentUpdate, StoredShipment } from "@/lib/types";
import { compareShipmentsNewestFirst, dedupeKey, mergeShipment } from "./merge";

const T1 = "2026-10-05T10:00:00.000Z";
const T2 = "2026-10-06T10:00:00.000Z";
const T3 = "2026-10-07T10:00:00.000Z";

function update(overrides: Partial<ShipmentUpdate> = {}): ShipmentUpdate {
  return {
    carrier: "ups",
    trackingNumber: "1Z999AA10123456784",
    orderRef: null,
    shipper: null,
    status: null,
    expectedDelivery: null,
    expectedWindow: null,
    deliveredAt: null,
    eventAt: T2,
    source: "ups",
    ...overrides,
  };
}

function stored(overrides: Partial<StoredShipment> = {}): StoredShipment {
  return {
    id: "s1",
    carrier: "ups",
    trackingNumber: "1Z999AA10123456784",
    orderRef: null,
    shipper: null,
    status: "in_transit",
    expectedDelivery: null,
    expectedWindow: null,
    deliveredAt: null,
    firstSeenAt: T2,
    lastEventAt: T2,
    source: "ups",
    hidden: false,
    userMarkedDelivered: false,
    ...overrides,
  };
}

/** Status after merging an update with `incoming` into a shipment at `current` (T2), from an email at `eventAt`. */
function statusAfter(current: ShipmentStatus, incoming: ShipmentStatus | null, eventAt: string): ShipmentStatus {
  const deliveredAt = current === "delivered" ? T2 : null;
  return mergeShipment(stored({ status: current, deliveredAt }), update({ status: incoming, eventAt }), "x").status;
}

describe("dedupeKey", () => {
  it("keys by tracking number regardless of carrier", () => {
    expect(dedupeKey({ carrier: "ups", trackingNumber: "1Z1", orderRef: "113-1" })).toBe("tn:1Z1");
    expect(dedupeKey({ carrier: "amazon", trackingNumber: "1Z1", orderRef: null })).toBe("tn:1Z1");
  });

  it("falls back to the order ref, whatever the carrier", () => {
    expect(dedupeKey({ carrier: "amazon", trackingNumber: null, orderRef: "113-1234567-1234567" })).toBe(
      "order:113-1234567-1234567",
    );
    // A FedEx email whose reference is the Amazon order number keys to the same order.
    expect(dedupeKey({ carrier: "fedex", trackingNumber: null, orderRef: "113-1234567-1234567" })).toBe(
      "order:113-1234567-1234567",
    );
  });

  it("returns null when there is nothing to key on", () => {
    expect(dedupeKey({ carrier: "usps", trackingNumber: null, orderRef: null })).toBeNull();
    expect(dedupeKey({ carrier: "usps", trackingNumber: "", orderRef: "" })).toBeNull();
  });
});

describe("mergeShipment: new shipment", () => {
  it("copies the update and starts with clear user flags", () => {
    const s = mergeShipment(
      null,
      update({
        shipper: "ACME OUTDOOR CO",
        status: "in_transit",
        expectedDelivery: "2026-10-09",
        expectedWindow: "2:15 PM - 6:15 PM",
        eventAt: T1,
      }),
      "new-id",
    );
    expect(s).toEqual({
      id: "new-id",
      carrier: "ups",
      trackingNumber: "1Z999AA10123456784",
      orderRef: null,
      shipper: "ACME OUTDOOR CO",
      status: "in_transit",
      expectedDelivery: "2026-10-09",
      expectedWindow: "2:15 PM - 6:15 PM",
      deliveredAt: null,
      firstSeenAt: T1,
      lastEventAt: T1,
      source: "ups",
      hidden: false,
      userMarkedDelivered: false,
    });
  });

  it("defaults the status to unknown", () => {
    expect(mergeShipment(null, update({ status: null }), "n").status).toBe("unknown");
  });

  it("sets deliveredAt from the update, else from the email time", () => {
    const at = "2026-10-06T14:15:00.000Z";
    expect(mergeShipment(null, update({ status: "delivered", deliveredAt: at }), "n").deliveredAt).toBe(at);
    expect(mergeShipment(null, update({ status: "delivered" }), "n").deliveredAt).toBe(T2);
  });

  it("ignores deliveredAt when the status is not delivered", () => {
    expect(mergeShipment(null, update({ status: "in_transit", deliveredAt: T2 }), "n").deliveredAt).toBeNull();
  });
});

describe("mergeShipment: status", () => {
  it("takes the status of a newer email (an equal time counts as newer)", () => {
    expect(statusAfter("in_transit", "out_for_delivery", T3)).toBe("out_for_delivery");
    expect(statusAfter("out_for_delivery", "exception", T3)).toBe("exception");
    expect(statusAfter("exception", "in_transit", T3)).toBe("in_transit");
    expect(statusAfter("in_transit", "available_for_pickup", T2)).toBe("available_for_pickup");
  });

  it("keeps the status when the email has none or says unknown", () => {
    expect(statusAfter("out_for_delivery", null, T3)).toBe("out_for_delivery");
    expect(statusAfter("out_for_delivery", "unknown", T3)).toBe("out_for_delivery");
  });

  it("keeps delivered sticky against newer emails, except exception and return to sender", () => {
    for (const later of ["pre_transit", "in_transit", "out_for_delivery", "available_for_pickup", "unknown"] as const) {
      expect(statusAfter("delivered", later, T3)).toBe("delivered");
    }
    expect(statusAfter("delivered", "exception", T3)).toBe("exception");
    expect(statusAfter("delivered", "return_to_sender", T3)).toBe("return_to_sender");
  });

  it("lets an older email only move the status forward", () => {
    expect(statusAfter("pre_transit", "in_transit", T1)).toBe("in_transit");
    expect(statusAfter("unknown", "pre_transit", T1)).toBe("pre_transit");
    expect(statusAfter("out_for_delivery", "delivered", T1)).toBe("delivered");
    expect(statusAfter("out_for_delivery", "in_transit", T1)).toBe("out_for_delivery");
    expect(statusAfter("delivered", "out_for_delivery", T1)).toBe("delivered");
  });

  it("never takes exception, return or pickup from an older email", () => {
    expect(statusAfter("in_transit", "exception", T1)).toBe("in_transit");
    expect(statusAfter("in_transit", "return_to_sender", T1)).toBe("in_transit");
    expect(statusAfter("in_transit", "available_for_pickup", T1)).toBe("in_transit");
  });

  it("does not let an older email override a side state", () => {
    expect(statusAfter("exception", "out_for_delivery", T1)).toBe("exception");
    expect(statusAfter("available_for_pickup", "delivered", T1)).toBe("available_for_pickup");
  });

  it("compares times as instants, not strings", () => {
    const existing = stored({ status: "in_transit", lastEventAt: "2026-10-06T10:00:00.000Z" });
    // Same instant without milliseconds: still newer-or-equal.
    expect(mergeShipment(existing, update({ status: "exception", eventAt: "2026-10-06T10:00:00Z" }), "x").status).toBe(
      "exception",
    );
    // 11:30+02:00 is 09:30Z: older, although it sorts later as a string.
    const older = mergeShipment(existing, update({ status: "exception", eventAt: "2026-10-06T11:30:00+02:00" }), "x");
    expect(older.status).toBe("in_transit");
    expect(older.lastEventAt).toBe("2026-10-06T10:00:00.000Z");
    expect(older.firstSeenAt).toBe("2026-10-06T11:30:00+02:00");
  });
});

describe("mergeShipment: deliveredAt", () => {
  it("sets deliveredAt when the status becomes delivered", () => {
    const at = "2026-10-07T13:02:00.000Z";
    const s = mergeShipment(stored(), update({ status: "delivered", deliveredAt: at, eventAt: T3 }), "x");
    expect(s).toMatchObject({ status: "delivered", deliveredAt: at });
    expect(mergeShipment(stored(), update({ status: "delivered", eventAt: T3 }), "x").deliveredAt).toBe(T3);
  });

  it("uses the older email's delivery time when an out-of-order email reports delivery", () => {
    const s = mergeShipment(stored({ status: "out_for_delivery" }), update({ status: "delivered", eventAt: T1 }), "x");
    expect(s).toMatchObject({ status: "delivered", deliveredAt: T1, lastEventAt: T2 });
  });

  it("keeps the first deliveredAt while the shipment stays delivered", () => {
    const existing = stored({ status: "delivered", deliveredAt: T2 });
    const again = mergeShipment(existing, update({ status: "delivered", deliveredAt: T3, eventAt: T3 }), "x");
    expect(again.deliveredAt).toBe(T2);
    expect(mergeShipment(existing, update({ status: "in_transit", eventAt: T3 }), "x").deliveredAt).toBe(T2);
  });

  it("clears deliveredAt when a newer email reports an exception after delivery", () => {
    const s = mergeShipment(stored({ status: "delivered", deliveredAt: T2 }), update({ status: "exception", eventAt: T3 }), "x");
    expect(s).toMatchObject({ status: "exception", deliveredAt: null });
  });

  it("backfills a missing deliveredAt on a delivered row", () => {
    const s = mergeShipment(stored({ status: "delivered", deliveredAt: null }), update({ status: "in_transit", eventAt: T3 }), "x");
    expect(s).toMatchObject({ status: "delivered", deliveredAt: T2 });
  });
});

describe("mergeShipment: other fields", () => {
  it("takes a newer email's expected date and window", () => {
    const existing = stored({ expectedDelivery: "2026-10-09", expectedWindow: "9 AM - 1 PM" });
    const s = mergeShipment(existing, update({ expectedDelivery: "2026-10-10", expectedWindow: "2 PM - 6 PM", eventAt: T3 }), "x");
    expect(s).toMatchObject({ expectedDelivery: "2026-10-10", expectedWindow: "2 PM - 6 PM" });
  });

  it("keeps the expected date when a newer email has none", () => {
    const existing = stored({ expectedDelivery: "2026-10-09", expectedWindow: "9 AM - 1 PM" });
    expect(mergeShipment(existing, update({ eventAt: T3 }), "x")).toMatchObject({
      expectedDelivery: "2026-10-09",
      expectedWindow: "9 AM - 1 PM",
    });
  });

  it("lets an older email fill a missing expected date but not replace one", () => {
    const filled = mergeShipment(stored(), update({ expectedDelivery: "2026-10-09", eventAt: T1 }), "x");
    expect(filled.expectedDelivery).toBe("2026-10-09");
    const kept = mergeShipment(stored({ expectedDelivery: "2026-10-10" }), update({ expectedDelivery: "2026-10-09", eventAt: T1 }), "x");
    expect(kept.expectedDelivery).toBe("2026-10-10");
  });

  it("fills tracking number, order ref and shipper only when missing", () => {
    const blank = stored({ trackingNumber: null, orderRef: "113-1", carrier: "amazon" });
    const filled = mergeShipment(
      blank,
      update({ carrier: "amazon", trackingNumber: "TBA123", orderRef: "113-2", shipper: "Amazon" }),
      "x",
    );
    expect(filled).toMatchObject({ trackingNumber: "TBA123", orderRef: "113-1", shipper: "Amazon" });

    const full = stored({ shipper: "ACME", orderRef: "A-1" });
    const kept = mergeShipment(full, update({ shipper: "Other", orderRef: "B-2", eventAt: T3 }), "x");
    expect(kept).toMatchObject({ shipper: "ACME", orderRef: "A-1", trackingNumber: full.trackingNumber });
  });

  it("never stores an item description, even if an update carries one", () => {
    const withDescription = { ...update({ status: "in_transit" }), description: "Prescription refill" };
    const created = mergeShipment(null, withDescription, "x");
    expect(created).not.toHaveProperty("description");
    expect(mergeShipment(created, { ...withDescription, eventAt: T3 }, "x")).not.toHaveProperty("description");
  });

  it("replaces an unknown carrier", () => {
    expect(mergeShipment(stored({ carrier: "unknown" }), update({ carrier: "fedex" }), "x").carrier).toBe("fedex");
  });

  it("upgrades amazon to the carrier that owns the same tracking number", () => {
    const amazon = stored({ carrier: "amazon", trackingNumber: "9400111899223197428490" });
    const usps = update({ carrier: "usps", trackingNumber: "9400111899223197428490", source: "usps_alert" });
    expect(mergeShipment(amazon, usps, "x").carrier).toBe("usps");
  });

  it("upgrades an amazon order row when the update brings the tracking number", () => {
    const order = stored({ carrier: "amazon", trackingNumber: null, orderRef: "113-1" });
    const shipped = update({ carrier: "ups", trackingNumber: "1Z999AA10123456784", orderRef: "113-1", source: "amazon" });
    expect(mergeShipment(order, shipped, "x")).toMatchObject({ carrier: "ups", trackingNumber: "1Z999AA10123456784" });
  });

  it("gives an amazon order row the carrier of a carrier email whose reference is the order number", () => {
    const order = stored({ carrier: "amazon", trackingNumber: null, orderRef: "113-1234567-1234567", source: "amazon" });
    const fedex = update({
      carrier: "fedex",
      trackingNumber: "794612345678",
      orderRef: "113-1234567-1234567",
      shipper: "Amazon.com",
      status: "in_transit",
      eventAt: T3,
      source: "fedex",
    });
    expect(mergeShipment(order, fedex, "x")).toMatchObject({
      id: "s1",
      carrier: "fedex",
      trackingNumber: "794612345678",
      orderRef: "113-1234567-1234567",
      status: "in_transit",
      source: "fedex",
    });
  });

  it("lets the carrier that owns the tracking number replace the guess on any order row", () => {
    const order = stored({ carrier: "dhl", trackingNumber: null, orderRef: "A-1" });
    expect(mergeShipment(order, update({ carrier: "dpd", trackingNumber: "01234567890123", orderRef: "A-1" }), "x").carrier).toBe(
      "dpd",
    );
    // An update without a carrier of its own changes nothing.
    expect(mergeShipment(order, update({ carrier: "unknown", trackingNumber: "X1", orderRef: "A-1" }), "x").carrier).toBe("dhl");
  });

  it("keeps the carrier otherwise", () => {
    const amazon = stored({ carrier: "amazon", trackingNumber: "TBA1" });
    expect(mergeShipment(amazon, update({ carrier: "unknown", trackingNumber: "TBA1" }), "x").carrier).toBe("amazon");
    expect(mergeShipment(amazon, update({ carrier: "ups", trackingNumber: "1Z2" }), "x").carrier).toBe("amazon");
    expect(mergeShipment(amazon, update({ carrier: "ups", trackingNumber: null }), "x").carrier).toBe("amazon");
    const ups = stored({ carrier: "ups" });
    expect(mergeShipment(ups, update({ carrier: "amazon" }), "x").carrier).toBe("ups");
    expect(mergeShipment(ups, update({ carrier: "fedex" }), "x").carrier).toBe("ups");
  });

  it("widens the time range and takes the source of the newest email", () => {
    const newer = mergeShipment(stored(), update({ eventAt: T3, source: "usps_digest" }), "x");
    expect(newer).toMatchObject({ firstSeenAt: T2, lastEventAt: T3, source: "usps_digest" });
    const older = mergeShipment(stored(), update({ eventAt: T1, source: "usps_digest" }), "x");
    expect(older).toMatchObject({ firstSeenAt: T1, lastEventAt: T2, source: "ups" });
  });

  it("keeps the id and the user's flags", () => {
    const existing = stored({ id: "keep-me", hidden: true, userMarkedDelivered: true });
    const s = mergeShipment(existing, update({ status: "out_for_delivery", eventAt: T3 }), "ignored-id");
    expect(s).toMatchObject({ id: "keep-me", hidden: true, userMarkedDelivered: true, status: "out_for_delivery" });
  });

  it("does not mutate its inputs", () => {
    const existing = stored();
    const u = update({ status: "delivered", eventAt: T3 });
    const before = JSON.stringify([existing, u]);
    mergeShipment(existing, u, "x");
    expect(JSON.stringify([existing, u])).toBe(before);
  });
});

describe("compareShipmentsNewestFirst", () => {
  it("orders by last event, then first seen, then id", () => {
    const a = stored({ id: "a", lastEventAt: T3, firstSeenAt: T1 });
    const b = stored({ id: "b", lastEventAt: T2, firstSeenAt: T2 });
    const c = stored({ id: "c", lastEventAt: T2, firstSeenAt: T1 });
    const d = stored({ id: "d", lastEventAt: T2, firstSeenAt: T1 });
    expect([d, c, b, a].sort(compareShipmentsNewestFirst).map((s) => s.id)).toEqual(["a", "b", "c", "d"]);
  });
});
