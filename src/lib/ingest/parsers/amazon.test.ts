import { describe, expect, it } from "vitest";
import { parseEmail } from "../parse";
import { makeEmail } from "../test-helpers";

// Tue, 06 Oct 2026 10:47:00 -0400 (Thursday is the 8th)
const DATE = { date: "2026-10-06T14:47:00.000Z", headers: { date: "Tue, 06 Oct 2026 10:47:00 -0400" } };
const SHIPMENT = { from: "shipment-tracking@amazon.com", fromName: "Amazon.com", ...DATE };

/** research/carrier-emails.md §9 (2025-26 layout, with the progress bar). */
const SHIPPED_TEXT = `    Your package was shipped!
Ordered
Shipped
Out for delivery
Delivered
Arriving Thursday
Testy - Springfield, ZZ
Order #
111-1111111-1111111
Track package
https://www.amazon.com/progress-tracker/package?_encoding=UTF8&orderId=111-1111111-1111111&packageIndex=0&shipmentId=Ab1Cd2Ef3&vt=NOTIFICATIONS
* Example Widget 2-Pack, Blue, Fake Brand
  Quantity: 1
  $19.99
Total $21.38`;

describe("Amazon", () => {
  it("parses a Shipped email: order number, item, arriving weekday; never the progress bar", () => {
    const parsed = parseEmail(makeEmail({ ...SHIPMENT, subject: 'Shipped: "Example Widget 2-Pack, Blue..."', text: SHIPPED_TEXT }));
    expect(parsed.kind).toBe("amazon");
    expect(parsed.updates).toEqual([
      {
        carrier: "amazon",
        trackingNumber: null,
        orderRef: "111-1111111-1111111",
        shipper: "Amazon",
        description: "Example Widget 2-Pack, Blue, Fake Brand",
        status: "in_transit",
        expectedDelivery: "2026-10-08",
        expectedWindow: null,
        deliveredAt: null,
        eventAt: DATE.date,
        source: "amazon",
      },
    ]);
  });

  it("parses the HTML version with the progress bar in one table row", () => {
    const html = `<html><body><h2>Your package was shipped!</h2>
<table><tr><td>Ordered</td><td>Shipped</td><td>Out for delivery</td><td>Delivered</td></tr></table>
<p><b>Arriving Friday</b></p><p>Order #<br>111-1111111-1111111</p>
<a href="https://www.amazon.com/gp/r.html?C=ABC&amp;U=https%3A%2F%2Fwww.amazon.com%2Fprogress-tracker%2Fpackage%3ForderId%3D111-1111111-1111111">Track package</a>
<table><tr><td>Example Lamp, Brass</td></tr><tr><td>Quantity: 2</td></tr></table></body></html>`;
    const parsed = parseEmail(makeEmail({ ...SHIPMENT, subject: "Shipped: “Example Lamp, Brass...”", html }));
    expect(parsed.updates).toMatchObject([
      { carrier: "amazon", orderRef: "111-1111111-1111111", description: "Example Lamp, Brass", status: "in_transit", expectedDelivery: "2026-10-09" },
    ]);
  });

  it("falls back to the quoted subject title (curly quotes, trailing ellipsis)", () => {
    const parsed = parseEmail(
      makeEmail({
        ...SHIPMENT,
        from: "shipment-tracking@amazon.ca",
        subject: "Shipped: “OLSA Giant Tumble Tower,...”",
        text: "Your package was shipped!\nArriving tomorrow\nOrder # 702-1234567-7654321",
      }),
    );
    expect(parsed.updates).toMatchObject([
      { orderRef: "702-1234567-7654321", description: "OLSA Giant Tumble Tower", expectedDelivery: "2026-10-07" },
    ]);
  });

  it("keeps the subject's status when body trackers mention later steps", () => {
    const parsed = parseEmail(
      makeEmail({
        ...SHIPMENT,
        subject: 'Shipped: "Example Widget..."',
        text: "Ordered Oct 3 Shipped Oct 4 Out for delivery Delivered\nArriving today\nOrder # 111-1111111-1111111",
      }),
    );
    expect(parsed.updates).toMatchObject([{ status: "in_transit", expectedDelivery: "2026-10-06" }]);
  });

  it("parses Out for delivery", () => {
    const parsed = parseEmail(
      makeEmail({
        ...SHIPMENT,
        subject: 'Out for delivery: "Example Widget 2-Pack, Blue..."',
        text: "Your package is out for delivery!\nOrdered\nShipped\nOut for delivery\nDelivered\nArriving today\nOrder #\n111-1111111-1111111",
      }),
    );
    expect(parsed.updates).toMatchObject([{ status: "out_for_delivery", expectedDelivery: "2026-10-06" }]);
  });

  it("parses Delivered (order-update@)", () => {
    const parsed = parseEmail(
      makeEmail({
        from: "order-update@amazon.com",
        fromName: "Amazon.com",
        ...DATE,
        subject: "Delivered: Your Amazon.com order #111-1111111-1111111",
        text: "Hi Testy,\nYour package has been delivered!\nTrack your package:\nhttps://www.amazon.com/gp/css/shiptrack/view.html?ie=UTF8&orderID=111-1111111-1111111&orderingShipmentId=55555555555555&packageId=1\nOrder #111-1111111-1111111",
      }),
    );
    expect(parsed.updates).toMatchObject([
      { carrier: "amazon", orderRef: "111-1111111-1111111", status: "delivered", deliveredAt: DATE.date, expectedDelivery: null },
    ]);
  });

  it("parses a delay (Delivery update:) with the later end of the new range", () => {
    const parsed = parseEmail(
      makeEmail({
        from: "order-update@amazon.com",
        ...DATE,
        subject: "Delivery update: Example Widget 2-Pack, Blue...",
        text: "Your package is on the way but running late. We're sorry for the delay.\nNow expected October 9 - October 10. Track your delivery for the latest updates.\nOrder #111-1111111-1111111",
      }),
    );
    expect(parsed.updates).toMatchObject([{ status: "exception", expectedDelivery: "2026-10-10", description: "Example Widget 2-Pack, Blue" }]);
  });

  it("uses the carrier tracking number when the email has one", () => {
    const parsed = parseEmail(
      makeEmail({
        ...SHIPMENT,
        subject: 'Shipped: "Example Widget..."',
        text: "Your package was shipped!\nShipped with UPS, tracking number 1Z999AA10123456784\nArriving Thursday\nOrder # 111-1111111-1111111",
      }),
    );
    expect(parsed.updates).toMatchObject([
      { carrier: "ups", trackingNumber: "1Z999AA10123456784", orderRef: "111-1111111-1111111", status: "in_transit" },
    ]);
  });

  it("uses Amazon Logistics TBA numbers", () => {
    const parsed = parseEmail(
      makeEmail({ ...SHIPMENT, subject: 'Shipped: "Example"', text: "Shipped with Amazon. Tracking ID: TBA305938274011\nOrder # 111-1111111-1111111" }),
    );
    expect(parsed.updates).toMatchObject([{ carrier: "amazon", trackingNumber: "TBA305938274011" }]);
  });

  it("skips Amazon mail without a shipment status", () => {
    const parsed = parseEmail(
      makeEmail({ from: "store-news@amazon.com", subject: "Deals picked for you", text: "Top deals today. Order 111-1111111-1111111 again?" }),
    );
    expect(parsed).toEqual({ kind: "amazon", updates: [], verification: null, note: "no shipment status" });
  });
});
