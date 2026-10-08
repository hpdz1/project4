import { describe, expect, it } from "vitest";
import { getCoverage, type Coverage } from "@/lib/programs";

const ids = (coverage: Coverage) => ({
  address: coverage.addressPrograms.map((p) => p.id),
  account: coverage.accountPrograms.map((p) => p.id),
  perPackage: coverage.perPackage.map((p) => p.id),
});

describe("getCoverage", () => {
  it("covers the US with the three address programs, Amazon, DHL and OnTrac", () => {
    const coverage = getCoverage("US", "IL");
    expect(coverage.country).toBe("US");
    expect(coverage.region).toBe("IL");
    expect(ids(coverage)).toEqual({
      address: ["usps_informed_delivery", "ups_my_choice", "fedex_delivery_manager"],
      account: ["amazon_orders"],
      perPackage: ["dhl_on_demand", "ontrac_notifyme"],
    });
    expect(coverage.fullySupported).toBe(true);
    expect(coverage.gaps.some((g) => g.startsWith("Amazon packages someone else ordered for you"))).toBe(true);
  });

  it("normalizes input", () => {
    expect(getCoverage(" us ", " il ")).toMatchObject({ country: "US", region: "IL" });
    expect(getCoverage("US", "")).toMatchObject({ region: null });
    expect(getCoverage("uk", null).country).toBe("GB");
  });

  it("drops UPS and FedEx for military addresses", () => {
    const coverage = getCoverage("US", "AE");
    expect(ids(coverage).address).toEqual(["usps_informed_delivery"]);
    expect(coverage.gaps[0]).toMatch(/APO\/FPO\/DPO/);
  });

  it("flags territories as unconfirmed", () => {
    const coverage = getCoverage("US", "PR");
    expect(ids(coverage).address).toHaveLength(3);
    expect(coverage.gaps[0]).toContain("Puerto Rico");
  });

  it("covers Canada", () => {
    const coverage = getCoverage("CA", "ON");
    expect(ids(coverage)).toEqual({
      address: ["canada_post_auto_tracking", "ups_my_choice", "fedex_delivery_manager"],
      account: ["amazon_orders"],
      perPackage: ["dhl_on_demand"],
    });
    expect(coverage.fullySupported).toBe(false);
  });

  it("covers the UK honestly: no carrier lists everything for your address", () => {
    const coverage = getCoverage("GB", null);
    expect(ids(coverage)).toEqual({
      address: ["ups_my_choice", "fedex_delivery_manager"],
      account: ["evri_app", "dpd_uk_app", "amazon_orders"],
      perPackage: ["royal_mail_app", "dhl_on_demand"],
    });
    expect(coverage.gaps[0]).toMatch(/No UK carrier lists everything/);
    expect(coverage.fullySupported).toBe(false);
  });

  it("covers the Netherlands", () => {
    expect(ids(getCoverage("NL", null)).address).toEqual(["postnl_account", "ups_my_choice", "fedex_delivery_manager"]);
  });

  it("covers Germany", () => {
    const coverage = getCoverage("DE", null);
    expect(ids(coverage).address).toEqual(["dhl_paket_de", "ups_my_choice", "fedex_delivery_manager"]);
    expect(coverage.gaps.join(" ")).toMatch(/Packstation/);
  });

  it("covers Australia", () => {
    const coverage = getCoverage("AU", "NSW");
    expect(ids(coverage)).toEqual({
      address: ["ups_my_choice", "fedex_delivery_manager"],
      account: ["australia_post_mypost", "amazon_orders"],
      perPackage: ["dhl_on_demand"],
    });
  });

  it.each(["FR", "ZZ", "", "not a country"])("falls back to international programs for %j", (country) => {
    const coverage = getCoverage(country, null);
    expect(ids(coverage)).toEqual({
      address: ["ups_my_choice", "fedex_delivery_manager"],
      account: ["amazon_orders"],
      perPackage: ["dhl_on_demand"],
    });
    expect(coverage.fullySupported).toBe(false);
    expect(coverage.gaps[0]).toMatch(/We don't have carrier program details/);
  });

  it("returns programs that operate in that country", () => {
    for (const country of ["US", "CA", "GB", "NL", "DE", "AU"]) {
      const coverage = getCoverage(country, null);
      for (const program of [...coverage.addressPrograms, ...coverage.accountPrograms, ...coverage.perPackage]) {
        expect(program.countries).toContain(country);
      }
      // Each group only holds programs of that kind.
      expect(coverage.addressPrograms.every((p) => p.kind === "address")).toBe(true);
      expect(coverage.accountPrograms.every((p) => p.kind === "account")).toBe(true);
      expect(coverage.perPackage.every((p) => p.kind === "per_package")).toBe(true);
    }
  });

  it("returns a fresh gaps array each time", () => {
    getCoverage("US", null).gaps.push("mutated");
    expect(getCoverage("US", null).gaps).not.toContain("mutated");
  });
});
