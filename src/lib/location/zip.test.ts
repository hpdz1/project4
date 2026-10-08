import { describe, expect, it } from "vitest";
import { australiaStateFromPostcode, canadaProvinceFromPostcode, usRegionName, zipToState } from "@/lib/location";

describe("zipToState", () => {
  it.each([
    ["00501", "NY"],
    ["00901", "PR"],
    ["00802", "VI"],
    ["02134", "MA"],
    ["05501", "MA"],
    ["05401", "VT"],
    ["06511", "CT"],
    ["09012", "AE"],
    ["10001", "NY"],
    ["20001", "DC"],
    ["20101", "VA"],
    ["20850", "MD"],
    ["34011", "AA"],
    ["33101", "FL"],
    ["60614", "IL"],
    ["73301", "TX"],
    ["73102", "OK"],
    ["88510", "TX"],
    ["89101", "NV"],
    ["94103", "CA"],
    ["96522", "AP"],
    ["96813", "HI"],
    ["96799", "AS"],
    ["96910", "GU"],
    ["96950", "MP"],
    ["96940", "PW"],
    ["96941", "FM"],
    ["96960", "MH"],
    ["97201", "OR"],
    ["98101", "WA"],
    ["99501", "AK"],
    ["60614-1234", "IL"],
  ])("%s -> %s", (zip, state) => {
    expect(zipToState(zip)).toBe(state);
  });

  it.each(["00000", "00412", "42801", "96933", "1234", "abcde", "", "606145"])("%j -> null", (zip) => {
    expect(zipToState(zip)).toBeNull();
  });
});

describe("region helpers", () => {
  it("names US regions", () => {
    expect(usRegionName("il")).toBe("Illinois");
    expect(usRegionName("XX")).toBeNull();
  });

  it("infers Canadian provinces", () => {
    expect(canadaProvinceFromPostcode("K1A 0B1")).toBe("ON");
    expect(canadaProvinceFromPostcode("H2X 1Y4")).toBe("QC");
    expect(canadaProvinceFromPostcode("X1A 2P7")).toBe("NT");
    expect(canadaProvinceFromPostcode("X0A 0H0")).toBe("NU");
    expect(canadaProvinceFromPostcode("12345")).toBeNull();
  });

  it("infers Australian states", () => {
    expect(australiaStateFromPostcode("2000")).toBe("NSW");
    expect(australiaStateFromPostcode("2600")).toBe("ACT");
    expect(australiaStateFromPostcode("3000")).toBe("VIC");
    expect(australiaStateFromPostcode("4000")).toBe("QLD");
    expect(australiaStateFromPostcode("5000")).toBe("SA");
    expect(australiaStateFromPostcode("6000")).toBe("WA");
    expect(australiaStateFromPostcode("7000")).toBe("TAS");
    expect(australiaStateFromPostcode("0800")).toBe("NT");
    expect(australiaStateFromPostcode("200")).toBeNull();
  });
});
