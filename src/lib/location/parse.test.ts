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
    ["123 Main St Virginia Beach VA 23451", "23451", "VA", "Virginia Beach"],
    ["123 Main St Key West FL 33040", "33040", "FL", "Key West"],
    ["1 W Main St North Bergen NJ 07047", "07047", "NJ", "North Bergen"],
    ["123 Main Street Apt 2 New York NY 10001", "10001", "NY", "New York"],
    ["Main Ave Springfield IL 62701", "62701", "IL", "Springfield"],
    ["One Apple Park Way, Cupertino, CA 95014", "95014", "CA", "Cupertino"],
    ["12 1/2 Main St, Bangor, ME 04401", "04401", "ME", "Bangor"],
    ["W1234N5678 Main St, Cedarburg, WI 53012", "53012", "WI", "Cedarburg"],
    ["123-45 Queens Blvd, Forest Hills, NY 11375", "11375", "NY", "Forest Hills"],
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
    expect(parseLocation("Kansas City, Kansas 66101")).toMatchObject({ region: "KS", city: "Kansas City" });
    expect(parseLocation("Indiana, PA 15701")).toMatchObject({ region: "PA", city: "Indiana" });
  });

  it("keeps city names that contain street words when they have their own comma part", () => {
    expect(parseLocation("Washington Court House, OH 43160")).toMatchObject({
      region: "OH",
      city: "Washington Court House",
      hasStreet: false,
    });
    expect(parseLocation("Pacific Grove CA 93950")).toMatchObject({ city: "Pacific Grove", hasStreet: false });
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

  it("reads rural route addresses without a PO Box warning", () => {
    expect(parseLocation("RR 2 Box 152, Hamlet, NC 28345")).toEqual({
      country: "US",
      postalCode: "28345",
      region: "NC",
      city: "Hamlet",
      hasStreet: false,
      warnings: [],
    });
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
    expect(parseLocation("Montréal (Québec) H2X 1Y4")).toMatchObject({
      country: "CA",
      region: "QC",
      city: "Montréal",
      postalCode: "H2X 1Y4",
    });
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

  it("reads other countries' postcodes with a hint or a typed country name", () => {
    expect(parseLocation("12 Rue de Rivoli, 75001 Paris", "FR")).toEqual({
      country: "FR",
      postalCode: "75001",
      region: null,
      city: "Paris",
      hasStreet: true,
      warnings: [],
    });
    expect(parseLocation("anything", OTHER_COUNTRY_CODE)).toMatchObject({ country: "ZZ", postalCode: null, warnings: [] });
    // "Other" keeps a postcode-like token when there clearly is one, and never warns about a missing one.
    expect(parseLocation("Main Road 12, 3000 Somewhere", OTHER_COUNTRY_CODE)).toMatchObject({
      country: "ZZ",
      postalCode: "3000",
      city: "Somewhere",
      warnings: [],
    });
    expect(parseLocation("Main Road 1234", OTHER_COUNTRY_CODE)).toMatchObject({ postalCode: null, warnings: [] });
    expect(parseLocation("10 Rue de Rivoli, 75001 Paris, France")).toEqual({
      country: "FR",
      postalCode: "75001",
      region: null,
      city: "Paris",
      hasStreet: true,
      warnings: [],
    });
    // Every country is in the picker now, so a typed country that disagrees with the picker is pointed out.
    expect(parseLocation("10 Rue de Rivoli, 75001 Paris, France", "US").warnings).toEqual([
      expect.stringContaining(NO_ZIP),
      "This looks like an address in France. Choose France as your country if that's right.",
    ]);
    expect(parseLocation("Belfast BT1 1AA, Northern Ireland")).toMatchObject({ country: "GB", postalCode: "BT1 1AA" });
  });
});

describe("parseLocation: worldwide postcodes", () => {
  it.each([
    ["Bahnhofstrasse 10, 8001 Zürich", "CH", "8001", "Zürich"],
    ["Stephansplatz 1, A-1010 Wien", "AT", "1010", "Wien"],
    ["Rue Neuve 1, 1000 Bruxelles", "BE", "1000", "Bruxelles"],
    ["Strøget 1, DK-1050 København", "DK", "1050", "København"],
    ["Karl Johans gate 1, 0154 Oslo", "NO", "0154", "Oslo"],
    ["Drottninggatan 1, 111 51 Stockholm", "SE", "111 51", "Stockholm"],
    ["Drottninggatan 1, 11151 Stockholm", "SE", "111 51", "Stockholm"],
    ["Mannerheimintie 1, 00100 Helsinki", "FI", "00100", "Helsinki"],
    ["ul. Marszałkowska 1, 00-624 Warszawa", "PL", "00-624", "Warszawa"],
    ["Marszałkowska 1, 00624 Warszawa", "PL", "00-624", "Warszawa"],
    ["Avenida da Liberdade 1, 1250-096 Lisboa", "PT", "1250-096", "Lisboa"],
    ["Calle Mayor 1, 28013 Madrid", "ES", "28013", "Madrid"],
    ["Via del Corso 1, 00186 Roma", "IT", "00186", "Roma"],
    ["Václavské náměstí 1, 110 00 Praha", "CZ", "110 00", "Praha"],
    ["Ermou 1, 105 63 Athens", "GR", "105 63", "Athens"],
    ["1 O'Connell Street, Dublin 1, D01 F5P2", "IE", "D01 F5P2", null],
    ["〒100-0001 東京都千代田区千代田1-1", "JP", "100-0001", null],
    ["Avenida Paulista 1000, São Paulo, SP 01310-100", "BR", "01310-100", null],
    ["Avenida Paulista 1000, 01310100 São Paulo", "BR", "01310-100", "São Paulo"],
    ["12 MG Road, Bengaluru 560001", "IN", "560001", "Bengaluru"],
    ["12 MG Road, Bengaluru 560 001", "IN", "560001", "Bengaluru"],
    ["Reforma 1, Cuauhtémoc, 06600 Ciudad de México", "MX", "06600", "Ciudad de México"],
    ["세종대로 209, 03172", "KR", "03172", null],
    ["建国路88号, 100022", "CN", "100022", null],
    ["Brīvības iela 1, Rīga, LV-1050", "LV", "LV-1050", null],
    ["Brīvības iela 1, Rīga 1050", "LV", "LV-1050", "Rīga"],
    ["Gedimino pr. 1, 01103 Vilnius", "LT", "LT-01103", "Vilnius"],
    ["Triq ir-Repubblika, Valletta VLT 1117", "MT", "VLT 1117", "Valletta"],
    ["Herzl St 1, Tel Aviv 6100000", "IL", "6100000", "Tel Aviv"],
    ["1 Queen St, Auckland 1010", "NZ", "1010", "Auckland"],
    ["1 Long St, Cape Town 8001", "ZA", "8001", "Cape Town"],
    ["1 Raffles Place, Singapore 048616", "SG", "048616", "Singapore"],
    ["Tverskaya 1, Moskva 125009", "RU", "125009", "Moskva"],
    ["Istiklal Cd. 1, 34433 Istanbul", "TR", "34433", "Istanbul"],
  ])("%s (%s)", (input, country, postalCode, city) => {
    const parsed = parseLocation(input, country);
    expect(parsed).toMatchObject({ country, postalCode, region: null, warnings: [] });
    if (city !== null) expect(parsed.city).toBe(city);
  });

  it("keeps the street out of the result", () => {
    const parsed = parseLocation("Bahnhofstrasse 10, 8001 Zürich", "CH");
    expect(parsed.hasStreet).toBe(true);
    expect(JSON.stringify(parsed)).not.toMatch(/Bahnhof/);
  });

  it("asks for the postcode once, with a national example", () => {
    expect(parseLocation("Zürich", "CH").warnings).toEqual([
      "We couldn't find a postcode. Add it if you have one (for example 8001).",
    ]);
    expect(parseLocation("Bengaluru", "IN").warnings).toEqual([
      "We couldn't find a PIN code. Add it if you have one (for example 110001).",
    ]);
    expect(parseLocation("Dublin", "IE").warnings).toEqual([
      "We couldn't find an Eircode. Add it if you have one (for example D02 X285).",
    ]);
  });

  it("doesn't look for postcodes where homes don't have them", () => {
    expect(parseLocation("Villa 12, Street 5, Al Barsha, Dubai", "AE")).toEqual({
      country: "AE",
      postalCode: null,
      region: null,
      city: null,
      hasStreet: true,
      warnings: [],
    });
    expect(parseLocation("Flat 3A, 12 Nathan Road, Kowloon", "HK")).toMatchObject({ postalCode: null, warnings: [] });
    expect(parseLocation("", "AE").warnings).toEqual(["Enter your address."]);
    expect(parseLocation("", "IN").warnings).toEqual(["Enter your address or PIN code."]);
  });

  it("takes a postcode-like token for countries without a known format, but never a street number", () => {
    // Bolivia's neighbour Paraguay: no pattern table entry, so the loose rule applies.
    expect(parseLocation("Calle Palma 123, 001001 Asunción", "PY")).toMatchObject({
      postalCode: "001001",
      city: "Asunción",
      warnings: [],
    });
    expect(parseLocation("Calle Palma 1234, Asunción", "PY")).toMatchObject({ postalCode: null, warnings: [] });
    expect(parseLocation("Calle Palma 1234 Asunción", "PY")).toMatchObject({ postalCode: null, warnings: [] });
    expect(parseLocation("001001", "PY")).toMatchObject({ postalCode: "001001", warnings: [] });
    expect(parseLocation("123 21st Street, Apt 4567", "PY")).toMatchObject({ postalCode: null, warnings: [] });
  });

  it("parses US territories as US ZIP codes and doesn't suggest switching to the US", () => {
    expect(parseLocation("Calle Luna 123, San Juan, PR 00901", "PR")).toMatchObject({
      country: "PR",
      postalCode: "00901",
      region: "PR",
      city: "San Juan",
      warnings: [],
    });
    expect(parseLocation("Hagatna 96910", "GU")).toMatchObject({ country: "GU", region: "GU", warnings: [] });
    expect(parseLocation("Calle Luna 123, San Juan, Puerto Rico", "US").warnings).toEqual([
      expect.stringContaining(NO_ZIP),
    ]);
  });

  it("uses UK-style postcodes in the Crown Dependencies and Gibraltar", () => {
    expect(parseLocation("1 Royal Square, St Helier JE2 3AB", "JE")).toMatchObject({ postalCode: "JE2 3AB" });
    expect(parseLocation("Main Street, GX11 1AA", "GI")).toMatchObject({ postalCode: "GX11 1AA" });
    expect(parseLocation("St Peter Port", "GG").warnings[0]).toContain("GY1 1AA");
  });

  it("suggests a country from distinctive postcode shapes when none was picked", () => {
    expect(parseLocation("Avenida Paulista 1000, 01310-100 São Paulo").country).toBe("BR");
    expect(parseLocation("Rua Augusta 1, 1100-048 Lisboa").country).toBe("PT");
    expect(parseLocation("100-0001").country).toBe("JP");
    expect(parseLocation("ul. Nowy Świat 1, 00-497 Warszawa").country).toBe("PL");
    expect(parseLocation("1 Main Street, Dublin, D02 X285").country).toBe("IE");
    expect(parseLocation("00-497 Warszawa", "DE").warnings).toEqual([
      expect.stringContaining("Postleitzahl"),
      "This looks like an address in Poland. Choose Poland as your country if that's right.",
    ]);
    // A Queens-style house number is still a US address.
    expect(parseLocation("123-45 Queens Blvd, Forest Hills, NY 11375").country).toBe("US");
  });

  it("recognizes country names typed as the last part of the address", () => {
    expect(parseLocation("Hauptplatz 1, 8010 Graz, Österreich")).toMatchObject({ country: "AT", postalCode: "8010" });
    expect(parseLocation("Via Roma 1, 00184 Roma, Italia")).toMatchObject({ country: "IT", postalCode: "00184" });
    expect(parseLocation("Shinjuku 1-1, Tokyo, Japan")).toMatchObject({ country: "JP" });
    expect(parseLocation("Sheikh Zayed Rd, Dubai, UAE")).toMatchObject({ country: "AE", postalCode: null });
    expect(parseLocation("Damrak 1, 1012 LG Amsterdam, the Netherlands")).toMatchObject({ country: "NL" });
    expect(parseLocation("10 Main St, Cape Town, South Africa")).toMatchObject({ country: "ZA" });
    // Only as a whole last part, and never "Georgia", which is usually the US state.
    expect(parseLocation("100 Peachtree St, Atlanta, Georgia 30303").country).toBe("US");
    expect(parseLocation("100 Peachtree St, Atlanta, Georgia").country).toBe("US");
    expect(parseLocation("Santa Fe, New Mexico 87501").country).toBe("US");
    expect(parseLocation("Lebanon").country).toBe("US");
    expect(parseLocation("1 Main St, Springfield", "US").warnings).toEqual([expect.stringContaining(NO_ZIP)]);
  });

  it("says 'the' before country names that need it", () => {
    expect(parseLocation("Damrak 1, 1012 LG Amsterdam", "BE").warnings).toContain(
      "This looks like an address in the Netherlands. Choose Netherlands as your country if that's right.",
    );
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
  it("lists every country, sorted by name, plus Other", () => {
    expect(COUNTRIES.length).toBeGreaterThan(240);
    expect(COUNTRIES.at(-1)).toEqual({ code: "ZZ", name: "Other" });
  });

  it("normalizes country codes", () => {
    expect(normalizeCountryCode(" us ")).toBe("US");
    expect(normalizeCountryCode("uk")).toBe("GB");
    expect(normalizeCountryCode("USA")).toBeNull();
    expect(normalizeCountryCode(undefined)).toBeNull();
  });
});
