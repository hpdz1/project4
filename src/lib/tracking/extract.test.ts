import { describe, expect, it } from "vitest";
import type { CarrierId } from "@/lib/types";
import { findTrackingNumbers } from "./extract";

const numbers = (text: string, carrierHint?: CarrierId) =>
  findTrackingNumbers(text, carrierHint ? { carrierHint } : {}).map((r) => `${r.carrier}:${r.trackingNumber}`);

// Decoys used below all PASS some carrier check digit (verified with an
// independent Python implementation), so only the context rules can reject them:
//   1-800-555-0102 -> 18005550102 passes DHL Express (11) mod 7
//   (312) 555-0105 -> 3125550105 passes DHL Express (10) mod 7
//   +44 20 7946 0008 -> 442079460008 passes FedEx Express (12)
//   123456789012, 100234567890 pass FedEx Express (12)
//   100234567890005 passes FedEx Ground (15)
//   12345678901234567890 passes USPS (20)
//   3318810025 passes DHL Express (10)

describe("grouped and formatted numbers", () => {
  it.each([
    "USPS Tracking®: 9400 1118 9922 3197 4284 97",
    "USPS Tracking®: 9400-1118-9922-3197-4284-97",
    "USPS Tracking®: 9400\u00A01118\u00A09922\u00A03197\u00A04284\u00A097",
    "USPS Tracking®: 9400\u200B1118\u200B9922\u200B3197\u200B4284\u200B97",
    "USPS Tracking®: 9400&nbsp;1118&nbsp;9922&nbsp;3197&nbsp;4284&nbsp;97",
    "USPS Tracking®: 9400111899223197428497",
  ])("USPS grouped digits: %j", (text) => {
    expect(numbers(text)).toEqual(["usps:9400111899223197428497"]);
  });

  it("finds a grouped number after unrelated digits on the same line", () => {
    expect(numbers("Qty 2 9400 1118 9922 3197 4284 97 arriving Thu")).toEqual(["usps:9400111899223197428497"]);
  });

  it("joins UPS label grouping", () => {
    expect(numbers("Tracking Number: 1Z 999 AA1 01 2345 6784")).toEqual(["ups:1Z999AA10123456784"]);
  });

  it("joins grouped FedEx Ground digits", () => {
    expect(numbers("FedEx tracking 0414 4176 0228 964")).toEqual(["fedex:041441760228964"]);
  });

  it("joins the LaserShip -1 suffix", () => {
    expect(numbers("OnTrac tracking 1LS7119013618127-1")).toEqual(["ontrac:1LS71190136181271"]);
  });
});

describe("distinctive formats", () => {
  it("are found anywhere in free text when the check digit passes", () => {
    const text = [
      "Ref TBA305938274011 and 1Z999AA10123456784,",
      "intl RB123456785US / C11031500001879 / 1LS717793482164 / LX17635036",
      "ground 9611020987654312345672; IMpb 92748931507708513018050063",
    ].join("\n");
    expect(numbers(text)).toEqual([
      "amazon:TBA305938274011",
      "ups:1Z999AA10123456784",
      "usps:RB123456785US",
      "ontrac:C11031500001879",
      "ontrac:1LS717793482164",
      "ontrac:LX17635036",
      "fedex:9611020987654312345672",
      "usps:92748931507708513018050063",
    ]);
  });

  it("are dropped when the check digit fails", () => {
    expect(numbers("1Z999AA10123456785 9400111899223197428498 RB123456786US C11031500001878")).toEqual([]);
  });

  it("strip the USPS 420+ZIP routing prefix", () => {
    expect(numbers("Barcode 420787459400111206206406260787")).toEqual(["usps:9400111206206406260787"]);
  });

  it("must be uppercase when the format has no check digit", () => {
    expect(numbers("tracking: tba305938274011")).toEqual([]);
    expect(numbers("tracking: 1z999aa10123456784")).toEqual(["ups:1Z999AA10123456784"]);
  });
});

describe("short / all-digit formats need context", () => {
  it("accepts a FedEx 12-digit number after a tracking keyword", () => {
    expect(findTrackingNumbers("Tracking number: 986578788855")).toEqual([
      { trackingNumber: "986578788855", carrier: "fedex", format: "FedEx Express (12 digits)", checksumValid: true },
    ]);
  });

  it("accepts it after the carrier's name", () => {
    expect(numbers("Your FedEx package 986578788855 is on its way")).toEqual(["fedex:986578788855"]);
  });

  it("rejects it with no keyword, carrier name or hint", () => {
    expect(numbers("Your package 986578788855 is on its way")).toEqual([]);
  });

  it("only looks 60 characters back", () => {
    const far = `Tracking details${" ".repeat(10)}${"x".repeat(50)} 986578788855`;
    expect(numbers(far)).toEqual([]);
  });

  it("rejects a number whose nearest label is an order/invoice label", () => {
    expect(numbers("Tracking info is below. Order number: 986578788855")).toEqual([]);
    expect(numbers("FedEx invoice 986578788855")).toEqual([]);
  });

  it("accepts a keyword that comes after an earlier order label", () => {
    expect(numbers("Your order has shipped! Tracking number: 986578788855")).toEqual(["fedex:986578788855"]);
  });

  it("covers DHL Express (10/11), FedEx Ground (15), USPS (20) and UPS waybills", () => {
    expect(numbers("DHL waybill 3318810025")).toEqual(["dhl:3318810025"]);
    expect(numbers("Waybill: 73891051146")).toEqual(["dhl:73891051146"]);
    expect(numbers("Tracking # 041441760228964")).toEqual(["fedex:041441760228964"]);
    expect(numbers("USPS Certified Mail tracking 7196 9010 7560 0307 7385")).toEqual(["usps:71969010756003077385"]);
    expect(numbers("UPS waybill K2479825491")).toEqual(["ups:K2479825491"]);
    expect(numbers("Reference K2479825491")).toEqual([]);
  });

  it("does not let a sub-window of a longer digit run through", () => {
    // 9400 1002 3456 7890 4284 96 fails the USPS check; its middle "1002 3456 7890" passes FedEx 12.
    expect(numbers("USPS tracking 9400 1002 3456 7890 4284 96")).toEqual([]);
  });

  it("never cuts a dash-joined compound such as an Amazon order number", () => {
    // "1234567-1234567" would be a 14-digit DHL eCommerce number if cut out.
    expect(numbers("DHL tracking: 113-1234567-1234567", "dhl")).toEqual([]);
  });

  it("requires the carrier itself for generic no-check-digit formats", () => {
    expect(numbers("DHL tracking: 60120172242323")).toEqual(["dhl_ecommerce:60120172242323"]);
    expect(numbers("Tracking: 60120172242323")).toEqual([]);
    expect(numbers("Tracking: 60120172242323", "dhl")).toEqual(["dhl_ecommerce:60120172242323"]);
    expect(numbers("Package 60120172242323", "dhl")).toEqual([]); // hint but no keyword
    expect(numbers("Amazon tracking C1004444443")).toEqual(["amazon:C1004444443"]);
    expect(numbers("Tracking C1004444443")).toEqual([]);
  });
});

describe("carrierHint", () => {
  it("lets the hinted carrier's short formats through without a keyword", () => {
    expect(numbers("Your package 986578788855 is on its way", "fedex")).toEqual(["fedex:986578788855"]);
    expect(numbers("Package 3318810025 arrives today", "dhl")).toEqual(["dhl:3318810025"]);
  });

  it("does not help other carriers' short formats", () => {
    expect(numbers("Your package 986578788855 is on its way", "ups")).toEqual([]);
  });

  it("makes a bare keyword insufficient for a different carrier's short format", () => {
    expect(numbers("Tracking number: 986578788855", "dhl")).toEqual([]);
    expect(numbers("FedEx tracking number: 986578788855", "dhl")).toEqual(["fedex:986578788855"]);
  });

  it("still rejects order labels and phone numbers", () => {
    expect(numbers("Order #123456789012", "fedex")).toEqual([]);
    expect(numbers("Call 1-800-555-0102", "dhl")).toEqual([]);
  });

  it("picks the hinted carrier when a number fits several", () => {
    const barcode = "4201028200009261290113185417468510"; // valid USPS (with 420+ZIP) and valid FedEx 34
    expect(numbers(barcode)).toEqual(["usps:9261290113185417468510"]);
    expect(numbers(barcode, "fedex")).toEqual([`fedex:${barcode}`]);
  });

  it("treats 'unknown' like no hint", () => {
    expect(numbers("Your package 986578788855 is on its way", "unknown")).toEqual([]);
  });

  it("finds FedEx Ground Economy 20-digit numbers in FedEx emails", () => {
    const text = "FedEx Shipment 61299998820821171811: Your package is now out for delivery today\nTRACKING NUMBER\n61299998820821171811";
    expect(numbers(text, "fedex")).toEqual(["fedex:61299998820821171811"]);
  });
});

describe("phone numbers never match", () => {
  it.each([
    "DHL Express customer service: 1-800-555-0102",
    "DHL tracking questions? (312) 555-0105",
    "DHL tracking questions? 312-555-0105",
    "DHL tracking questions? 312.555.0105",
    "DHL tracking questions? 312 555 0105",
    "DHL tracking questions? +1 312 555 0105",
    "Call DHL at 3125550105 about your shipment",
    "DHL shipment hotline 18005550102",
  ])("%j", (text) => {
    expect(numbers(text)).toEqual([]);
    expect(numbers(text, "dhl")).toEqual([]);
  });

  it("rejects an international phone number that passes FedEx 12", () => {
    expect(numbers("FedEx UK tracking support +44 20 7946 0008", "fedex")).toEqual([]);
  });
});

describe("randomized false-positive checks", () => {
  // Deterministic LCG so failures are reproducible.
  function rng(seed: number) {
    let x = seed;
    return (n: number) => {
      x = (x * 1103515245 + 12345) % 2147483648;
      return x % n;
    };
  }
  const digits = (next: (n: number) => number, len: number) =>
    Array.from({ length: len }, (_, i) => String(i === 0 ? 1 + next(9) : next(10))).join("");

  it("numbers behind order/invoice/SKU/phone labels never match, even right after a tracking keyword", () => {
    const next = rng(42);
    const labels = [
      "Order #", "Order number:", "Invoice", "SKU", "Item #", "Account", "Ref:", "Card", "Call", "Phone:",
      "Gift card", "Case #", "Claim number", "RMA", "Promo code",
    ];
    const hints = ["fedex", "dhl", "usps", "ups"] as const;
    for (let i = 0; i < 600; i++) {
      const label = labels[next(labels.length)];
      const n = digits(next, 10 + next(11)); // 10..20 digits
      const text = `Track your shipment with FedEx or DHL. ${label} ${n}`;
      expect(findTrackingNumbers(text, { carrierHint: hints[next(hints.length)] }), text).toEqual([]);
    }
  });

  it("formatted phone numbers never match", () => {
    const next = rng(7);
    for (let i = 0; i < 600; i++) {
      const a = digits(next, 3), b = digits(next, 3), c = digits(next, 4);
      const shapes = [`(${a}) ${b}-${c}`, `${a}-${b}-${c}`, `1-${a}-${b}-${c}`, `+1 ${a} ${b} ${c}`, `${a}.${b}.${c}`, `${a} ${b} ${c}`];
      const phone = shapes[next(shapes.length)];
      const text = `DHL Express shipment tracking help: ${phone}`;
      expect(findTrackingNumbers(text, { carrierHint: "dhl" }), text).toEqual([]);
    }
  });
});

describe("realistic emails", () => {
  const ORDER_CONFIRMATION = `
Thanks for your order, Jamie!
Order #123456789012 placed Oct 8, 2026 · Amazon order 113-1234567-1234567
We'll email you tracking information as soon as your order ships.

Item: Trail Runner 2 (SKU 100234567890)    Qty: 2    $129.99
Item: Wool Socks 3-pack (Model 3318810025)    Qty: 1    $24.00
Subtotal: $283.98   Shipping: $0.00   Tax: $23.43   Total: $1,307.41
Invoice no. 100234567890005 · Transaction ID 12345678901234567890
Paid with Visa ending in 4242. Gift card 6006 4912 3456 7890 123.

Shipping to: Jamie Doe, 24 Willie Mays Plaza, San Francisco, CA 94107-1234
Delivery estimate: Oct 12 - Oct 14, 2026

Questions about your shipment? Call us at 1-800-555-0102 or (312) 555-0105,
text 312.555.0105, or +44 20 7946 0008 from the UK. Mon-Fri 8am-8pm PT.
Store #2291, 1200 Market St, Suite 400, San Francisco CA 94103.

View your order: https://www.example-store.com/account/orders/123456789012?utm_source=email
Manage preferences: https://www.example-store.com/unsubscribe?u=98765432101234&id=60120172242323
© 2026 Example Store Inc. All rights reserved.
`;

  it("an order confirmation full of numbers produces no tracking numbers", () => {
    expect(findTrackingNumbers(ORDER_CONFIRMATION)).toEqual([]);
  });

  it.each(["fedex", "dhl", "usps", "ups", "amazon"] as const)(
    "...even with carrierHint %s",
    (hint) => {
      expect(findTrackingNumbers(ORDER_CONFIRMATION, { carrierHint: hint })).toEqual([]);
    },
  );

  it("reads a USPS Informed Delivery digest", () => {
    const digest = `
Informed Delivery® Daily Digest
COMING TO YOUR MAILBOX SOON
Expected Delivery Today
FROM: EXAMPLE OUTFITTERS CO
Tracking Number: 9400 1118 9922 3197 4284 97
Track Package: https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223197428497&utm_source=alertxdd
Expected Delivery Tomorrow
FROM: ACME WIDGETS
Tracking Number: 92748931507708513018050063
Questions? Call 1-800-555-0102.
`;
    expect(findTrackingNumbers(digest, { carrierHint: "usps" })).toEqual([
      {
        trackingNumber: "9400111899223197428497",
        carrier: "usps",
        format: "USPS IMpb (22 digits)",
        checksumValid: true,
      },
      {
        trackingNumber: "92748931507708513018050063",
        carrier: "usps",
        format: "USPS IMpb (26 digits)",
        checksumValid: true,
      },
    ]);
  });

  it("reads a FedEx Delivery Manager email (number only in the body, links are opaque)", () => {
    const fedex = `
Hi, Testy. There is a delay with your package from Acme Widgets Fulfillment.
SCHEDULED DELIVERY
Pending
TRACKING NUMBER
777123456784
REFERENCE
113-2208711-1430629
http://click.message.fedex.com/?qs=8a7f6e5d4c3b2a1908f7e6d5c4b3a2918
Customer Service 1-800-555-0102
`;
    expect(numbers(fedex, "fedex")).toEqual(["fedex:777123456784"]);
  });

  it("reads a UPS My Choice email", () => {
    const ups = `
Hi TestUser, you have a package coming today.
Estimated Delivery Date: Monday,  05/18/2020
Estimated Delivery Time: 02:30 PM  -  06:30 PM
Tracking Number: 1Z999AA10123456784
https://www.ups.com/track?loc=en_US&Requester=SBN&tracknum=1Z999AA10123456784&AgreeToTermsAndConditions=yes
`;
    expect(numbers(ups, "ups")).toEqual(["ups:1Z999AA10123456784"]);
  });
});

describe("dedupe and order", () => {
  it("returns each number once, in order of first appearance", () => {
    const text = [
      "Tracking: 1Z999AA10123456784",
      "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223197428497",
      "USPS: 9400 1118 9922 3197 4284 97",
      "Again: https://www.ups.com/track?tracknum=1Z999AA10123456784",
      "Barcode 420 94107 9400 1118 9922 3197 4284 97", // 420+ZIP form of the same USPS PIC
    ].join("\n");
    expect(numbers(text)).toEqual(["ups:1Z999AA10123456784", "usps:9400111899223197428497"]);
  });

  it("prefers a specific carrier over 'unknown' for the same number", () => {
    const text = [
      "https://acme.narvar.com/acme/tracking?tracking_numbers=60120172242323",
      "DHL tracking number: 60120172242323",
    ].join("\n");
    expect(findTrackingNumbers(text)).toEqual([
      {
        trackingNumber: "60120172242323",
        carrier: "dhl_ecommerce",
        format: "DHL eCommerce (14 digits)",
        checksumValid: null,
      },
    ]);
  });

  it("returns an empty list for empty input", () => {
    expect(findTrackingNumbers("")).toEqual([]);
  });
});
