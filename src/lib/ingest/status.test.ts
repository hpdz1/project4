import { describe, expect, it } from "vitest";
import { combineStatus, statusFromSchema, statusFromText } from "./status";

describe("statusFromText", () => {
  it.each([
    // never "delivered"
    ["UPS Update: Package Scheduled for Delivery Tomorrow", "in_transit"],
    ["Scheduled Delivery: Friday 10/09/2026", "in_transit"],
    ["USPS® Expected Delivery on Saturday, October 10, 2026", "in_transit"],
    ["Your package will be delivered on Monday", "in_transit"],
    ["Estimated delivery: Oct 12", "in_transit"],
    // delivered
    ["Delivered: Your Amazon.com order #111-1111111-1111111", "delivered"],
    ["Your package has been delivered!", "delivered"],
    ["Your shipment was delivered 398765432103", "delivered"],
    ["Your UPS Packages were delivered", "delivered"],
    ["USPS® Item Delivered, Front Door/Porch 9400111899223197428497", "delivered"],
    ["UPS Update: Package Delivered", "delivered"],
    ["Your Amazon order has arrived!", "delivered"],
    ["DHL Shipment Notification - Delivered - SPRINGFIELD", "delivered"],
    // out for delivery
    ["Your item is out for delivery on October 8, 2026", "out_for_delivery"],
    ["Arriving today", "out_for_delivery"],
    ["Arriving Today: A one-time password is required for your Amazon delivery", "out_for_delivery"],
    ["UPS Update: Package Scheduled for Delivery Today", "out_for_delivery"],
    ["FedEx Shipment 398765432103: Your package is now out for delivery today", "out_for_delivery"],
    ["Your Delivery Is Today", "out_for_delivery"],
    ["UPS Update: Follow Your Delivery on a Live Map", "out_for_delivery"],
    ["Your package with 1 item will be delivered today.", "out_for_delivery"],
    // exception
    ["USPS® Delivery Exception 9205590199999999999905", "exception"],
    ["FedEx Delivery Exception", "exception"],
    ["Your package is on the way but running late.", "exception"],
    ["There is a delay with your package from Acme Widgets Fulfillment.", "exception"],
    ["We attempted delivery but nobody was home", "exception"],
    ["UPS Update: Delivery Attempted", "exception"],
    ["We were unable to deliver your package", "exception"],
    ["Your package could not be delivered", "exception"],
    ["Your shipment has been delayed", "exception"],
    // pickup
    ["USPS® Available for Pickup", "available_for_pickup"],
    ["Your package is ready for pickup at the UPS Access Point", "available_for_pickup"],
    ["You have a package to pick up at the Apartment Hub - 123456", "available_for_pickup"],
    // pre-transit
    ["Shipping label created, USPS awaiting item", "pre_transit"],
    ["Shipment information sent to FedEx", "pre_transit"],
    ["Pre-Shipment Info Sent to USPS", "pre_transit"],
    ["Ordered: \"Example Widget 2-Pack...\"", "pre_transit"],
    ["Your item has not yet shipped", "pre_transit"],
    // in transit
    ["Shipped: \"Example Widget 2-Pack...\"", "in_transit"],
    ["Your package is in transit", "in_transit"],
    ["Your package is on its way", "in_transit"],
    ["Good news! Your order is on the way.", "in_transit"],
    ["Your Amazon.co.uk order has been dispatched", "in_transit"],
    // return
    ["Your package is being returned to the sender", "return_to_sender"],
    ["Return to Sender: address unknown", "return_to_sender"],
  ])("%j -> %s", (text, expected) => {
    expect(statusFromText(text)).toBe(expected);
  });

  it.each([
    "",
    "Track your package anytime with the UPS app",
    "Get your package delivered to a UPS Access Point near you",
    "Delivery dates may vary during the holidays",
    "Order confirmation details",
  ])("says nothing for %j", (text) => {
    expect(statusFromText(text)).toBeNull();
  });
});

describe("combineStatus", () => {
  it("lets the subject decide unless it is vague and the body is more specific", () => {
    expect(combineStatus("in_transit", "out_for_delivery")).toBe("out_for_delivery");
    expect(combineStatus("in_transit", "exception")).toBe("exception");
    expect(combineStatus("delivered", "in_transit")).toBe("delivered");
    expect(combineStatus("out_for_delivery", "delivered")).toBe("out_for_delivery");
    expect(combineStatus(null, "in_transit")).toBe("in_transit");
    expect(combineStatus("pre_transit", "in_transit")).toBe("pre_transit");
    expect(combineStatus(null, null)).toBeNull();
  });
});

describe("statusFromSchema", () => {
  it("maps schema.org OrderStatus values", () => {
    expect(statusFromSchema("http://schema.org/OrderInTransit")).toBe("in_transit");
    expect(statusFromSchema("https://schema.org/OrderDelivered")).toBe("delivered");
    expect(statusFromSchema("OrderPickupAvailable")).toBe("available_for_pickup");
    expect(statusFromSchema("OrderProblem")).toBe("exception");
    expect(statusFromSchema("OrderReturned")).toBe("return_to_sender");
    expect(statusFromSchema("Out for delivery")).toBe("out_for_delivery");
    expect(statusFromSchema(null)).toBeNull();
  });
});
