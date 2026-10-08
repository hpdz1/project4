import { describe, expect, it } from "vitest";
import { findForwardedBlock, findInboundAlias, recoverOriginal, stripForwardPrefix } from "./forwarding";
import { makeEmail } from "./test-helpers";

const DOMAIN = "in.example.com";

describe("findInboundAlias", () => {
  it("finds the alias in the envelope recipients", () => {
    const email = makeEmail({ recipients: ["sam@gmail.com", "r-k3j9x2m4q8w1@in.example.com"] });
    expect(findInboundAlias(email, DOMAIN)).toBe("r-k3j9x2m4q8w1");
  });

  it("accepts +tags, uppercase addresses and an uppercase/dotted domain setting", () => {
    expect(findInboundAlias(makeEmail({ recipients: ["r-k3j9x2m4q8w1+ups@in.example.com"] }), DOMAIN)).toBe("r-k3j9x2m4q8w1");
    expect(findInboundAlias(makeEmail({ recipients: ["R-K3J9X2M4Q8W1@IN.EXAMPLE.COM"] }), DOMAIN)).toBe("r-k3j9x2m4q8w1");
    expect(findInboundAlias(makeEmail({ recipients: ["r-k3j9x2m4q8w1@in.example.com"] }), " IN.Example.COM. ")).toBe(
      "r-k3j9x2m4q8w1",
    );
  });

  it("accepts an alias carried as the +tag of a shared mailbox", () => {
    expect(findInboundAlias(makeEmail({ recipients: ["in+r-k3j9x2m4q8w1@in.example.com"] }), DOMAIN)).toBe("r-k3j9x2m4q8w1");
  });

  it("rejects the wrong domain, look-alike domains and malformed aliases", () => {
    const cases = [
      "r-k3j9x2m4q8w1@example.com",
      "r-k3j9x2m4q8w1@in.example.com.evil.net",
      "r-k3j9x2m4q8w1@evil-in.example.com",
      "r-short@in.example.com",
      "r-k3j9x2m4q8w1_x@in.example.com",
      "x-k3j9x2m4q8w1@in.example.com",
      `r-${"a".repeat(33)}@in.example.com`,
    ];
    for (const address of cases) {
      expect(findInboundAlias(makeEmail({ recipients: [address], headers: {} }), DOMAIN), address).toBeNull();
    }
  });

  it("scans header values, including 'Name <addr>' lists", () => {
    const email = makeEmail({
      recipients: ["sam@gmail.com"],
      headers: {
        to: '"Sam Example" <sam@gmail.com>, "Package Radar" <r-k3j9x2m4q8w1@in.example.com>',
      },
    });
    expect(findInboundAlias(email, DOMAIN)).toBe("r-k3j9x2m4q8w1");
  });

  it("uses Gmail's X-Forwarded-To and Received 'for' clauses", () => {
    expect(
      findInboundAlias(makeEmail({ recipients: [], headers: { "x-forwarded-to": "r-k3j9x2m4q8w1@in.example.com" } }), DOMAIN),
    ).toBe("r-k3j9x2m4q8w1");
    expect(
      findInboundAlias(
        makeEmail({ recipients: [], headers: { received: "by mx.example.net for <r-abcdefghijkl@in.example.com>; Thu, 8 Oct 2026" } }),
        DOMAIN,
      ),
    ).toBe("r-abcdefghijkl");
  });

  it("never routes by sender headers", () => {
    const email = makeEmail({
      recipients: [],
      from: "r-k3j9x2m4q8w1@in.example.com",
      headers: { from: "r-k3j9x2m4q8w1@in.example.com", "reply-to": "r-k3j9x2m4q8w1@in.example.com" },
    });
    expect(findInboundAlias(email, DOMAIN)).toBeNull();
  });

  it("prefers the envelope recipient over header mentions", () => {
    const email = makeEmail({
      recipients: ["r-aaaaaaaaaaaa@in.example.com"],
      headers: { to: "r-bbbbbbbbbbbb@in.example.com" },
    });
    expect(findInboundAlias(email, DOMAIN)).toBe("r-aaaaaaaaaaaa");
  });

  it("returns null for an empty domain setting", () => {
    expect(findInboundAlias(makeEmail(), "")).toBeNull();
  });
});

describe("stripForwardPrefix", () => {
  it.each([
    ["Fwd: UPS Update: Package Scheduled for Delivery Today", "UPS Update: Package Scheduled for Delivery Today"],
    ["FW: Fwd: Your Daily Digest for Thu, 10/8", "Your Daily Digest for Thu, 10/8"],
    ["Fw: Shipped: \"Widget\"", "Shipped: \"Widget\""],
    ["TR: Votre colis", "Votre colis"],
    ["WG: Ihre Sendung", "Ihre Sendung"],
    ["UPS Update: Package Delivered", "UPS Update: Package Delivered"],
  ])("%j", (subject, expected) => {
    expect(stripForwardPrefix(subject)).toBe(expected);
  });
});

describe("recoverOriginal: manual forwards", () => {
  const userFrom = { from: "sam@gmail.com", fromName: "Sam Example" };

  it("unwraps a Gmail forward, including an address wrapped onto the next line", () => {
    const email = makeEmail({
      ...userFrom,
      subject: "Fwd: Your Daily Digest for Thu, 10/8 is ready to view",
      text: [
        "FYI",
        "",
        "---------- Forwarded message ---------",
        "From: USPS Informed Delivery <",
        "USPSInformeddelivery@email.informeddelivery.usps.com>",
        "Date: Thu, Oct 8, 2026 at 7:05 AM",
        "Subject: Your Daily Digest for Thu, 10/8 is ready to view",
        "To: <sam@gmail.com>",
        "",
        "",
        "COMING TO YOU SOON",
        "Expected Today",
      ].join("\n"),
    });
    const original = recoverOriginal(email);
    expect(original).toMatchObject({
      from: "uspsinformeddelivery@email.informeddelivery.usps.com",
      fromName: "USPS Informed Delivery",
      subject: "Your Daily Digest for Thu, 10/8 is ready to view",
      forwardedDate: "Thu, Oct 8, 2026 at 7:05 AM",
      forwarded: true,
    });
    expect(original.text).toBe("COMING TO YOU SOON\nExpected Today");
  });

  it("unwraps an Apple Mail forward with quoted lines", () => {
    const email = makeEmail({
      ...userFrom,
      subject: "Fwd: Shipped: \"Widget\"",
      text: [
        "Sent from my iPhone",
        "",
        "Begin forwarded message:",
        "",
        '> From: "Amazon.com" <shipment-tracking@amazon.com>',
        "> Date: October 8, 2026 at 10:47:00 AM EDT",
        "> To: sam@icloud.com",
        '> Subject: Shipped: "Widget"',
        "> ",
        "> Your package was shipped!",
        "> Arriving Monday",
      ].join("\n"),
    });
    const original = recoverOriginal(email);
    expect(original.from).toBe("shipment-tracking@amazon.com");
    expect(original.fromName).toBe("Amazon.com");
    expect(original.subject).toBe('Shipped: "Widget"');
    expect(original.text).toBe("Your package was shipped!\nArriving Monday");
  });

  it("unwraps an Outlook forward (underscore line, From/Sent block)", () => {
    const email = makeEmail({
      ...userFrom,
      subject: "FW: UPS Update: Package Scheduled for Delivery Today",
      text: [
        "",
        "________________________________",
        "From: UPS <mcinfo@ups.com>",
        "Sent: Thursday, October 8, 2026 6:12 AM",
        "To: Sam Example <sam@outlook.com>",
        "Subject: UPS Update: Package Scheduled for Delivery Today",
        "",
        "Your package is arriving today.",
      ].join("\n"),
    });
    expect(recoverOriginal(email)).toMatchObject({ from: "mcinfo@ups.com", fromName: "UPS", forwarded: true });
  });

  it("unwraps old Outlook '-----Original Message-----' with [mailto:]", () => {
    const text = [
      "-----Original Message-----",
      "From: FedEx Delivery Manager [mailto:TrackingUpdates@fedex.com]",
      "Sent: Thursday, October 08, 2026 9:30 AM",
      "To: sam@example.com",
      "Subject: FedEx Shipment 398765432103: Your package is on its way",
      "",
      "Hi, Sam.",
    ].join("\n");
    expect(findForwardedBlock(text)).toMatchObject({
      from: "trackingupdates@fedex.com",
      fromName: "FedEx Delivery Manager",
      subject: "FedEx Shipment 398765432103: Your package is on its way",
      body: "Hi, Sam.",
    });
  });

  it("unwraps a Yahoo forward with the headers on the marker line", () => {
    const text =
      "----- Forwarded Message ----- From: UPS <mcinfo@ups.com> To: sam@yahoo.com Sent: Thursday, October 8, 2026, 06:12:44 AM EDT Subject: UPS Update: Package Delivered\n\nYour package was delivered.";
    expect(findForwardedBlock(text)).toMatchObject({
      from: "mcinfo@ups.com",
      subject: "UPS Update: Package Delivered",
      body: "Your package was delivered.",
    });
  });

  it("unwraps an Outlook block with no marker line", () => {
    const text = "See below\n\nFrom: auto-reply@usps.com\nSent: Thursday, October 8, 2026 1:07 PM\nSubject: USPS® Item Delivered\n\nDelivered.";
    expect(findForwardedBlock(text)?.from).toBe("auto-reply@usps.com");
  });

  it("prefers the carrier block in a forward of a forward", () => {
    const text = [
      "---------- Forwarded message ---------",
      "From: Pat <pat@example.com>",
      "Subject: Fwd: Your UPS Package was delivered",
      "",
      "---------- Forwarded message ---------",
      "From: UPS <mcinfo@ups.com>",
      "Subject: Your UPS Package was delivered",
      "",
      "Delivered!",
    ].join("\n");
    expect(findForwardedBlock(text)?.from).toBe("mcinfo@ups.com");
  });

  it("reads the forwarded block from HTML when there is no text part", () => {
    const email = makeEmail({
      ...userFrom,
      subject: "Fwd: Your UPS Package was delivered",
      html: `<div dir="ltr">see this<br><div class="gmail_quote"><div class="gmail_attr">---------- Forwarded message ---------<br>From: <strong class="gmail_sendername">UPS</strong> <span>&lt;<a href="mailto:mcinfo@ups.com">mcinfo@ups.com</a>&gt;</span><br>Date: Thu, Oct 8, 2026 at 1:07 PM<br>Subject: Your UPS Package was delivered<br>To: &lt;sam@gmail.com&gt;<br></div><br><br><div>Your package was delivered.</div></div></div>`,
    });
    expect(recoverOriginal(email)).toMatchObject({ from: "mcinfo@ups.com", subject: "Your UPS Package was delivered" });
  });

  it("leaves auto-forwarded carrier mail alone (only strips the subject prefix)", () => {
    const email = makeEmail({ from: "mcinfo@ups.com", fromName: "UPS", subject: "Fwd: UPS Update", text: "From: Pat <pat@example.com>\nSent: today\n\nx" });
    expect(recoverOriginal(email)).toMatchObject({ from: "mcinfo@ups.com", subject: "UPS Update", forwarded: false });
  });

  it("keeps the message as is when no forwarded block is found", () => {
    const email = makeEmail({ ...userFrom, subject: "Fwd: hello", text: "No headers here." });
    expect(recoverOriginal(email)).toMatchObject({ from: "sam@gmail.com", subject: "hello", forwarded: false, text: "No headers here." });
  });
});
