import { describe, expect, it } from "vitest";
import {
  charValue,
  correosCheckLetter,
  evriCheckDigit,
  glsCheckDigit,
  gs1CheckDigit,
  identcodeCheckDigit,
  iso7064Mod3736CheckChar,
  luhnCheckDigit,
  mod10CheckDigit,
  mod7CheckDigit,
  s10CheckDigit,
  sfCheckDigit,
  uspsCheckDigit,
  weightedMod11CheckDigit,
} from "./checksums";

// Expected check digits below were computed with an independent Python
// implementation written from research/tracking_numbers.md, not with this code.

const FEDEX_12_WEIGHTS = [3, 1, 7, 3, 1, 7, 3, 1, 7, 3, 1];
const FEDEX_34_WEIGHTS = [1, 7, 3, 1, 7, 3, 1, 7, 3, 1, 7, 3, 1];

describe("charValue", () => {
  it("maps digits to themselves", () => {
    expect([..."0123456789"].map(charValue)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("maps letters with (charCode - 3) % 10 (A=2 ... I=0 ... Z=7)", () => {
    expect([..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map(charValue).join("")).toBe(
      "23456789012345678901234567",
    );
  });
});

describe("mod10CheckDigit", () => {
  it("UPS 1Z: weights 1,2 from the left with letters mapped", () => {
    expect(mod10CheckDigit("5R8939035756712", 1, 2)).toBe(7); // 1Z5R89390357567127
    expect(mod10CheckDigit("999AA1012345678", 1, 2)).toBe(4); // 1Z999AA10123456784
  });

  it("FedEx Ground: weights 1,3 over 14 digits", () => {
    expect(mod10CheckDigit("04144176022896", 1, 3)).toBe(4); // 041441760228964
  });

  it("SSCC-18 (tracking_number_data variant): weights 3,1 over the 15 digits after the container type", () => {
    expect(mod10CheckDigit("012345000000002", 3, 1)).toBe(7); // 000123450000000027
  });
});

describe("uspsCheckDigit", () => {
  it("matches the Publication 199 §4.6 worked example (PIC 9212 3912 3456 7812 3456 70)", () => {
    expect(uspsCheckDigit("921239123456781234567")).toBe(0);
  });

  it("weights 3 next to the check digit, alternating leftwards", () => {
    expect(uspsCheckDigit("940011120620640626078")).toBe(7); // 9400111206206406260787
    // Prefixing "91" (legacy implied AI) adds 9*3 + 1*1 = 28 to the sum for odd-length serials.
    expect(uspsCheckDigit("9171969010756003077385".slice(0, -1))).toBe(5);
  });
});

describe("weightedMod11CheckDigit", () => {
  it("FedEx Express 12: weights 3,1,7,... then % 11 % 10", () => {
    expect(weightedMod11CheckDigit("98657878885", FEDEX_12_WEIGHTS)).toBe(5); // 986578788855
  });

  it("FedEx Express 34: weights 1,7,3,... over the 13-digit serial", () => {
    expect(weightedMod11CheckDigit("0077901797269", FEDEX_34_WEIGHTS)).toBe(7);
  });
});

describe("mod7CheckDigit", () => {
  it("DHL Express: serial mod 7", () => {
    expect(mod7CheckDigit("331881002")).toBe(5); // 3318810025
    expect(mod7CheckDigit("7389105114")).toBe(6); // 73891051146
  });

  it("handles serials beyond Number.MAX_SAFE_INTEGER digit by digit", () => {
    expect(mod7CheckDigit("99999999999999999999")).toBe(Number(BigInt("99999999999999999999") % BigInt(7)));
  });
});

describe("s10CheckDigit", () => {
  it("weights 8,6,4,2,3,5,9,7 then 11 - sum % 11", () => {
    expect(s10CheckDigit("12345678")).toBe(5); // RB123456785US (sum 204, 204 % 11 = 6)
  });

  it("maps 10 to 0 and 11 to 5", () => {
    expect(s10CheckDigit("12345686")).toBe(0); // sum % 11 === 1
    expect(s10CheckDigit("12345689")).toBe(5); // sum % 11 === 0
  });
});

// Worldwide algorithms. Expected values come from real, sourced numbers
// (research/worldwide/tracking-formats-intl.md corpus) and were re-checked with
// an independent Python implementation written from the spec text; synthetic
// numbers were generated with that same Python code, not with this module.

describe("gs1CheckDigit", () => {
  it.each([
    ["0034043506135216152", 7], // DHL Paket NVE 00340435061352161527
    ["0218017100365", 4], // Hermes 02180171003654
    ["201050579943649", 4], // Canada Post 2010505799436494
    ["37072215262157849", 5], // Bring 370722152621578495
    ["0057313290190350324", 7], // PostNord SSCC 00573132901903503247
  ])("%s -> %i", (serial, check) => {
    expect(gs1CheckDigit(serial)).toBe(check);
  });

  it("is the USPS rule", () => {
    expect(gs1CheckDigit("921239123456781234567")).toBe(uspsCheckDigit("921239123456781234567"));
  });
});

describe("identcodeCheckDigit", () => {
  it("weights 4, 9 from the left (paketda example 201298452277: sum 253)", () => {
    expect(identcodeCheckDigit("20129845227")).toBe(7);
  });
});

describe("luhnCheckDigit", () => {
  it.each([
    ["52076980226", 2], // Purolator 520769802262
    ["32059546393", 8], // Purolator 320595463938 (tracking_number_data fixture)
    ["7992739871", 3], // the textbook Luhn example 79927398713
  ])("%s -> %i", (serial, check) => {
    expect(luhnCheckDigit(serial)).toBe(check);
  });
});

describe("glsCheckDigit", () => {
  it("is GS1 with the sum starting at 1", () => {
    expect(glsCheckDigit("84122517829")).toBe(2); // 841225178292
    expect(glsCheckDigit("12341622717")).toBe(1); // 123416227171
  });
});

describe("evriCheckDigit", () => {
  it("weights 2, 1 from the left with UPS letter values, sum % 10", () => {
    expect(evriCheckDigit("H00RVD055154146")).toBe(6); // H00RVD0551541466
    expect(evriCheckDigit("T002FA007966570")).toBe(8); // T002FA0079665708
  });
});

describe("sfCheckDigit", () => {
  it("skips the area code and sums the digits of odd-weighted products", () => {
    expect(sfCheckDigit("6047789135544")).toBe(4); // SF6047789135544
    expect(sfCheckDigit("6042542297687")).toBe(7); // SF6042542297687
    expect(sfCheckDigit("133938675660")).toBe(0); // 12-digit form
  });

  it("rejects SF's documentation placeholder", () => {
    expect(sfCheckDigit("8888888888888")).not.toBe(8);
  });
});

describe("iso7064Mod3736CheckChar", () => {
  it("matches the ISO 7064 test vector used for GRid (A12425GABC1234002 -> M)", () => {
    expect(iso7064Mod3736CheckChar("A12425GABC1234002")).toBe("M");
  });

  it.each([
    ["09447104918387", "D"], // DPD 09447104918387D
    ["01196812014637", "L"], // DPD 01196812014637L
    ["88000019255788", "Y"], // La Poste 88000019255788Y
    ["86650947215491", "7"], // La Poste 866509472154917
  ])("%s -> %s", (serial, check) => {
    expect(iso7064Mod3736CheckChar(serial)).toBe(check);
  });
});

describe("correosCheckLetter", () => {
  it("sums character codes mod 23 into TRWAGMYFPDXBNJZSQVHLCKE", () => {
    expect(correosCheckLetter("PK0DLC0000085800128009")).toBe("G");
    expect(correosCheckLetter("PKBW0E072936634")).toBe("T");
    expect(correosCheckLetter("CD0CBM0000904620028007")).toBe("A");
  });
});

describe("mod7CheckDigit (Japan Post, Yamato, Sagawa, Blue Dart, Aramex)", () => {
  it.each([
    ["15251591778", 3], // Japan Post 152515917783
    ["3726745246", 0], // Japan Post 372-67-45246-0
    ["49091361125", 2], // Yamato 490913611252
    ["36572936545", 5], // Sagawa 365729365455
    ["3620672771", 2], // Blue Dart 36206727712
    ["968001299", 6], // Aramex 9680012996
  ])("%s -> %i", (serial, check) => {
    expect(mod7CheckDigit(serial)).toBe(check);
  });
});

describe("s10CheckDigit on real numbers", () => {
  it.each(["LZ449705219CN", "CL105844885JP", "MZ465962009GB", "RM419394835IN", "LA681049820NL", "UL494089685YP"])(
    "%s",
    (n) => {
      expect(String(s10CheckDigit(n.slice(2, 10)))).toBe(n[10]);
    },
  );
});
