import { describe, expect, it } from "vitest";
import { parseEmail } from "../parse";
import { makeEmail } from "../test-helpers";

// Thu, 08 Oct 2026 08:02:11 -0500
const DATE = { date: "2026-10-08T13:02:11.000Z", headers: { date: "Thu, 08 Oct 2026 08:02:11 -0500", "reply-to": "trackingmail@fedex.com" } };
const FEDEX = { from: "trackingupdates@fedex.com", fromName: "FedEx Delivery Manager", ...DATE };

/** research/carrier-emails.md §9, modeled on a real 2021 FedEx Delivery Manager email. */
const OFD_TEXT = `Hi, Testy. Your package from Example Outfitters Co is now out for delivery today.
SCHEDULED DELIVERY
Thu, 10/08/2026
OUT FOR DELIVERY
SPRINGFIELD, ZZ
TRACKING NUMBER
398765432103
FROM
Example Outfitters Co
1 WAREHOUSE WAY
ANYTOWN, ZZ, US, 00001
TO
Testy Example
123 EXAMPLE ST
SPRINGFIELD, ZZ, US, 00000
REFERENCE
111-1111111-1111111
SHIP DATE
Mon 10/05/2026 12:00 AM
SERVICE TYPE
FedEx Ground Economy
Questions? Call 1.800.463.3339`;

describe("FedEx", () => {
  it("parses an out-for-delivery email; an Amazon REFERENCE becomes the order ref", () => {
    const parsed = parseEmail(
      makeEmail({ ...FEDEX, subject: "FedEx Shipment 398765432103: Your package is now out for delivery today", text: OFD_TEXT }),
    );
    expect(parsed.kind).toBe("fedex");
    expect(parsed.updates).toEqual([
      {
        carrier: "fedex",
        trackingNumber: "398765432103",
        orderRef: "111-1111111-1111111",
        shipper: "Example Outfitters Co",
        description: null,
        status: "out_for_delivery",
        expectedDelivery: "2026-10-08",
        expectedWindow: null,
        deliveredAt: null,
        eventAt: DATE.date,
        source: "fedex",
      },
    ]);
  });

  it("parses a delivered email", () => {
    const parsed = parseEmail(
      makeEmail({
        ...FEDEX,
        subject: "Your shipment was delivered 398765432103",
        text: "Your shipment from Example Outfitters Co was delivered.\nTRACKING NUMBER\n398765432103\nDELIVERED\nThu, 10/08/2026 10:21 AM",
      }),
    );
    expect(parsed.updates).toMatchObject([
      { trackingNumber: "398765432103", shipper: "Example Outfitters Co", status: "delivered", deliveredAt: DATE.date },
    ]);
  });

  it("parses an exception with a pending date", () => {
    const parsed = parseEmail(
      makeEmail({
        ...FEDEX,
        subject: "FedEx Delivery Exception",
        text: "Hi, Testy. There is a delay with your package from Acme Widgets Fulfillment.\nSCHEDULED DELIVERY\nPending\nTRACKING NUMBER\n777123456784",
      }),
    );
    expect(parsed.updates).toMatchObject([
      { trackingNumber: "777123456784", shipper: "Acme Widgets Fulfillment", status: "exception", expectedDelivery: null },
    ]);
  });

  it("finds a number that only appears inside a FedEx tracking link (HTML)", () => {
    const html = `<p>Hi, Sam. Your package from Contoso Electronics is on its way.</p>
<table><tr><td>SCHEDULED DELIVERY</td></tr><tr><td>Sun, 10/11/2026</td></tr><tr><td>by end of day</td></tr></table>
<a href="https://www.fedex.com/fedextrack/?trknbr=777123456784&amp;trkqual=12026~777123456784~FDEG">Track your package</a>
<a href="http://click.message.fedex.com/?qs=8f2e4b1c9a7d6e5f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d">Manage delivery</a>`;
    const parsed = parseEmail(makeEmail({ ...FEDEX, subject: "Your package is on its way", html }));
    expect(parsed.updates).toEqual([
      expect.objectContaining({
        carrier: "fedex",
        trackingNumber: "777123456784",
        shipper: "Contoso Electronics",
        status: "in_transit",
        expectedDelivery: "2026-10-11",
        expectedWindow: "by end of day",
      }),
    ]);
  });

  it("lists each piece of a multi-piece shipment", () => {
    const text = `Hi, Testy. Your packages from Example Outfitters Co are now out for delivery today.
TRACKING ID STATUS
123456789012 On FedEx vehicle for delivery SPRINGFIELD, ZZ
398765432103 On FedEx vehicle for delivery SPRINGFIELD, ZZ
MASTER TRACKING NUMBER
777123456784`;
    const parsed = parseEmail(makeEmail({ ...FEDEX, subject: "FedEx Shipment 777123456784: Your packages are now out for delivery today", text }));
    expect(parsed.updates.map((u) => u.trackingNumber).sort()).toEqual(["123456789012", "398765432103", "777123456784"]);
    expect(new Set(parsed.updates.map((u) => u.status))).toEqual(new Set(["out_for_delivery"]));
  });
});
