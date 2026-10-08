import { describe, expect, it } from "vitest";
import { parseEmail } from "../parse";
import { makeEmail } from "../test-helpers";

const DATE = { date: "2026-10-08T15:00:00.000Z", headers: { date: "Thu, 08 Oct 2026 11:00:00 -0400" } };

describe("generic senders", () => {
  it("reads a shop's shipping confirmation with a carrier number", () => {
    const parsed = parseEmail(
      makeEmail({
        from: "store+12345@t.shopifyemail.com",
        fromName: "Example Outfitters",
        ...DATE,
        subject: "A shipment from order #1042 is on the way",
        text: `Your order is on the way
Track your shipment to see the delivery status.
UPS tracking number: 1Z999AA10555555556
Estimated delivery: Tuesday, October 13
Order summary
Trail Shoes × 1  $89.00
Questions? Call (555) 010-0199`,
      }),
    );
    expect(parsed).toEqual({
      kind: "generic",
      verification: null,
      note: null,
      updates: [
        {
          carrier: "ups",
          trackingNumber: "1Z999AA10555555556",
          orderRef: null,
          shipper: "Example Outfitters",
          description: null,
          status: "in_transit",
          expectedDelivery: "2026-10-13",
          expectedWindow: null,
          deliveredAt: null,
          eventAt: DATE.date,
          source: "generic",
        },
      ],
    });
  });

  it("reads tracking numbers from branded tracking links", () => {
    const parsed = parseEmail(
      makeEmail({
        from: "noreply@shop.example",
        fromName: "Customer Service",
        ...DATE,
        subject: "Your order has shipped",
        html: `<p>Good news! Your order has shipped.</p><a href="https://example.narvar.com/example/tracking/fedex?tracking_numbers=777123456784&amp;order_number=1042">Track</a>`,
      }),
    );
    expect(parsed.updates).toMatchObject([{ carrier: "fedex", trackingNumber: "777123456784", shipper: null, status: "in_transit" }]);
  });

  it("skips return labels (the package goes away from the user)", () => {
    const parsed = parseEmail(
      makeEmail({
        from: "returns@shop.example",
        subject: "Your return label is ready",
        text: "Print your prepaid return label and drop off your package.\nUSPS Tracking: 9400111899223197428497",
      }),
    );
    expect(parsed).toEqual({ kind: "ignored", updates: [], verification: null, note: "return label" });
  });

  it("ignores order confirmations and receipts without tracking numbers", () => {
    const parsed = parseEmail(
      makeEmail({
        from: "orders@shop.example",
        subject: "Order confirmed #100234567890",
        text: `Thanks for your order 100234567890!
Invoice 123456789012, total $123.45, card ending 4242.
Call 1-800-555-0102 with questions. Item UPC 036000291452. ZIP 30328.`,
      }),
    );
    expect(parsed.kind).toBe("ignored");
    expect(parsed.updates).toEqual([]);
  });

  it("uses the sender domain as a hint for regional carriers", () => {
    const parsed = parseEmail(
      makeEmail({ from: "notify@ontrac.com", subject: "Your package is on the way", text: "Tracking number C11031500001879" }),
    );
    expect(parsed.updates).toMatchObject([{ carrier: "ontrac", trackingNumber: "C11031500001879" }]);
  });
});
