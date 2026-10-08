import { describe, expect, it } from "vitest";
import { parseEmail } from "../parse";
import { makeEmail } from "../test-helpers";

// Thu, 08 Oct 2026 06:12:44 -0400
const DATE = { date: "2026-10-08T10:12:44.000Z", headers: { date: "Thu, 08 Oct 2026 06:12:44 -0400" } };
const UPS = { from: "mcinfo@ups.com", fromName: "UPS", ...DATE };

/** 2021+ template; ids verified against a real email (research/carrier-emails.md §2). */
const OFD_HTML = `<html><head><title>UPS</title></head><body>
<table role="presentation"><tr><td>
<p id="salutation">Hi Testy,</p>
<p id="headline">Your package is arriving today.</p>
<p><span id="shipperAndArrival">From <strong>EXAMPLE PHARMACY C/O WEST LOGISTICS</strong></span></p>
<table><tr><td id="deliveryDateTimeLabel">Scheduled Delivery</td></tr>
<tr><td id="deliveryDateTime">Thursday 10/08/2026 3:15 PM - 5:15 PM</td></tr></table>
<p id="shipTo">Ship To<br>TESTY EXAMPLE<br>123 EXAMPLE ST<br>SPRINGFIELD, ZZ 00000</p>
<p id="serviceName">UPS Ground</p>
<p><span id="trackingNumber">1Z999AA10123456784</span></p>
<p><a id="cta" href="https://www.ups.com/track?loc=en_US&amp;Requester=SBN&amp;tracknum=1Z999AA10123456784&amp;AgreeToTermsAndConditions=yes">Track Your Package</a></p>
<p id="dcrLoginMessage">Not going to be home? <a href="https://www.ups.com/deliverychange?loc=en_US&amp;trackingNumber=1Z999AA10123456784">Change delivery</a></p>
<p>Questions? Call 1-800-742-5877</p>
</td></tr></table></body></html>`;

describe("UPS", () => {
  it("parses the 2021+ HTML template (ids)", () => {
    const parsed = parseEmail(makeEmail({ ...UPS, subject: "UPS Update: Package Scheduled for Delivery Today", html: OFD_HTML }));
    expect(parsed.kind).toBe("ups");
    expect(parsed.updates).toEqual([
      {
        carrier: "ups",
        trackingNumber: "1Z999AA10123456784",
        orderRef: null,
        shipper: "EXAMPLE PHARMACY C/O WEST LOGISTICS",
        description: null,
        status: "out_for_delivery",
        expectedDelivery: "2026-10-08",
        expectedWindow: "3:15 PM - 5:15 PM",
        deliveredAt: null,
        eventAt: DATE.date,
        source: "ups",
      },
    ]);
  });

  it("parses the 2020 plain-text template", () => {
    const text = `Hi Testy, you have a package coming today.
Estimated Delivery Date: Thursday,  10/08/2026
Estimated Delivery Time: 02:30 PM  -  06:30 PM
Tracking Number:\u00A01Z999AA10555555556
UPS Service: UPS Ground
Delivery Location: 123 EXAMPLE ST SPRINGFIELD ZZ 00000`;
    const parsed = parseEmail(
      makeEmail({ ...UPS, fromName: "UPS My Choice", subject: "UPS Update: Package Scheduled for Delivery Today", text }),
    );
    expect(parsed.updates).toMatchObject([
      {
        trackingNumber: "1Z999AA10555555556",
        status: "out_for_delivery",
        expectedDelivery: "2026-10-08",
        expectedWindow: "2:30 PM - 6:30 PM",
      },
    ]);
  });

  it("parses the day-before email (text)", () => {
    const text = `Hi Testy,
Your package is arriving tomorrow.
From ACME WIDGETS FULFILLMENT
Scheduled Delivery
Friday 10/09/2026
UPS Ground
1Z999AA10987654328`;
    const parsed = parseEmail(makeEmail({ ...UPS, subject: "UPS Update: Package Scheduled for Delivery Tomorrow", text }));
    expect(parsed.updates).toMatchObject([
      {
        trackingNumber: "1Z999AA10987654328",
        shipper: "ACME WIDGETS FULFILLMENT",
        status: "in_transit",
        expectedDelivery: "2026-10-09",
      },
    ]);
  });

  it("uses the subject's 'Tomorrow' when the body has no date", () => {
    const parsed = parseEmail(
      makeEmail({ ...UPS, subject: "UPS Update: Package Scheduled for Delivery Tomorrow", text: "Tracking Number: 1Z999AA10987654328" }),
    );
    expect(parsed.updates[0].expectedDelivery).toBe("2026-10-09");
  });

  it("parses a delivered email (shipper AMAZON.COM, no expected date)", () => {
    const html = `<p>Your package was delivered.</p><span id="shipperAndArrival">From <strong>AMAZON.COM</strong></span>
<span>Tracking Number: 1Z999AA10123456784</span><img src="cid:deliveryPhoto">`;
    const parsed = parseEmail(makeEmail({ ...UPS, subject: "Your UPS Package was delivered", html }));
    expect(parsed.updates).toMatchObject([
      { trackingNumber: "1Z999AA10123456784", shipper: "AMAZON.COM", status: "delivered", deliveredAt: DATE.date, expectedDelivery: null },
    ]);
  });

  it("parses a new delivery date; a delay in the body makes it an exception", () => {
    const text = (headline: string) =>
      `${headline}\nFrom ACME WIDGETS FULFILLMENT\nScheduled Delivery\nMonday 10/12/2026\n1Z999AA10987654328`;
    const plain = parseEmail(makeEmail({ ...UPS, subject: "UPS Update: New Scheduled Delivery Date", text: text("Your package has a new delivery date.") }));
    expect(plain.updates).toMatchObject([{ status: "in_transit", expectedDelivery: "2026-10-12" }]);
    const delayed = parseEmail(
      makeEmail({ ...UPS, subject: "UPS Update: New Scheduled Delivery Date", text: text("Your package has been delayed.") }),
    );
    expect(delayed.updates).toMatchObject([{ status: "exception", expectedDelivery: "2026-10-12" }]);
  });

  it("lists every package of a multi-package delivered email", () => {
    const parsed = parseEmail(
      makeEmail({
        ...UPS,
        subject: "Your UPS Packages were delivered",
        text: "Tracking Number: 1Z999AA10123456784\nTracking Number: 1Z999AA10987654328",
      }),
    );
    expect(parsed.updates.map((u) => u.trackingNumber)).toEqual(["1Z999AA10123456784", "1Z999AA10987654328"]);
  });
});

describe("false-positive guard: marketing mail", () => {
  const MARKETING = {
    subject: "Save 20% on your next shipment this holiday season",
    text: `Ship more, save more!
Use promo code HOLIDAY2026 at checkout. Offer ends 12/15/2026.
Prices from $9.99. Order 123456789012 ships in 2 days.
Call 1-800-742-5877 or (404) 828-6000. Store #4417, 55 Glenlake Pkwy, Atlanta, GA 30328.
UPS My Choice members get delivery alerts free: https://www.ups.com/mychoice?loc=en_US&campaign=2026Q4&id=88812345
Item 400012345678 | SKU 0021000658831
© 2026 United Parcel Service of America, Inc.`,
    html: `<p>Ship more, save more!</p><a href="https://www.ups.com/us/en/business-solutions?cid=email_1234567890&amp;utm_source=email">Learn more</a>`,
  };

  it("a ups.com marketing email with no tracking number gives zero updates", () => {
    for (const from of ["mcinfo@ups.com", "ups@email.ups.com", "ups@ups.com"]) {
      const parsed = parseEmail(makeEmail({ from, fromName: "UPS", ...MARKETING }));
      expect(parsed, from).toEqual({ kind: "ups", updates: [], verification: null, note: "no tracking numbers found" });
    }
  });

  it("the same email from an unknown sender is ignored", () => {
    const parsed = parseEmail(makeEmail({ from: "deals@shop.example", fromName: "Deals", ...MARKETING }));
    expect(parsed).toEqual({ kind: "ignored", updates: [], verification: null, note: "no tracking numbers found" });
  });
});
