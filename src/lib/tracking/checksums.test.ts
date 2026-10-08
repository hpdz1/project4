import { describe, expect, it } from "vitest";
import {
  charValue,
  mod10CheckDigit,
  mod7CheckDigit,
  s10CheckDigit,
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
