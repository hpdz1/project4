import { describe, expect, it } from "vitest";
import { parseEmail } from "../parse";
import { makeEmail } from "../test-helpers";

const DATE = { date: "2026-10-08T12:00:00.000Z", headers: { date: "Thu, 08 Oct 2026 08:00:00 -0400" } };
const DHL = { from: "noreply.odd@dhl.com", fromName: "DHL EXPRESS", subject: "DHL On Demand Delivery", ...DATE };

describe("DHL", () => {
  it("parses an On Demand Delivery 'today' email from the body", () => {
    const text = `Your Delivery Is Today
Hello TESTY EXAMPLE,
Your DHL Express shipment with waybill number 1234567891 from EXAMPLE OUTFITTERS CO is scheduled for delivery TODAY by End of Day.
Waybill No.
1234567891`;
    const parsed = parseEmail(makeEmail({ ...DHL, text }));
    expect(parsed.kind).toBe("dhl");
    expect(parsed.updates).toEqual([
      {
        carrier: "dhl",
        trackingNumber: "1234567891",
        orderRef: null,
        shipper: "EXAMPLE OUTFITTERS CO",
        description: null,
        status: "out_for_delivery",
        expectedDelivery: "2026-10-08",
        expectedWindow: "by end of day",
        deliveredAt: null,
        eventAt: DATE.date,
        source: "dhl",
      },
    ]);
  });

  it("parses a delivered email", () => {
    const parsed = parseEmail(
      makeEmail({ ...DHL, text: "Your DHL Express shipment with waybill number 4242424244 has been delivered.\nWaybill No. 4242424244" }),
    );
    expect(parsed.updates).toMatchObject([{ trackingNumber: "4242424244", status: "delivered", expectedDelivery: null }]);
  });

  it("ignores a waybill with a failing check digit", () => {
    const parsed = parseEmail(makeEmail({ ...DHL, text: "Your Delivery Is Today\nWaybill No. 1234567890" }));
    expect(parsed.updates).toEqual([]);
  });
});
