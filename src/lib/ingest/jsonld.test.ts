import { describe, expect, it } from "vitest";
import { carrierFromName, draftsFromMarkup, parcelsFromJsonLd, parcelsFromMicrodata } from "./jsonld";
import { parseEmail } from "./parse";
import { makeEmail } from "./test-helpers";

/** Gmail-style ParcelDelivery markup (research/email.md §1b), fake values. */
const PARCEL = {
  "@context": "http://schema.org",
  "@type": "ParcelDelivery",
  deliveryAddress: { "@type": "PostalAddress", name: "Jane Doe", postalCode: "00000" },
  expectedArrivalFrom: "2026-10-12T08:00:00-07:00",
  expectedArrivalUntil: "2026-10-12T20:00:00-07:00",
  carrier: { "@type": "Organization", name: "FedEx", url: "https://www.fedex.com/" },
  trackingNumber: "986578788855",
  trackingUrl: "https://www.fedex.com/fedextrack/?trknbr=986578788855",
  potentialAction: { "@type": "TrackAction", target: "https://www.fedex.com/fedextrack/?trknbr=986578788855" },
  itemShipped: { "@type": "Product", name: "Example Streaming Stick" },
  partOfOrder: {
    "@type": "Order",
    orderNumber: "176057",
    orderStatus: "http://schema.org/OrderInTransit",
    merchant: { "@type": "Organization", name: "Example Store" },
  },
};

const ldScript = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

describe("JSON-LD", () => {
  it("reads a ParcelDelivery object", () => {
    expect(draftsFromMarkup(`<html><head>${ldScript(PARCEL)}</head><body>Hi</body></html>`)).toEqual([
      {
        carrier: "fedex",
        trackingNumber: "986578788855",
        orderRef: "176057",
        shipper: "Example Store",
        description: "Example Streaming Stick",
        status: "in_transit",
        expectedDelivery: "2026-10-12",
        expectedWindow: "8:00 AM - 8:00 PM",
        deliveredAt: null,
      },
    ]);
  });

  it("walks arrays, @graph and ParcelDelivery nested under Order.orderedItem[].orderDelivery", () => {
    const nested = {
      "@context": "https://schema.org",
      "@type": "Order",
      orderNumber: "A-77",
      seller: { "@type": "Organization", name: "Northwind" },
      orderedItem: [
        {
          "@type": "OrderItem",
          orderDelivery: {
            "@type": "ParcelDelivery",
            provider: "UPS",
            trackingNumber: "1Z 999 AA1 01 2345 6784",
            expectedArrivalUntil: "2026-10-14",
          },
        },
      ],
    };
    const html = ldScript([{ "@type": "WebPage" }]) + ldScript({ "@graph": [nested] });
    expect(draftsFromMarkup(html)).toEqual([
      expect.objectContaining({
        carrier: "ups",
        trackingNumber: "1Z999AA10123456784",
        orderRef: "A-77",
        shipper: "Northwind",
        expectedDelivery: "2026-10-14",
        expectedWindow: null,
      }),
    ]);
  });

  it("accepts an order-only ParcelDelivery and https://schema.org/ types", () => {
    const html = ldScript({
      "@type": "https://schema.org/ParcelDelivery",
      partOfOrder: { "@type": "Order", orderNumber: "113-1234567-1234567", seller: "Amazon.com", orderStatus: "OrderDelivered" },
    });
    expect(draftsFromMarkup(html)).toEqual([
      expect.objectContaining({ carrier: "amazon", trackingNumber: null, orderRef: "113-1234567-1234567", status: "delivered" }),
    ]);
  });

  it("skips broken JSON, nodes without numbers and unrelated types", () => {
    const html =
      `<script type="application/ld+json">{ not json </script>` +
      ldScript({ "@type": "ParcelDelivery", carrier: "FedEx" }) +
      ldScript({ "@type": "Product", name: "Thing" });
    expect(parcelsFromJsonLd(html)).toHaveLength(1);
    expect(draftsFromMarkup(html)).toEqual([]);
  });

  it("survives deeply nested input", () => {
    let deep: unknown = { "@type": "ParcelDelivery", trackingNumber: "986578788855" };
    for (let i = 0; i < 50; i++) deep = { child: deep };
    expect(() => draftsFromMarkup(ldScript(deep))).not.toThrow();
  });
});

describe("microdata", () => {
  const MICRO = `<div itemscope itemtype="http://schema.org/ParcelDelivery">
  <div itemprop="deliveryAddress" itemscope itemtype="http://schema.org/PostalAddress">
    <meta itemprop="postalCode" content="00000"/>
  </div>
  <meta itemprop="expectedArrivalUntil" content="2026-10-12T20:00:00-07:00"/>
  <div itemprop="carrier" itemscope itemtype="http://schema.org/Organization"><meta itemprop="name" content="FedEx"/></div>
  <span>Tracking: <span itemprop="trackingNumber">9865 7878 8855</span></span>
  <link itemprop="trackingUrl" href="https://www.fedex.com/fedextrack/?trknbr=986578788855"/>
  <div itemprop="itemShipped" itemscope itemtype="http://schema.org/Product"><meta itemprop="name" content="Example Streaming Stick"/></div>
  <div itemprop="partOfOrder" itemscope itemtype="http://schema.org/Order">
    <meta itemprop="orderNumber" content="176057"/>
    <div itemprop="merchant" itemscope itemtype="http://schema.org/Organization"><meta itemprop="name" content="Example &amp; Co"/></div>
  </div>
</div>`;

  it("reads ParcelDelivery microdata (meta, link, text values, nested items)", () => {
    expect(parcelsFromMicrodata(MICRO)).toEqual([
      {
        trackingNumber: "9865 7878 8855",
        carrierName: "FedEx",
        deliveryMethod: null,
        trackingUrl: "https://www.fedex.com/fedextrack/?trknbr=986578788855",
        expectedArrivalFrom: null,
        expectedArrivalUntil: "2026-10-12T20:00:00-07:00",
        deliveryStatus: null,
        orderNumber: "176057",
        orderStatus: null,
        itemNames: ["Example Streaming Stick"],
        sellerName: "Example & Co",
      },
    ]);
    expect(draftsFromMarkup(MICRO)).toMatchObject([{ carrier: "fedex", trackingNumber: "986578788855", shipper: "Example & Co" }]);
  });

  it("ignores pages without ParcelDelivery items", () => {
    expect(parcelsFromMicrodata('<div itemscope itemtype="http://schema.org/Product"><span itemprop="name">x</span></div>')).toEqual([]);
  });
});

describe("markup in parseEmail", () => {
  it("makes a generic email with markup a shipment", () => {
    const parsed = parseEmail(
      makeEmail({ from: "orders@store.example", fromName: "Example Store", subject: "Your order shipped", html: ldScript(PARCEL) + "<p>Thanks!</p>" }),
    );
    expect(parsed.kind).toBe("generic");
    expect(parsed.updates).toMatchObject([{ carrier: "fedex", trackingNumber: "986578788855", orderRef: "176057", expectedDelivery: "2026-10-12" }]);
  });

  it("overrides what the text says for the same tracking number", () => {
    const parsed = parseEmail(
      makeEmail({
        from: "mcinfo@ups.com",
        subject: "UPS Update: Package Scheduled for Delivery Tomorrow",
        text: "Scheduled Delivery: Friday 10/09/2026\nTracking Number: 1Z999AA10123456784",
        html: ldScript({ "@type": "ParcelDelivery", provider: { name: "UPS" }, trackingNumber: "1Z999AA10123456784", expectedArrivalUntil: "2026-10-10" }),
      }),
    );
    expect(parsed.updates).toMatchObject([{ trackingNumber: "1Z999AA10123456784", expectedDelivery: "2026-10-10", status: "in_transit" }]);
  });
});

describe("carrierFromName", () => {
  it.each([
    ["FedEx", "fedex"],
    ["http://purl.org/goodrelations/v1#FederalExpress", "fedex"],
    ["http://purl.org/goodrelations/v1#UPS", "ups"],
    ["United States Postal Service", "usps"],
    ["USPS", "usps"],
    ["DHL Express", "dhl"],
    ["Amazon Logistics", "amazon"],
    ["LaserShip", "ontrac"],
    ["Royal Mail", null],
    [null, null],
  ])("%s -> %s", (name, carrier) => {
    expect(carrierFromName(name)).toBe(carrier);
  });
});
