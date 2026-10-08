import { describe, expect, it } from "vitest";
import type { CarrierId } from "@/lib/types";
import { detectTrackingNumber } from "./formats";
import { normalizeTrackingNumber } from "./normalize";

// Every "valid" number below was checked with an independent Python
// implementation of the research algorithms; each "invalid" one is a valid
// number with one digit changed. Repo fixtures come from
// jkeen/tracking_number_data v2.0.0 (many are synthetic).

describe("normalizeTrackingNumber", () => {
  it("uppercases and strips whitespace, dashes and dots", () => {
    expect(normalizeTrackingNumber(" 1z 5r8-939.03 ")).toBe("1Z5R893903");
    expect(normalizeTrackingNumber("9400\u00A01118\u20139922 3197\t4284 97")).toBe("9400111899223197428497");
  });

  it("strips zero-width characters that templates insert", () => {
    expect(normalizeTrackingNumber("9400\u200B1118\u200D9922")).toBe("940011189922");
  });
});

const CHECKSUM_VALID: [input: string, carrier: CarrierId, format: string][] = [
  ["1Z5R89390357567127", "ups", "UPS 1Z"],
  ["1Z879E930346834440", "ups", "UPS 1Z"],
  ["1ZXX3150YW44070023", "ups", "UPS 1Z"], // SurePost (service YW)
  ["1Z999AA10123456784", "ups", "UPS 1Z"],
  ["K2479825491", "ups", "UPS waybill"],
  ["9400111206206406260787", "usps", "USPS IMpb (22 digits)"], // AI 94
  ["9261292700768711948021", "usps", "USPS IMpb (22 digits)"], // AI 92 (incl. FedEx SmartPost)
  ["9361289878700317633795", "usps", "USPS IMpb (22 digits)"], // AI 93
  ["9505511069605048600624", "usps", "USPS IMpb (22 digits)"], // AI 95 retail
  ["9212391234567812345670", "usps", "USPS IMpb (22 digits)"], // Pub 199 §4.6 example
  ["92748931507708513018050063", "usps", "USPS IMpb (26 digits)"],
  // Pub 199 N10 (AI 94 + Source ID 12): rejected by tracking_number_data, accepted per the fact-check.
  ["940011291234567812345678901233", "usps", "USPS IMpb (30 digits)"],
  ["9101123456789000000013", "usps", "USPS legacy (22 digits)"],
  ["03071790000523483741", "usps", "USPS (20 digits)"],
  ["71969010756003077385", "usps", "USPS (20 digits)"], // valid only with the implied "91"
  ["RB123456785US", "usps", "UPU S10 international mail"],
  ["986578788855", "fedex", "FedEx Express (12 digits)"],
  ["477179081230", "fedex", "FedEx Express (12 digits)"],
  ["041441760228964", "fedex", "FedEx Ground (15 digits)"],
  ["9611020987654312345672", "fedex", "FedEx Ground 96 (22 digits)"],
  ["1001921334250001000300779017972697", "fedex", "FedEx Express (34 digits)"],
  ["9622001900000000000000776632517510", "fedex", "FedEx Ground GSN (34 digits)"],
  ["32971514560102447849175802862014", "fedex", "FedEx ASTRA (32 digits)"],
  ["000123450000000027", "fedex", "FedEx Ground SSCC-18"],
  // Real FedEx Ground Economy email number: an AI-92 IMpb printed without "92".
  ["61299998820821171811", "fedex", "FedEx Ground Economy (20 digits)"],
  ["3318810025", "dhl", "DHL Express (10 digits)"],
  ["73891051146", "dhl", "DHL Express (11 digits)"],
  ["C11031500001879", "ontrac", "OnTrac C"],
  ["D10011354453707", "ontrac", "OnTrac D"],
];

const NO_CHECK_DIGIT: [input: string, carrier: CarrierId, format: string, normalized: string][] = [
  ["JJD0099999999", "dhl", "DHL Express piece ID", "JJD0099999999"],
  ["GM2951173225174494", "dhl", "DHL eCommerce", "GM2951173225174494"],
  ["60120172242323", "dhl", "DHL eCommerce (14 digits)", "60120172242323"],
  ["TBA305938274011", "amazon", "Amazon Logistics (TBA)", "TBA305938274011"],
  ["TBC 000000000000", "amazon", "Amazon Logistics (TBA)", "TBC000000000000"],
  ["C1004444443", "amazon", "Amazon international", "C1004444443"],
  ["LX17635036", "ontrac", "LaserShip L", "LX17635036"],
  ["1LS717793482164", "ontrac", "LaserShip 1LS7 (15)", "1LS717793482164"],
  ["1LS7119013618127-1", "ontrac", "LaserShip 1LS7 (18)", "1LS71190136181271"],
  ["1LS CX VE00 58631Y", "ontrac", "LaserShip 1LSCX", "1LSCXVE0058631Y"],
];

const CHECKSUM_INVALID: [input: string, carrier: CarrierId][] = [
  ["1Z5R89390357567128", "ups"],
  ["1Z1111111111111111", "ups"],
  ["K2479825492", "ups"],
  ["9400111206206406260788", "usps"],
  ["9101123456789000000014", "usps"],
  ["03071790000523483742", "usps"],
  ["RB123456786US", "usps"],
  ["986578788856", "fedex"],
  ["041441760228965", "fedex"],
  ["9611020987654312345673", "fedex"],
  ["1001921334250001000300779017972698", "fedex"],
  ["9622001900000000000000776632517511", "fedex"],
  ["32971514560102447849175802852014", "fedex"],
  ["000123450000000028", "fedex"],
  ["3318810026", "dhl"],
  ["C11031500001878", "ontrac"],
  ["D10011354453708", "ontrac"],
];

describe("detectTrackingNumber", () => {
  it.each(CHECKSUM_VALID)("%s -> %s %s (check digit valid)", (input, carrier, format) => {
    expect(detectTrackingNumber(input)).toEqual({
      trackingNumber: normalizeTrackingNumber(input),
      carrier,
      format,
      checksumValid: true,
    });
  });

  it.each(NO_CHECK_DIGIT)("%s -> %s %s (no check digit)", (input, carrier, format, normalized) => {
    expect(detectTrackingNumber(input)).toEqual({
      trackingNumber: normalized,
      carrier,
      format,
      checksumValid: null,
    });
  });

  it.each(CHECKSUM_INVALID)("%s -> %s with checksumValid false", (input, carrier) => {
    const r = detectTrackingNumber(input);
    expect(r?.carrier).toBe(carrier);
    expect(r?.checksumValid).toBe(false);
  });

  it("flags a one-digit typo in a FedEx Ground Economy number", () => {
    expect(detectTrackingNumber("61299998820821171813")?.checksumValid).toBe(false);
  });

  it.each([
    "",
    "hello world",
    "123456789",
    "2Z5R89390357567127", // not 1Z
    "9200000000000000000000", // AI 92 needs a 9-digit MID starting with 9
    "RB123456785XX", // S10 country not in the UPU list
    "TBB000000000000",
    "XA17635036",
    "1LS7119013618127-2",
    "1Z5R8939035756712#",
  ])("returns null for %j", (input) => {
    expect(detectTrackingNumber(input)).toBeNull();
  });

  it("accepts spaced and lowercase input", () => {
    expect(detectTrackingNumber(" 1z 5r8 939 03 5756 712 7 ")?.trackingNumber).toBe("1Z5R89390357567127");
    expect(detectTrackingNumber("9400 1112 0108 0805 4830 16")).toMatchObject({
      trackingNumber: "9400111201080805483016",
      carrier: "usps",
      checksumValid: true,
    });
  });

  describe("USPS 420 + ZIP routing prefix", () => {
    it.each([
      ["420787459400111206206406260787", "9400111206206406260787", "USPS IMpb (22 digits, from 420+ZIP barcode)"],
      ["420902459261290336128704042634", "9261290336128704042634", "USPS IMpb (22 digits, from 420+ZIP barcode)"],
      ["4201002334249200190132607600833457", "9200190132607600833457", "USPS IMpb (22 digits, from 420+ZIP barcode)"],
      ["420221539101026837331000039521", "9101026837331000039521", "USPS legacy (22 digits, from 420+ZIP barcode)"],
    ])("%s -> PIC %s", (input, pic, format) => {
      expect(detectTrackingNumber(input)).toEqual({
        trackingNumber: pic,
        carrier: "usps",
        format,
        checksumValid: true,
      });
    });

    it("rejects a bad check digit behind a routing prefix", () => {
      expect(detectTrackingNumber("4201028200009261290113185417468511")?.checksumValid).toBe(false);
    });
  });

  describe("precedence when several formats match", () => {
    it("prefers USPS over FedEx 34 for a 420-prefixed 34-digit barcode that passes both", () => {
      expect(detectTrackingNumber("4201028200009261290113185417468510")).toMatchObject({
        trackingNumber: "9261290113185417468510",
        carrier: "usps",
        checksumValid: true,
      });
    });

    it("prefers a validating check digit (UPS waybill) over a format without one (Amazon international)", () => {
      expect(detectTrackingNumber("A1506235620")).toMatchObject({ carrier: "ups", format: "UPS waybill" });
      // One digit off: the waybill check fails, so the no-check-digit reading wins.
      expect(detectTrackingNumber("A1506235621")).toMatchObject({
        carrier: "amazon",
        format: "Amazon international",
        checksumValid: null,
      });
    });

    it("prefers S10 over DHL eCommerce for LX/CN/RX-prefixed international mail", () => {
      expect(detectTrackingNumber("LX123456785CN")).toMatchObject({
        carrier: "usps",
        format: "UPU S10 international mail",
        checksumValid: true,
      });
    });
  });
});
