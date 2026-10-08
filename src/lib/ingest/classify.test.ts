import { describe, expect, it } from "vitest";
import { classifyEmail, classifySender } from "./classify";

describe("classifySender", () => {
  it.each([
    ["USPSInformeddelivery@email.informeddelivery.usps.com", "usps_digest"],
    ["uspsinformeddelivery@informeddelivery.usps.com", "usps_digest"],
    ["USPSInformedDelivery@usps.gov", "usps_digest"],
    ["auto-reply@usps.com", "usps_alert"],
    ["auto-reply@tracking.usps.com", "usps_alert"],
    ["mcinfo@ups.com", "ups"],
    ["pkginfo@ups.com", "ups"],
    ["ups@ups.com", "ups"],
    ["TrackingUpdates@fedex.com", "fedex"],
    ["fedexcanada@fedex.com", "fedex"],
    ["shipment-tracking@amazon.com", "amazon"],
    ["order-update@amazon.co.uk", "amazon"],
    ["conferma-spedizione@amazon.it", "amazon"],
    ["NoReply.ODD@dhl.com", "dhl"],
    ["noreply@dhl.de", "dhl"],
  ])("%s -> %s", (from, kind) => {
    expect(classifySender(from)).toBe(kind);
  });

  it.each([
    "sam@gmail.com",
    "mcinfo@ups.com.evil.net",
    "fedex@not-fedex.com",
    "shipment-tracking@amazon.com.phish.example",
    "orders@shop.example",
    "",
    "no-at-sign",
  ])("%s -> null", (from) => {
    expect(classifySender(from)).toBeNull();
  });

  it("does not confuse usps.com with ups.com", () => {
    expect(classifySender("auto-reply@usps.com")).toBe("usps_alert");
    expect(classifySender("x@ups.com")).toBe("ups");
  });
});

describe("classifyEmail", () => {
  it("falls back to carrier-template subjects when the sender is unknown", () => {
    expect(classifyEmail("sam@gmail.com", "Your Daily Digest for Thu, 10/8 is ready to view")).toBe("usps_digest");
    expect(classifyEmail("sam@gmail.com", "USPS® Item Delivered, Front Door/Porch 9400111899223197428497")).toBe("usps_alert");
    expect(classifyEmail("sam@gmail.com", "UPS Update: Package Scheduled for Delivery Today")).toBe("ups");
    expect(classifyEmail("sam@gmail.com", "FedEx Shipment 398765432103: Your package is on its way")).toBe("fedex");
    expect(classifyEmail("sam@gmail.com", 'Shipped: "Example Widget..."')).toBe("amazon");
    expect(classifyEmail("sam@gmail.com", "Delivered: Your Amazon.com order #111-1111111-1111111")).toBe("amazon");
    expect(classifyEmail("sam@gmail.com", "DHL On Demand Delivery")).toBe("dhl");
  });

  it("returns null for anything else", () => {
    expect(classifyEmail("orders@shop.example", "Your order has shipped!")).toBeNull();
    expect(classifyEmail("sam@gmail.com", "Lunch?")).toBeNull();
  });

  it("lets the sender win over the subject", () => {
    expect(classifyEmail("mcinfo@ups.com", "Your Daily Digest for Thu, 10/8")).toBe("ups");
  });
});
