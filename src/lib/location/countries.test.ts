import { describe, expect, it } from "vitest";
import {
  COUNTRIES,
  OTHER_COUNTRY_CODE,
  SUPPORTED_COUNTRY_CODES,
  countryHasNoPostcodes,
  countryName,
  isCountryCode,
  normalizeCountryCode,
  postcodeFormat,
} from "@/lib/location";

describe("COUNTRIES", () => {
  it("lists 240+ countries and territories with unique two-letter codes", () => {
    expect(COUNTRIES.length).toBeGreaterThan(240);
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const { code, name } of COUNTRIES) {
      expect(code).toMatch(/^[A-Z]{2}$/);
      expect(name.trim().length).toBeGreaterThan(1);
    }
    for (const code of ["US", "CA", "GB", "DE", "FR", "JP", "BR", "IN", "CN", "ZA", "AE", "NZ", "AQ", "XK"]) {
      expect(codes).toContain(code);
    }
  });

  it("sorts by English name and ends with Other", () => {
    const listed = COUNTRIES.slice(0, -1).map((c) => c.name);
    const sorted = [...listed].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
    expect(listed).toEqual(sorted);
    expect(COUNTRIES.at(-1)).toEqual({ code: OTHER_COUNTRY_CODE, name: "Other" });
    expect(COUNTRIES.filter((c) => c.code === OTHER_COUNTRY_CODE)).toHaveLength(1);
  });

  it("uses English names", () => {
    const byCode = new Map(COUNTRIES.map((c) => [c.code, c.name]));
    expect(byCode.get("DE")).toBe("Germany");
    expect(byCode.get("JP")).toBe("Japan");
    expect(byCode.get("US")).toBe("United States");
    expect(byCode.get("GB")).toBe("United Kingdom");
  });

  it("knows which codes are real countries", () => {
    expect(SUPPORTED_COUNTRY_CODES.has("FR")).toBe(true);
    expect(SUPPORTED_COUNTRY_CODES.has(OTHER_COUNTRY_CODE)).toBe(false);
    expect(isCountryCode("fr")).toBe(true);
    expect(isCountryCode("uk")).toBe(true);
    expect(isCountryCode("QQ")).toBe(false);
    expect(isCountryCode(undefined)).toBe(false);
  });
});

describe("countryName", () => {
  it.each([
    ["de", "Germany"],
    [" US ", "United States"],
    ["uk", "United Kingdom"],
    ["BR", "Brazil"],
    ["ZZ", "Other"],
    ["QQ", "QQ"],
    ["not a code", "not a code"],
    ["", ""],
  ])("%j -> %j", (code, name) => {
    expect(countryName(code)).toBe(name);
  });
});

describe("normalizeCountryCode", () => {
  it("normalizes country codes", () => {
    expect(normalizeCountryCode(" us ")).toBe("US");
    expect(normalizeCountryCode("uk")).toBe("GB");
    expect(normalizeCountryCode("USA")).toBeNull();
    expect(normalizeCountryCode(undefined)).toBeNull();
  });
});

describe("postcodeFormat", () => {
  it.each([
    ["US", { label: "ZIP code", example: "60614", usesPostcodes: true }],
    ["PR", { label: "ZIP code", example: null, usesPostcodes: true }],
    ["CA", { label: "postal code", example: "K1A 0B1", usesPostcodes: true }],
    ["GB", { label: "postcode", example: "SW1A 1AA", usesPostcodes: true }],
    ["SE", { label: "postcode", example: "113 51", usesPostcodes: true }],
    ["JP", { label: "postcode", example: "100-0001", usesPostcodes: true }],
    ["IN", { label: "PIN code", example: "110001", usesPostcodes: true }],
    ["IE", { label: "Eircode", example: "D02 X285", usesPostcodes: true }],
    ["AE", { label: "postcode", example: null, usesPostcodes: false }],
    ["PY", { label: "postcode", example: null, usesPostcodes: true }],
    ["ZZ", { label: "postcode", example: null, usesPostcodes: true }],
  ])("%s", (country, format) => {
    expect(postcodeFormat(country)).toEqual(format);
  });

  it("knows where homes have no postcode", () => {
    expect(countryHasNoPostcodes("hk")).toBe(true);
    expect(countryHasNoPostcodes("QA")).toBe(true);
    expect(countryHasNoPostcodes("DE")).toBe(false);
    expect(countryHasNoPostcodes("")).toBe(false);
  });
});
