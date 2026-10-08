import { describe, expect, it } from "vitest";
import { findTrackingNumbers } from "./extract";
import { findLinks, linkCandidates } from "./links";

const numbers = (text: string, hint?: Parameters<typeof findTrackingNumbers>[1]) =>
  findTrackingNumbers(text, hint).map((r) => `${r.carrier}:${r.trackingNumber}`);

describe("tracking links per carrier", () => {
  it.each([
    // USPS
    ["https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111206206406260787", "usps:9400111206206406260787"],
    [
      "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223197428497&utm_source=outfordelivery&utm_medium=email",
      "usps:9400111899223197428497",
    ],
    ["https://tools.usps.com/go/TrackConfirmAction_input?origTrackNum=9261292700768711948021", "usps:9261292700768711948021"],
    ["https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=9505511069605048600624", "usps:9505511069605048600624"],
    // UPS (current, with the "/trackdetails" suffix inside the value, and legacy forms)
    ["https://www.ups.com/track?loc=en_US&tracknum=1Z999AA10123456784&requester=ST/trackdetails", "ups:1Z999AA10123456784"],
    ["https://www.ups.com/track?loc=en_US&requester=QUIC&tracknum=1Z999AA10123456784/trackdetails", "ups:1Z999AA10123456784"],
    ["https://wwwapps.ups.com/WebTracking/track?track=yes&trackNums=1Z5R89390357567127", "ups:1Z5R89390357567127"],
    [
      "https://wwwapps.ups.com/WebTracking/processInputRequest?sort_by=status&InquiryNumber1=1Z879E930346834440",
      "ups:1Z879E930346834440",
    ],
    // FedEx: 12 digits are accepted with no keyword because they sit in a tracking link
    ["https://www.fedex.com/fedextrack/?trknbr=986578788855", "fedex:986578788855"],
    ["https://www.fedex.com/apps/fedextrack/?action=track&tracknumbers=041441760228964", "fedex:041441760228964"],
    // DHL
    [
      "https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=3318810025",
      "dhl:3318810025",
    ],
    ["http://www.dhl.com/en/express/tracking.html?brand=DHL&AWB=73891051146", "dhl:73891051146"],
    ["https://webtrack.dhlecs.com/?trackingnumber=GM2951173225174494", "dhl:GM2951173225174494"],
    // Amazon
    ["https://track.amazon.com/tracking/TBA305938274011", "amazon:TBA305938274011"],
    // OnTrac / LaserShip
    ["https://www.ontrac.com/tracking/?number=D10011354453707", "ontrac:D10011354453707"],
    ["http://www.ontrac.com/trackingres.asp?tracking_number=C11031500001879", "ontrac:C11031500001879"],
    ["https://t.lasership.com/Track/1LS717793482164", "ontrac:1LS717793482164"],
  ])("%s", (url, expected) => {
    expect(numbers(`Track your package: ${url}`)).toEqual([expected]);
  });

  it("reads several comma-separated numbers from one parameter", () => {
    expect(
      numbers("https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111206206406260787%2C9261292700768711948021"),
    ).toEqual(["usps:9400111206206406260787", "usps:9261292700768711948021"]);
  });

  it("reads a grouped number with encoded spaces", () => {
    expect(numbers("https://tools.usps.com/go/TrackConfirmAction?tLabels=9400+1118+9922+3197+4284+97")).toEqual([
      "usps:9400111899223197428497",
    ]);
  });

  it("decodes &amp; in raw HTML hrefs", () => {
    const html = '<a href="https://www.ups.com/track?loc=en_US&amp;tracknum=1Z999AA10123456784&amp;requester=ST">Track</a>';
    expect(numbers(html)).toEqual(["ups:1Z999AA10123456784"]);
  });

  it("accepts a DHL eCommerce 14-digit number only from a DHL link", () => {
    expect(numbers("https://www.dhl.com/us-en/home/tracking.html?tracking-id=60120172242323")).toEqual([
      "dhl:60120172242323",
    ]);
  });
});

describe("redirect wrappers", () => {
  it("unwraps Google redirect links (?q=)", () => {
    const url =
      "https://www.google.com/url?q=https%3A%2F%2Fwww.ups.com%2Ftrack%3Floc%3Den_US%26tracknum%3D1Z999AA10123456784&sa=D";
    expect(numbers(url)).toEqual(["ups:1Z999AA10123456784"]);
  });

  it("unwraps Outlook Safe Links (?url=)", () => {
    const url =
      "https://nam12.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.fedex.com%2Ffedextrack%2F%3Ftrknbr%3D986578788855&data=05%7C01&reserved=0";
    expect(numbers(url)).toEqual(["fedex:986578788855"]);
  });

  it("unwraps Proofpoint URL Defense v3 links", () => {
    const url = "https://urldefense.com/v3/__https://www.fedex.com/fedextrack/?trknbr=986578788855__;!!ABCD!xyz$";
    expect(numbers(url)).toEqual(["fedex:986578788855"]);
  });

  it("unwraps click trackers that embed the encoded target in the path", () => {
    const url =
      "https://abc123.r.us-east-1.awstrack.me/L0/https:%2F%2Fwww.dhl.com%2Fus-en%2Fhome%2Ftracking%2Ftracking-express.html%3Fsubmit=1%26tracking-id=3318810025/1/0100abc";
    expect(numbers(url)).toEqual(["dhl:3318810025"]);
  });
});

describe("branded tracking pages", () => {
  it("takes the carrier from the path of a Narvar page", () => {
    expect(numbers("https://acme.narvar.com/acme/tracking/fedex?tracking_numbers=986578788855")).toEqual([
      "fedex:986578788855",
    ]);
  });

  it("returns an unrecognized number from a named tracking parameter as an unknown carrier", () => {
    expect(findTrackingNumbers("https://acme.narvar.com/acme/tracking/veho?tracking_numbers=VH12345678AB")).toEqual([
      {
        trackingNumber: "VH12345678AB",
        carrier: "unknown",
        format: "Unrecognized format (from a tracking link)",
        checksumValid: null,
      },
    ]);
  });

  it("reads AfterShip paths", () => {
    expect(numbers("https://acme.aftership.com/TBA305938274011")).toEqual(["amazon:TBA305938274011"]);
  });
});

describe("links that are not tracking links", () => {
  it("ignores long IDs in ordinary links", () => {
    const text = [
      "https://www.example-store.com/p/123456789012?ref=email",
      "https://www.example-store.com/orders?number=986578788855",
      "https://click.e.example-store.com/?qs=3318810025a7f1c0de",
      "https://www.amazon.com/progress-tracker/package/ref=pe?_encoding=UTF8&itemId=jkmlpqrst&orderId=113-1234567-1234567&packageIndex=0&shipmentId=Dq7Lm9",
      "https://www.example-store.com/unsubscribe?u=98765432101234&id=60120172242323",
    ].join("\n");
    expect(findTrackingNumbers(text)).toEqual([]);
  });

  it("still finds a distinctive number in any link", () => {
    expect(numbers("https://shop.example.com/orders/123/shipment?tn=1Z999AA10123456784")).toEqual([
      "ups:1Z999AA10123456784",
    ]);
  });

  it("drops a number with a failing check digit even in a carrier link", () => {
    expect(findTrackingNumbers("https://www.ups.com/track?tracknum=1Z999AA10123456785")).toEqual([]);
    expect(findTrackingNumbers("https://www.fedex.com/fedextrack/?trknbr=986578788856")).toEqual([]);
  });

  it("does not trust a generic ?number= on a non-carrier host", () => {
    expect(findTrackingNumbers("https://shop.example.com/track?number=ZX12345678AB")).toEqual([]);
  });
});

describe("findLinks / linkCandidates", () => {
  it("reports offsets without trailing punctuation", () => {
    const text = "See (https://track.amazon.com/tracking/TBA305938274011).";
    const [link] = findLinks(text);
    expect(text.slice(link.start, link.end)).toBe("https://track.amazon.com/tracking/TBA305938274011");
  });

  it("handles bare www. links", () => {
    expect(numbers("www.fedex.com/fedextrack/?trknbr=986578788855")).toEqual(["fedex:986578788855"]);
  });

  it("labels where each value came from", () => {
    const c = linkCandidates("https://www.ups.com/track?loc=en_US&tracknum=1Z999AA10123456784/trackdetails");
    expect(c).toContainEqual({ value: "1Z999AA10123456784", source: "param", urlCarrier: "ups" });
    expect(c.some((x) => x.value === "en_US")).toBe(false); // no digits
  });

  it("ignores unparseable links", () => {
    expect(linkCandidates("https://")).toEqual([]);
  });
});
