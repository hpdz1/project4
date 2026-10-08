import { describe, expect, it } from "vitest";
import { detectTrackingNumber } from "@/lib/tracking";
import { parseEmail } from "../parse";
import { makeEmail } from "../test-helpers";

/** Fields every update from these fixtures shares. */
const usps = { carrier: "usps", orderRef: null, description: null, expectedWindow: null, deliveredAt: null };

const DIGEST_FROM = { from: "uspsinformeddelivery@email.informeddelivery.usps.com", fromName: "USPS Informed Delivery" };
// Thu, 08 Oct 2026 07:33:40 -0400
const DIGEST_DATE = { date: "2026-10-08T11:33:40.000Z", headers: { date: "Thu, 08 Oct 2026 07:33:40 -0400" } };

/** 2022 template (element ids verified against a real digest; research/carrier-emails.md §9). */
function digest2022Html(prefix = ""): string {
  const id = (name: string) => `id="${prefix}${name}"`;
  return `<html><head><style>p{margin:0}</style></head><body>
<span> Arriving Today</span><span ${id("today-date-span-id")}> Thursday, Oct 08</span>
<div ${id("today-package-div")}><table role="presentation"><tbody><tr><td>
<p ${id("pra-shipper-name-td-id")} align="left"> EXAMPLE OUTFITTERS CO</p>
<p align="left"><a ${id("tracking-number-href-id")} href="https://informeddelivery.usps.com/box/pages/secure/packageDashboardAction?selectedTrckNum=9400111899223197428497&amp;selectedTypeOfLabel=Package"><span ${id("pra-tracking-number-id")}> 9400111899223197428497</span></a></p>
</td></tr></tbody></table></div>
<span> Arriving Soon</span>
<div ${id("soon-package-div")}><table role="presentation"><tbody><tr><td>
<p ${id("pra-shipper-name-td-id")} align="left"> ACME WIDGETS FULFILLMENT</p>
<p align="left"><a ${id("tracking-number-href-id")} href="https://informeddelivery.usps.com/box/pages/secure/packageDashboardAction?selectedTrckNum=9205590199999999999905&amp;selectedTypeOfLabel=Package"><span ${id("pra-tracking-number-id")}> 9205590199999999999905</span></a></p>
<p ${id("pra-expected-delivery-date")} align="left"> Estimated Delivery on: Saturday, Oct 10</p>
</td></tr></tbody></table></div>
<span> Outbound </span>
<div ${id("outbound-package-div")}><table role="presentation"><tbody><tr><td>
<p ${id("pra-shipper-name-td-id")} align="left"> SAM EXAMPLE</p>
<p align="left"><a href="https://informeddelivery.usps.com/box/pages/secure/packageDashboardAction?selectedTrckNum=9274899999999999999994&amp;selectedTypeOfLabel=Package">9274899999999999999994</a></p>
</td></tr></tbody></table></div>
<p>You may have more mail or packages than are shown in your Daily Digest.</p>
</body></html>`;
}

const DIGEST_UPDATES = [
  {
    ...usps,
    trackingNumber: "9400111899223197428497",
    shipper: "EXAMPLE OUTFITTERS CO",
    status: "in_transit",
    expectedDelivery: "2026-10-08",
  },
  {
    ...usps,
    trackingNumber: "9205590199999999999905",
    shipper: "ACME WIDGETS FULFILLMENT",
    status: "in_transit",
    expectedDelivery: "2026-10-10",
  },
];

describe("USPS Informed Delivery Daily Digest", () => {
  it("parses the 2022 HTML template: one update per incoming package, outbound skipped", () => {
    const parsed = parseEmail(
      makeEmail({ ...DIGEST_FROM, ...DIGEST_DATE, subject: "Your Daily Digest for Thu, Oct 8", html: digest2022Html() }),
    );
    expect(parsed.kind).toBe("usps_digest");
    expect(parsed.note).toBeNull();
    expect(parsed.updates).toEqual(
      DIGEST_UPDATES.map((u) => ({ ...u, eventAt: DIGEST_DATE.date, source: "usps_digest" })),
    );
  });

  it("parses a manually forwarded digest (Gmail rewrites ids to m_<digits>...)", () => {
    const parsed = parseEmail(
      makeEmail({
        from: "sam@gmail.com",
        fromName: "Sam",
        ...DIGEST_DATE,
        subject: "Fwd: Your Daily Digest for Thu, 10/8 is ready to view",
        text: [
          "---------- Forwarded message ---------",
          "From: USPS Informed Delivery <USPSInformeddelivery@email.informeddelivery.usps.com>",
          "Date: Thu, Oct 8, 2026 at 7:33 AM",
          "Subject: Your Daily Digest for Thu, 10/8 is ready to view",
          "To: <sam@gmail.com>",
          "",
          "(images)",
        ].join("\n"),
        html: digest2022Html("m_354676504112668048"),
      }),
    );
    expect(parsed.kind).toBe("usps_digest");
    expect(parsed.note).toBe("manual forward");
    expect(parsed.updates.map((u) => [u.trackingNumber, u.shipper, u.expectedDelivery])).toEqual([
      ["9400111899223197428497", "EXAMPLE OUTFITTERS CO", "2026-10-08"],
      ["9205590199999999999905", "ACME WIDGETS FULFILLMENT", "2026-10-10"],
    ]);
  });

  it("falls back to headings and the line before each number (2020 template, no ids)", () => {
    const html = `<table><tr><td><h3>Arriving Today</h3></td></tr>
<tr><td><p>EXAMPLE PHARMACY - PHX (PMOD)</p><p><a href="https://informeddelivery.usps.com/box/pages/secure/packageDashboardAction?selectedTrckNum=9405509999999999991239&amp;selectedTypeOfLabel=Package">9405509999999999991239</a></p></td></tr>
<tr><td><h3>Arriving Soon</h3></td></tr>
<tr><td><p>ACME WIDGETS FULFILLMENT</p><p><a href="https://informeddelivery.usps.com/x?selectedTrckNum=9205590199999999999905">9205590199999999999905</a></p>
<p>Expected Delivery: Saturday, Oct 10</p></td></tr></table>`;
    const parsed = parseEmail(makeEmail({ ...DIGEST_FROM, ...DIGEST_DATE, subject: "Your Daily Digest for Thu, Oct 8", html }));
    expect(parsed.updates.map((u) => [u.trackingNumber, u.shipper, u.status, u.expectedDelivery])).toEqual([
      ["9405509999999999991239", "EXAMPLE PHARMACY - PHX (PMOD)", "in_transit", "2026-10-08"],
      ["9205590199999999999905", "ACME WIDGETS FULFILLMENT", "in_transit", "2026-10-10"],
    ]);
  });

  it("parses the plain-text layout (2025 headings)", () => {
    const text = `COMING TO YOU SOON
Hi, Testy!
You have 2 mailpiece(s) and 2 inbound package(s) arriving soon.
Thursday 8 October 2026
MAIL View Dashboard
Expected Today
2 item(s)
PACKAGES View Dashboard
Expected Today
EXAMPLE OUTFITTERS CO
9400111899223197428497
Expected Soon
ACME WIDGETS FULFILLMENT
9205590199999999999905
Estimated Delivery on: Saturday, Oct 10
You may have more mail or packages than are shown in your Daily Digest. To check, go to your Dashboard.`;
    const parsed = parseEmail(
      makeEmail({ ...DIGEST_FROM, ...DIGEST_DATE, subject: "Your Daily Digest for Thu, 10/8 is ready to view", text }),
    );
    expect(parsed.updates).toEqual(DIGEST_UPDATES.map((u) => ({ ...u, eventAt: DIGEST_DATE.date, source: "usps_digest" })));
  });

  it("uses 'From:' lines, marks out-for-delivery items and awaiting-sender labels", () => {
    const text = `Expected Today
From: EXAMPLE OUTFITTERS CO
Tracking Number: 9400 1118 9922 3197 4284 97
Out for Delivery
Packages Awaiting Sender
From: NORTHWIND HOME GOODS
Tracking Number: 9274 8999 9999 9999 9999 94`;
    const parsed = parseEmail(makeEmail({ ...DIGEST_FROM, ...DIGEST_DATE, subject: "Your Daily Digest for Thu, 10/8", text }));
    expect(parsed.updates.map((u) => [u.trackingNumber, u.shipper, u.status, u.expectedDelivery])).toEqual([
      ["9400111899223197428497", "EXAMPLE OUTFITTERS CO", "out_for_delivery", "2026-10-08"],
      ["9274899999999999999994", "NORTHWIND HOME GOODS", "pre_transit", null],
    ]);
  });

  it("reads packages inside section containers that lack per-package ids", () => {
    const html = `<div id="today-package-div"><table><tr><td>EXAMPLE OUTFITTERS CO</td></tr>
<tr><td><a href="https://informeddelivery.usps.com/trackingV2/digest/click?a=Zm9v">9400111899223197428497</a></td></tr></table></div>
<div id="soon-package-div"><table><tr><td>ACME WIDGETS FULFILLMENT</td></tr><tr><td>9205590199999999999905</td></tr>
<tr><td>Estimated Delivery on: Saturday, Oct 10</td></tr>
<tr><td>NORTHWIND HOME GOODS</td></tr><tr><td>9405509999999999991239</td></tr></table></div>`;
    const parsed = parseEmail(makeEmail({ ...DIGEST_FROM, ...DIGEST_DATE, subject: "Your Daily Digest for Thu, 10/8 is ready to view", html }));
    expect(parsed.updates.map((u) => [u.trackingNumber, u.shipper, u.expectedDelivery])).toEqual([
      ["9400111899223197428497", "EXAMPLE OUTFITTERS CO", "2026-10-08"],
      ["9205590199999999999905", "ACME WIDGETS FULFILLMENT", "2026-10-10"],
      ["9405509999999999991239", "NORTHWIND HOME GOODS", null],
    ]);
  });

  it("infers next year's date across the year boundary", () => {
    const html = digest2022Html()
      .replace("Thursday, Oct 08", "Wednesday, Dec 30")
      .replace("Saturday, Oct 10", "Monday, Jan 04");
    const parsed = parseEmail(
      makeEmail({
        ...DIGEST_FROM,
        date: "2026-12-30T12:00:00.000Z",
        headers: { date: "Wed, 30 Dec 2026 07:00:00 -0500" },
        subject: "Your Daily Digest for Wed, 12/30 is ready to view",
        html,
      }),
    );
    expect(parsed.updates.map((u) => u.expectedDelivery)).toEqual(["2026-12-30", "2027-01-04"]);
  });

  it("keeps the kind and explains an empty digest", () => {
    const parsed = parseEmail(
      makeEmail({
        ...DIGEST_FROM,
        subject: "Your Daily Digest for Thu, 10/8 is ready to view",
        html: `<div id="today-package-div"><p id="no-packages-today">No packages are available to display.</p></div>`,
      }),
    );
    expect(parsed).toEqual({ kind: "usps_digest", updates: [], verification: null, note: "no packages in digest" });
  });
});

describe("USPS tracking emails (auto-reply@usps.com)", () => {
  const alert = (subject: string, text: string) =>
    parseEmail(makeEmail({ from: "auto-reply@usps.com", subject, text, ...DIGEST_DATE }));

  it("out for delivery: date and window from the subject", () => {
    const parsed = alert(
      "USPS® Expected Delivery on Thursday, October 8, 2026 Between 11:30am and 3:30pm 9400111899223197428497",
      `Hello Testy Example,
Your item is out for delivery on October 8, 2026 at 7:10 am in SPRINGFIELD, ZZ 00000.
USPS expects to deliver your package today between 11:30am and 3:30pm.
Tracking Number: 9400111899223197428497
https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223197428497&utm_source=outfordelivery&utm_medium=email
Out for Delivery
Between 11:30am and 3:30pm`,
    );
    expect(parsed.kind).toBe("usps_alert");
    expect(parsed.updates).toEqual([
      {
        ...usps,
        trackingNumber: "9400111899223197428497",
        shipper: null,
        status: "out_for_delivery",
        expectedDelivery: "2026-10-08",
        expectedWindow: "11:30 AM - 3:30 PM",
        eventAt: DIGEST_DATE.date,
        source: "usps_alert",
      },
    ]);
  });

  it("delivered: status delivered, deliveredAt = email date", () => {
    const parsed = alert(
      "USPS® Item Delivered, Front Door/Porch 9400111899223197428497",
      `Hello Testy Example,
Your item was delivered at the front door or porch at 1:07 pm on October 8, 2026 in SPRINGFIELD, ZZ 00000.
Tracking Number: 9400111899223197428497`,
    );
    expect(parsed.updates).toMatchObject([
      { trackingNumber: "9400111899223197428497", status: "delivered", deliveredAt: DIGEST_DATE.date, expectedDelivery: null },
    ]);
  });

  it("delivered with no number in the subject", () => {
    const parsed = alert(
      "USPS® Item Delivered, Front Desk/Reception/Mail Room",
      "Your item was delivered to the front desk.\nTracking Number: 9205590199999999999905",
    );
    expect(parsed.updates).toMatchObject([{ trackingNumber: "9205590199999999999905", status: "delivered" }]);
  });

  it("exception: prefers the checksum-valid body number over an anonymized subject number", () => {
    expect(detectTrackingNumber("92748902410637553123456789")?.checksumValid).toBe(false);
    const parsed = alert(
      "USPS® Delivery Exception 92748902410637553123456789",
      `Your package has a delivery exception. The delivery status of your item has not been updated as of October 9, 2026, 1:10 am. We apologize that it may arrive later than expected.
Tracking Number: 92748902410637553403302876
Delivery Exception`,
    );
    expect(parsed.updates.map((u) => [u.trackingNumber, u.status])).toEqual([["92748902410637553403302876", "exception"]]);
  });

  it("available for pickup", () => {
    const parsed = alert("USPS® Available for Pickup 9205590199999999999905", "Your item is available for pickup at the SPRINGFIELD Post Office.");
    expect(parsed.updates).toMatchObject([{ status: "available_for_pickup" }]);
  });
});
