import { describe, expect, it } from "vitest";
import { CARRIER_NAMES, carrierFromHost, carrierFromWord, carriersMentioned, trackingUrl } from "./carriers";

describe("CARRIER_NAMES", () => {
  it("names every carrier id", () => {
    expect(CARRIER_NAMES).toEqual({
      usps: "USPS",
      ups: "UPS",
      fedex: "FedEx",
      dhl: "DHL",
      amazon: "Amazon",
      ontrac: "OnTrac",
      unknown: "Unknown carrier",
    });
  });
});

describe("trackingUrl", () => {
  it.each([
    ["usps", "9400111206206406260787", "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111206206406260787"],
    [
      "ups",
      "1Z999AA10123456784",
      "https://www.ups.com/track?loc=en_US&tracknum=1Z999AA10123456784&requester=ST/trackdetails",
    ],
    ["fedex", "986578788855", "https://www.fedex.com/fedextrack/?trknbr=986578788855"],
    [
      "dhl",
      "3318810025",
      "https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=3318810025",
    ],
    ["amazon", "TBA305938274011", "https://track.amazon.com/tracking/TBA305938274011"],
    ["ontrac", "C11031500001879", "https://www.ontrac.com/tracking/?number=C11031500001879"],
  ] as const)("%s -> official tracking page", (carrier, number, url) => {
    expect(trackingUrl(carrier, number)).toBe(url);
  });

  it("returns null for an unknown carrier", () => {
    expect(trackingUrl("unknown", "1Z999AA10123456784")).toBeNull();
  });

  it("returns null for an empty number", () => {
    expect(trackingUrl("usps", "  ")).toBeNull();
  });

  it("URI-encodes the number", () => {
    expect(trackingUrl("amazon", "A B/C&D?")).toBe("https://track.amazon.com/tracking/A%20B%2FC%26D%3F");
    expect(trackingUrl("fedex", "1&evil=1")).toBe("https://www.fedex.com/fedextrack/?trknbr=1%26evil%3D1");
  });
});

describe("carrierFromHost", () => {
  it.each([
    ["tools.usps.com", "usps"],
    ["www.ups.com", "ups"],
    ["wwwapps.ups.com", "ups"],
    ["www.fedex.com", "fedex"],
    ["www.dhl.com", "dhl"],
    ["webtrack.dhlecs.com", "dhl"],
    ["track.amazon.com", "amazon"],
    ["www.ontrac.com", "ontrac"],
    ["t.lasership.com", "ontrac"],
    ["WWW.UPS.COM.", "ups"],
  ])("%s -> %s", (host, carrier) => {
    expect(carrierFromHost(host)).toBe(carrier);
  });

  it.each(["www.amazon.com", "ups.com.evil.example", "notups.com", "example.com"])("%s -> null", (host) => {
    expect(carrierFromHost(host)).toBeNull();
  });
});

describe("carriersMentioned / carrierFromWord", () => {
  it("finds carrier names in text", () => {
    expect([...carriersMentioned("Shipped with FedEx, then UPS and the U.S. Postal Service")].sort()).toEqual([
      "fedex",
      "ups",
      "usps",
    ]);
  });

  it("does not read 'follow-ups' as UPS", () => {
    expect(carriersMentioned("We'll send follow-ups by email").size).toBe(0);
  });

  it("maps single words to carriers", () => {
    expect(carrierFromWord("FedEx")).toBe("fedex");
    expect(carrierFromWord("lasership")).toBe("ontrac");
    expect(carrierFromWord("veho")).toBeNull();
  });
});
