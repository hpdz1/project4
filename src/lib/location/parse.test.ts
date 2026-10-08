import { describe, expect, it } from "vitest";
import { COUNTRIES, OTHER_COUNTRY_CODE, normalizeCountryCode, parseLocation } from "@/lib/location";

const NO_ZIP = "We couldn't find a ZIP code";

describe("parseLocation: US full addresses", () => {
  it.each([
    ["123 Main St Apt 4B, Springfield, IL 62701-1234", "62701", "IL", "Springfield"],
    ["123 Main St, Apt 4B, Springfield, IL 62701", "62701", "IL", "Springfield"],
    ["123 Main St #4B Springfield IL 62701", "62701", "IL", "Springfield"],
    ["123 main st springfield il 62701", "62701", "IL", "Springfield"],
    ["123 MAIN ST, SPRINGFIELD, IL 62701", "62701", "IL", "Springfield"],
    ["123 Main Street, Springfield, Illinois 62701", "62701", "IL", "Springfield"],
    ["123 main street springfield illinois 627011234", "62701", "IL", "Springfield"],
    ["1600 Pennsylvania Avenue NW, Washington, DC 20500", "20500", "DC", "Washington"],
    ["1600 Pennsylvania Ave NW Washington DC 20500", "20500", "DC", "Washington"],
    ["1234 NE Glisan St, Portland, OR 97232", "97232", "OR", "Portland"],
    ["350 5th Ave, New York, NY 10118, USA", "10118", "NY", "New York"],
    ["350 Fifth Avenue New York New York 10118", "10118", "NY", "New York"],
    ["123 Main St St Louis MO 63101", "63101", "MO", "St Louis"],
    ["900 Market St., St. Louis, MO 63101", "63101", "MO", "St. Louis"],
    ["12 Lake Shore Dr Spring Valley NY 10977", "10977", "NY", "Spring Valley"],
    ["77 Oak Rd Suite 200 Winston-Salem NC 27101", "27101", "NC", "Winston-Salem"],
    ["456 Elm Ct, New Haven, CT 06511", "06511", "CT", "New Haven"],
    ["1 Infinite Loop, Cupertino, California 95014, United States", "95014", "CA", "Cupertino"],
    ["500 W 2nd St Unit 12, Austin, TX 78701", "78701", "TX", "Austin"],
    ["742 Evergreen Terrace, Springfield, OR 97477", "97477", "OR", "Springfield"],
    ["10 County Rd 12 Lake Placid NY 12946", "12946", "NY", "Lake Placid"],
    ["2200 W Virginia Ave, Charleston, West Virginia 25302", "25302", "WV", "Charleston"],
  ])("%s", (input, postalCode, region, city) => {
    const parsed = parseLocation(input);
    expect(parsed).toEqual({ country: "US", postalCode, region, city, hasStreet: true, warnings: [] });
  });

  it("keeps mixed-case city spelling and title-cases one-case input", () => {
    expect(parseLocation("1 Main St, McAllen, TX 78501").city).toBe("McAllen");
    expect(parseLocation("1 MAIN ST, O'FALLON, MO 63366").city).toBe("O'fallon");
    expect(parseLocation("1 main st, winston-salem, nc 27101").city).toBe("Winston-Salem");
  });
});

describe("parseLocation: US partial input", () => {
  it("accepts a bare ZIP and infers the state", () => {
    expect(parseLocation("60614")).toEqual({
      country: "US",
      postalCode: "60614",
      region: "IL",
      city: null,
      hasStreet: false,
      warnings: [],
    });
  });

  it("takes ZIP5 from ZIP+4", () => {
    expect(parseLocation("02134-1234")).toMatchObject({ postalCode: "02134", region: "MA" });
    expect(parseLocation("021341234")).toMatchObject({ postalCode: "02134", region: "MA" });
  });

  it("reads city + state without a ZIP and warns", () => {
    const parsed = parseLocation("Chicago, IL");
    expect(parsed).toMatchObject({ country: "US", postalCode: null, region: "IL", city: "Chicago", hasStreet: false });
    expect(parsed.warnings[0]).toContain(NO_ZIP);
  });

  it("reads lowercase state names", () => {
    expect(parseLocation("springfield, illinois")).toMatchObject({ region: "IL", city: "Springfield" });
    expect(parseLocation("Charleston west virginia 25301")).toMatchObject({ region: "WV", city: "Charleston" });
    expect(parseLocation("Little Rock, Arkansas 72201")).toMatchObject({ region: "AR", city: "Little Rock" });
  });

  it("reads city and ZIP without a state", () => {
    expect(parseLocation("Springfield 62701")).toMatchObject({ postalCode: "62701", region: "IL", city: "Springfield" });
  });

  it("does not take street suffixes or street names for states when there is no ZIP", () => {
    const court = parseLocation("456 Elm Ct");
    expect(court).toMatchObject({ postalCode: null, region: null, city: null, hasStreet: true });
    expect(court.warnings[0]).toContain(NO_ZIP);
    expect(parseLocation("123 Main St NE")).toMatchObject({ region: null, hasStreet: true });
    expect(parseLocation("1600 Pennsylvania")).toMatchObject({ region: null, hasStreet: true });
    expect(parseLocation("123 Main St Louisville KY")).toMatchObject({ region: "KY", city: "Louisville" });
  });

  it("does not take a 5-digit house number for a ZIP", () => {
    const parsed = parseLocation("12345 Main St, Anytown");
    expect(parsed).toMatchObject({ postalCode: null, hasStreet: true });
    expect(parsed.warnings[0]).toContain(NO_ZIP);
    expect(parseLocation("12345 Main St, Anytown, OH 43004")).toMatchObject({ postalCode: "43004", region: "OH" });
  });

  it("handles Saint/Fort city names without mistaking them for streets", () => {
    expect(parseLocation("Port St. Lucie, FL 34952")).toEqual({
      country: "US",
      postalCode: "34952",
      region: "FL",
      city: "Port St. Lucie",
      hasStreet: false,
      warnings: [],
    });
    expect(parseLocation("Fort Lee NJ 07024")).toMatchObject({ region: "NJ", city: "Fort Lee", hasStreet: false });
    expect(parseLocation("Kansas City, MO 64105")).toMatchObject({ region: "MO", city: "Kansas City" });
  });

  it("only flags a street when there is one", () => {
    expect(parseLocation("Main Street, Springfield, IL 62701").hasStreet).toBe(true);
    expect(parseLocation("Springfield, IL 62701").hasStreet).toBe(false);
    expect(parseLocation("Spring Valley, NY 10977").hasStreet).toBe(false);
    expect(parseLocation("Garden Grove, CA 92840").hasStreet).toBe(false);
  });

  it("warns when the ZIP and the typed state disagree", () => {
    const parsed = parseLocation("123 Main St, Madison, WI 62701");
    expect(parsed.region).toBe("WI");
    expect(parsed.warnings).toEqual([expect.stringContaining("62701 is in IL")]);
  });

  it("warns about ZIP codes that aren't in use", () => {
    expect(parseLocation("00000").warnings).toEqual([expect.stringContaining("doesn't look right")]);
  });
});

describe("parseLocation: PO Boxes, units, military, territories", () => {
  it.each([
    "PO Box 123, Springfield, IL 62701",
    "P.O. Box 123 Springfield IL 62701",
    "Post Office Box 123, Springfield, IL 62701",
    "POB 123 Springfield, IL 62701",
  ])("%s", (input) => {
    const parsed = parseLocation(input);
    expect(parsed).toMatchObject({ postalCode: "62701", region: "IL", city: "Springfield", hasStreet: false });
    expect(parsed.warnings).toEqual([expect.stringContaining("PO Box")]);
  });

  it("does not take a PO Box number for a ZIP", () => {
    const parsed = parseLocation("PO Box 12345");
    expect(parsed.postalCode).toBeNull();
    expect(parsed.warnings).toEqual(expect.arrayContaining([expect.stringContaining(NO_ZIP)]));
  });

  it("does not treat a unit as the city", () => {
    expect(parseLocation("123 Main St, Apt 4B, IL 62701")).toMatchObject({ city: null, region: "IL", hasStreet: true });
    expect(parseLocation("Apt 4B, Springfield, IL 62701")).toMatchObject({ city: "Springfield" });
  });

  it("reads military addresses", () => {
    expect(parseLocation("PSC 1234 Box 5678, APO AE 09012")).toMatchObject({
      country: "US",
      postalCode: "09012",
      region: "AE",
      city: "APO",
      hasStreet: false,
    });
    expect(parseLocation("Unit 2050 Box 4190, FPO AP 96522")).toMatchObject({ region: "AP", city: "FPO" });
  });

  it("reads territories", () => {
    expect(parseLocation("Calle Luna 123, San Juan, PR 00901")).toMatchObject({ region: "PR", city: "San Juan" });
    expect(parseLocation("Hagatna, Guam 96910")).toMatchObject({ region: "GU", city: "Hagatna" });
    expect(parseLocation("96799")).toMatchObject({ region: "AS" });
  });
});

describe("parseLocation: other countries", () => {
  it("detects Canadian postal codes", () => {
    expect(parseLocation("m5v3l9")).toEqual({
      country: "CA",
      postalCode: "M5V 3L9",
      region: "ON",
      city: null,
      hasStreet: false,
      warnings: [],
    });
    expect(parseLocation("290 Bremner Blvd, Toronto, ON M5V 3L9, Canada")).toEqual({
      country: "CA",
      postalCode: "M5V 3L9",
      region: "ON",
      city: "Toronto",
      hasStreet: true,
      warnings: [],
    });
    expect(parseLocation("1 Government St, Victoria, British Columbia V8W 1P6")).toMatchObject({
      region: "BC",
      city: "Victoria",
    });
    expect(parseLocation("Iqaluit NU X0A 0H0")).toMatchObject({ region: "NU", postalCode: "X0A 0H0" });
  });

  it("detects UK postcodes", () => {
    expect(parseLocation("sw1a1aa")).toMatchObject({ country: "GB", postalCode: "SW1A 1AA", region: null });
    expect(parseLocation("10 Downing Street, London SW1A 2AA")).toEqual({
      country: "GB",
      postalCode: "SW1A 2AA",
      region: null,
      city: "London",
      hasStreet: true,
      warnings: [],
    });
    expect(parseLocation("Flat 2, 5 High Street, Manchester, M1 1AE, UK")).toMatchObject({
      country: "GB",
      postalCode: "M1 1AE",
      city: "Manchester",
      hasStreet: true,
    });
  });

  it("detects Dutch postcodes", () => {
    expect(parseLocation("1012lg")).toMatchObject({ country: "NL", postalCode: "1012 LG" });
    expect(parseLocation("Damrak 1, 1012 LG Amsterdam")).toEqual({
      country: "NL",
      postalCode: "1012 LG",
      region: null,
      city: "Amsterdam",
      hasStreet: true,
      warnings: [],
    });
  });

  it("detects Australian postcodes only with a state", () => {
    expect(parseLocation("1 Martin Pl, Sydney NSW 2000")).toEqual({
      country: "AU",
      postalCode: "2000",
      region: "NSW",
      city: "Sydney",
      hasStreet: true,
      warnings: [],
    });
    expect(parseLocation("Perth WA 6000")).toMatchObject({ country: "AU", region: "WA", city: "Perth" });
    expect(parseLocation("Hobart, Tasmania 7000")).toMatchObject({ country: "AU", region: "TAS" });
    expect(parseLocation("2000").country).toBe("US");
    expect(parseLocation("2000", "AU")).toMatchObject({ country: "AU", postalCode: "2000", region: "NSW" });
    expect(parseLocation("0870", "au")).toMatchObject({ postalCode: "0870", region: "NT" });
  });

  it("treats 5 digits as German only with a DE hint or a typed country", () => {
    expect(parseLocation("10117", "DE")).toEqual({
      country: "DE",
      postalCode: "10117",
      region: null,
      city: null,
      hasStreet: false,
      warnings: [],
    });
    expect(parseLocation("10117").country).toBe("US");
    expect(parseLocation("Unter den Linden 1, 10117 Berlin, Germany")).toMatchObject({
      country: "DE",
      postalCode: "10117",
      city: "Berlin",
      hasStreet: true,
    });
  });

  it("does not mistake a US house number + directional for a Dutch postcode", () => {
    expect(parseLocation("1234 NE Glisan St").country).toBe("US");
  });

  it("uses the hint over the postcode shape and says so", () => {
    const parsed = parseLocation("Sydney NSW 2000", "US");
    expect(parsed.country).toBe("US");
    expect(parsed.warnings).toEqual([
      expect.stringContaining(NO_ZIP),
      "This looks like an address in Australia. Choose Australia as your country if that's right.",
    ]);
    expect(parseLocation("SW1A 1AA", "uk")).toMatchObject({ country: "GB", postalCode: "SW1A 1AA", warnings: [] });
  });

  it("warns when a postcode is missing", () => {
    expect(parseLocation("Toronto", "CA").warnings[0]).toContain("postal code");
    expect(parseLocation("London", "GB").warnings[0]).toContain("postcode");
    expect(parseLocation("Amsterdam", "NL").warnings[0]).toContain("postcode");
    expect(parseLocation("Berlin", "DE").warnings[0]).toContain("postcode");
  });

  it("passes other countries through without guessing", () => {
    expect(parseLocation("12 Rue de Rivoli, 75001 Paris", "FR")).toEqual({
      country: "FR",
      postalCode: null,
      region: null,
      city: null,
      hasStreet: true,
      warnings: [],
    });
    expect(parseLocation("anything", OTHER_COUNTRY_CODE)).toMatchObject({ country: "ZZ", warnings: [] });
  });
});

describe("parseLocation: garbage", () => {
  it.each(["", "   ", "!!!", "😀😀", "-- , ,, ;"])("%j", (input) => {
    expect(parseLocation(input)).toEqual({
      country: "US",
      postalCode: null,
      region: null,
      city: null,
      hasStreet: false,
      warnings: ["Enter your address or ZIP code."],
    });
  });

  it("never throws", () => {
    const inputs: unknown[] = [
      "asdf qwerty",
      "1",
      "12345678901234567890",
      "#",
      "Apt",
      "PO Box",
      "Box #",
      ", , IL",
      "a".repeat(10_000),
      "1 ".repeat(5_000),
      "St St St St",
      null,
      undefined,
      42,
    ];
    for (const input of inputs) {
      expect(() => parseLocation(input as string)).not.toThrow();
      expect(() => parseLocation(input as string, "XX")).not.toThrow();
    }
  });

  it("warns about unrecognizable input", () => {
    const parsed = parseLocation("asdf qwerty");
    expect(parsed).toMatchObject({ country: "US", postalCode: null, region: null, city: null, hasStreet: false });
    expect(parsed.warnings[0]).toContain(NO_ZIP);
  });
});

describe("countries", () => {
  it("lists supported countries plus Other", () => {
    expect(COUNTRIES.map((c) => c.code)).toEqual(["US", "CA", "GB", "AU", "DE", "NL", "ZZ"]);
    expect(COUNTRIES.at(-1)).toEqual({ code: "ZZ", name: "Other" });
  });

  it("normalizes country codes", () => {
    expect(normalizeCountryCode(" us ")).toBe("US");
    expect(normalizeCountryCode("uk")).toBe("GB");
    expect(normalizeCountryCode("USA")).toBeNull();
    expect(normalizeCountryCode(undefined)).toBeNull();
  });
});
