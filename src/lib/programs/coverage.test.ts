import { describe, expect, it } from "vitest";
import { USPS_SERVED_COUNTRY_CODES } from "@/lib/location";
import { getCoverage, programOffersIn, type Coverage } from "@/lib/programs";

const ids = (coverage: Coverage) => ({
  address: coverage.addressPrograms.map((p) => p.id),
  account: coverage.accountPrograms.map((p) => p.id),
  perPackage: coverage.perPackage.map((p) => p.id),
});

const allPrograms = (coverage: Coverage) => [...coverage.addressPrograms, ...coverage.accountPrograms, ...coverage.perPackage];

/** ~35 countries across every region, plus a US territory and "Other". */
const COUNTRIES = [
  "US", "CA", "MX", "BR", "AR", "CL", "CO", "PE",
  "GB", "IE", "DE", "FR", "NL", "BE", "CH", "AT", "IT", "ES", "PT", "PL", "CZ", "SE", "DK", "NO", "FI", "EE", "RO", "HU",
  "JP", "KR", "CN", "HK", "TW", "SG", "IN", "TH", "AU", "NZ",
  "IL", "SA", "AE", "TR", "EG", "ZA", "NG", "KE",
  "PR", "ZZ",
];

describe("getCoverage: every country", () => {
  it.each(COUNTRIES)("%s: programs that operate there, grouped by kind, with honest gaps", (country) => {
    const coverage = getCoverage(country, null);
    expect(coverage.country).toBe(country);
    const usServed = country === "US" || USPS_SERVED_COUNTRY_CODES.has(country);
    for (const program of allPrograms(coverage)) {
      if (country === "ZZ") continue;
      expect(programOffersIn(program, usServed ? "US" : country), `${program.id} in ${country}`).toBe(true);
    }
    expect(coverage.addressPrograms.every((p) => p.kind === "address")).toBe(true);
    expect(coverage.accountPrograms.every((p) => p.kind === "account")).toBe(true);
    expect(coverage.perPackage.every((p) => p.kind === "per_package")).toBe(true);
    const all = allPrograms(coverage).map((p) => p.id);
    expect(new Set(all).size).toBe(all.length);
    // DHL Express On Demand Delivery is offered nearly everywhere.
    if (!["AE", "AP", "AA"].includes(country)) expect(all).toContain("dhl_on_demand");
    expect(coverage.gaps.length).toBeGreaterThan(0);
    for (const gap of coverage.gaps) expect(gap.trim().length).toBeGreaterThan(10);
    expect(coverage.fullySupported).toBe(usServed);
    if (usServed) expect(coverage.basicParsing).toEqual([]);
    else {
      expect(coverage.gaps.at(-1)).toMatch(/basic mode: we pick up tracking numbers and common status words/);
      // Basic-mode operators all have programs listed here.
      const operators = new Set(allPrograms(coverage).map((p) => p.operator));
      for (const operator of coverage.basicParsing) expect(operators.has(operator)).toBe(true);
    }
  });

  it.each([
    ["MX", "Correos de México"],
    ["AR", "Correo Argentino"],
    ["EG", "Egypt Post"],
    ["ZA", "the South African Post Office"],
    ["IN", "India Post"],
    ["SG", "SingPost"],
    ["TR", "PTT"],
    ["HK", "Hongkong Post"],
    ["HU", "Magyar Posta"],
    ["GR", "your national postal service"],
  ])("%s has no national program and says so honestly", (country, post) => {
    const coverage = getCoverage(country, null);
    expect(coverage.gaps).toContain(
      `We don't know of a service from ${post} that lists parcels heading to you automatically. Forward your shipping and carrier emails anyway — Package Radar picks up tracking numbers from them.`,
    );
    expect(coverage.addressPrograms.filter((p) => p.id !== "ups_my_choice")).toEqual([]);
  });

  it("never claims more than it knows about UPS My Choice", () => {
    expect(getCoverage("MX", null).gaps).toContain(
      "UPS My Choice is offered in many countries, but we couldn't confirm it's available in Mexico. If UPS delivers to you, check ups.com.",
    );
    expect(ids(getCoverage("MX", null)).address).toEqual([]);
    expect(ids(getCoverage("JP", null)).address).toContain("ups_my_choice");
  });
});

describe("getCoverage: the US", () => {
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
    expect(coverage.basicParsing).toEqual([]);
    expect(coverage.gaps.some((g) => g.startsWith("Amazon packages someone else ordered for you"))).toBe(true);
    expect(coverage.gaps.join(" ")).not.toMatch(/basic mode/);
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

  it("flags territories as unconfirmed, whether picked as a state or as a country", () => {
    const asState = getCoverage("US", "PR");
    expect(ids(asState).address).toHaveLength(3);
    expect(asState.gaps[0]).toContain("Puerto Rico");
    const asCountry = getCoverage("PR", null);
    expect(asCountry).toMatchObject({ country: "PR", region: null, fullySupported: true });
    expect(ids(asCountry)).toEqual(ids(asState));
    expect(asCountry.gaps[0]).toContain("Puerto Rico");
    expect(getCoverage("GU", "GU").gaps[0]).toContain("Guam");
  });
});

describe("getCoverage: country details", () => {
  it("covers Canada", () => {
    const coverage = getCoverage("CA", "ON");
    expect(ids(coverage)).toEqual({
      address: ["canada_post_auto_tracking", "ups_my_choice", "fedex_delivery_manager"],
      account: ["amazon_orders"],
      perPackage: ["purolator_emails", "intelcom_emails", "dhl_on_demand"],
    });
    expect(coverage.fullySupported).toBe(false);
    // Canadian homes can sign up for FedEx Delivery Manager on FedEx's Canadian page.
    expect(coverage.addressPrograms[2].signupUrl).toBe("https://www.fedex.com/en-ca/delivery-manager/personal.html");
    expect(coverage.accountPrograms[0].emailAlerts.senders).toContain("shipment-tracking@amazon.ca");
  });

  it("covers the UK honestly: no carrier lists everything for your address", () => {
    const coverage = getCoverage("GB", null);
    expect(ids(coverage)).toEqual({
      address: ["ups_my_choice"],
      account: ["evri_app", "dpd_uk_app", "amazon_orders"],
      perPackage: ["royal_mail_app", "dhl_on_demand", "fedex_delivery_manager_intl"],
    });
    expect(coverage.gaps[0]).toMatch(/No UK carrier lists everything/);
    expect(coverage.basicParsing).toEqual(["Evri", "DPD UK", "Royal Mail", "FedEx"]);
    expect(coverage.fullySupported).toBe(false);
  });

  it("covers the Netherlands", () => {
    expect(ids(getCoverage("NL", null))).toEqual({
      address: ["postnl_account", "ups_my_choice"],
      account: ["dhl_parcel_nl", "dpd_nl", "amazon_orders"],
      perPackage: ["mondial_relay_emails", "dhl_on_demand", "fedex_delivery_manager_intl"],
    });
  });

  it("covers Germany", () => {
    const coverage = getCoverage("DE", null);
    expect(ids(coverage)).toEqual({
      address: ["dhl_paket_de", "ups_my_choice"],
      account: ["dpd_de", "gls_app", "amazon_orders"],
      perPackage: ["hermes_de_emails", "dhl_on_demand", "fedex_delivery_manager_intl"],
    });
    expect(coverage.gaps.join(" ")).toMatch(/Packstation/);
    expect(coverage.accountPrograms[2].emailAlerts.senders).toContain("versandbestaetigung@amazon.de");
  });

  it("covers Australia", () => {
    expect(ids(getCoverage("AU", "NSW"))).toEqual({
      address: ["ups_my_choice"],
      account: ["australia_post_mypost", "aramex_receiving_mode", "amazon_orders"],
      perPackage: ["dhl_on_demand", "fedex_delivery_manager_intl"],
    });
  });

  it("covers Switzerland and Liechtenstein with Swiss Post's address-verified program", () => {
    expect(ids(getCoverage("CH", null)).address).toEqual(["swiss_post_my_consignments", "ups_my_choice"]);
    expect(ids(getCoverage("LI", null)).address).toEqual(["swiss_post_my_consignments"]);
  });

  it("covers France, Spain, Italy and Poland with account-based programs", () => {
    expect(ids(getCoverage("FR", null)).account).toEqual(["la_poste_mes_suivis", "amazon_orders"]);
    expect(ids(getCoverage("ES", null)).account).toEqual(["correos_app", "seur_miseur", "amazon_orders"]);
    expect(ids(getCoverage("IT", null)).account).toEqual(["poste_italiane_posteplus", "amazon_orders"]);
    expect(ids(getCoverage("PL", null)).account).toEqual([
      "inpost_mobile",
      "pocztex_mobile",
      "moj_dhl_pl",
      "allegro_orders",
      "amazon_orders",
    ]);
  });

  it("covers Belgium with bpost and DPD's postcode-matched consignee profile", () => {
    const coverage = getCoverage("BE", null);
    expect(ids(coverage).account).toEqual(["bpost_app", "dpd_be", "amazon_orders"]);
    expect(coverage.gaps[0]).toMatch(/plus your postcode/);
  });

  it("lists Aramex's per-shipment emails in the UAE and Saudi Arabia", () => {
    for (const country of ["AE", "SA"]) {
      const coverage = getCoverage(country, null);
      expect(ids(coverage).perPackage, country).toContain("aramex_emails");
      expect(coverage.basicParsing, country).toContain("Aramex");
    }
    expect(ids(getCoverage("AU", null)).perPackage).not.toContain("aramex_emails");
  });

  it("uses each country's sign-up page and senders", () => {
    const dk = getCoverage("DK", null).accountPrograms.find((p) => p.id === "postnord_app");
    expect(dk?.signupUrl).toBe("https://www.postnord.dk/en/tools/app-postnord/");
    const at = getCoverage("AT", null).accountPrograms.find((p) => p.id === "gls_app");
    expect(at?.emailAlerts.senders).toEqual(["noreply@gls-group.eu", "noreply@gls-rtt.com"]);
    const nz = getCoverage("NZ", null).accountPrograms.find((p) => p.id === "aramex_receiving_mode");
    expect(nz?.signupUrl).toMatch(/aramex\.co\.nz/);
  });

  it("covers Japan with its three carriers and warns about forwarding gaps", () => {
    const coverage = getCoverage("JP", null);
    expect(ids(coverage)).toEqual({
      address: ["japan_post_e_delivery", "ups_my_choice"],
      account: ["yamato_kuroneko_members", "sagawa_smart_club", "amazon_orders"],
      perPackage: ["dhl_on_demand", "fedex_delivery_manager_intl"],
    });
    expect(coverage.gaps.join(" ")).toMatch(/Yamato Kuroneko Members, so those parcels only show up here if you forward/);
  });

  it("says when a country's programs only notify by app or text message", () => {
    for (const country of ["KR", "CN", "BR", "IL", "SA", "AE", "KE"]) {
      expect(getCoverage(country, null).gaps.join(" "), country).toMatch(/couldn't find email alerts we can forward/);
    }
  });

  it.each(["ZZ", "", "not a country", "XX"])("treats %j as Other and lists the international programs", (country) => {
    const coverage = getCoverage(country, null);
    expect(coverage.country).toBe("ZZ");
    expect(ids(coverage)).toEqual({
      address: ["ups_my_choice"],
      account: ["amazon_orders"],
      perPackage: ["dhl_on_demand", "fedex_delivery_manager_intl"],
    });
    expect(coverage.fullySupported).toBe(false);
    expect(coverage.gaps[0]).toMatch(/^Choose your country/);
  });

  it("returns a fresh gaps array each time", () => {
    getCoverage("US", null).gaps.push("mutated");
    expect(getCoverage("US", null).gaps).not.toContain("mutated");
    getCoverage("DE", null).gaps.push("mutated");
    expect(getCoverage("DE", null).gaps).not.toContain("mutated");
  });
});
