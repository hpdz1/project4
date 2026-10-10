import { describe, expect, it } from "vitest";
import { COUNTRIES } from "@/lib/location";
import {
  PROGRAMS,
  PROGRAMS_BY_ID,
  getProgram,
  localizeProgram,
  programOffersIn,
  programSenders,
  programSignupUrl,
} from "@/lib/programs";

/** Ids that existed before worldwide coverage; accounts store them, so they must never change. */
const ORIGINAL_PROGRAM_IDS = [
  "usps_informed_delivery",
  "ups_my_choice",
  "fedex_delivery_manager",
  "amazon_orders",
  "dhl_on_demand",
  "ontrac_notifyme",
  "canada_post_auto_tracking",
  "royal_mail_app",
  "evri_app",
  "dpd_uk_app",
  "postnl_account",
  "dhl_paket_de",
  "australia_post_mypost",
];

const SENDER_ADDRESS = /^[a-z0-9._-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;
const COUNTRY_CODES = new Set(COUNTRIES.map((c) => c.code).filter((c) => c !== "ZZ"));

describe("PROGRAMS", () => {
  it("has unique snake_case ids and keeps every original id", () => {
    const ids = PROGRAMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/);
    for (const id of ORIGINAL_PROGRAM_IDS) expect(ids).toContain(id);
    expect(Object.keys(PROGRAMS_BY_ID).sort()).toEqual([...ids].sort());
    for (const [id, program] of Object.entries(PROGRAMS_BY_ID)) expect(program.id).toBe(id);
    expect(PROGRAMS.length).toBeGreaterThan(40);
  });

  it.each(PROGRAMS.map((p) => [p.id, p] as const))("%s has complete, well-formed data", (_id, program) => {
    for (const text of [program.name, program.operator, program.shows, program.cost, program.verification, program.setupTime]) {
      expect(text.trim().length).toBeGreaterThan(0);
    }
    expect(program.countries.length).toBeGreaterThan(0);
    for (const country of program.countries) expect(COUNTRY_CODES.has(country), country).toBe(true);
    const urls = [program.signupUrl, program.dashboardUrl, ...Object.values(program.signupUrlByCountry ?? {})];
    for (const url of urls.filter((u): u is string => typeof u === "string")) {
      expect(new URL(url).protocol).toBe("https:");
    }
    for (const country of Object.keys(program.signupUrlByCountry ?? {})) expect(program.countries).toContain(country);
    const senderLists = [program.emailAlerts.senders, ...Object.values(program.emailAlerts.sendersByCountry ?? {})];
    for (const senders of senderLists) {
      expect(new Set(senders).size).toBe(senders?.length);
      for (const sender of senders ?? []) expect(sender).toMatch(SENDER_ADDRESS);
    }
    for (const country of Object.keys(program.emailAlerts.sendersByCountry ?? {})) {
      expect(program.countries).toContain(country);
      expect(program.emailAlerts.sendersByCountry?.[country]?.length).toBeGreaterThan(0);
    }
    // Programs with steps to enable email alerts must say who sends them, and vice versa.
    expect(program.emailAlerts.howToEnable.length > 0).toBe(program.emailAlerts.senders.length > 0);
    expect(program.gotchas.length).toBeGreaterThan(0);
    // Without a sender to forward, the gotchas must say why (app / text only, or sender unconfirmed).
    if (program.emailAlerts.senders.length === 0) {
      expect(program.gotchas.join(" ")).toMatch(/email|text message/i);
    }
    // "shows" is one sentence.
    expect(program.shows.match(/[.!?](\s|$)/g)?.length).toBe(1);
    // The badge says "Free" only when the cost starts with it.
    expect(program.cost).toMatch(/^(Free|Paid)/);
  });

  it("marks only the US carriers we fully parse as full support", () => {
    const full = PROGRAMS.filter((p) => p.parserSupport === "full").map((p) => p.id);
    expect(full.sort()).toEqual(
      ["amazon_orders", "dhl_on_demand", "fedex_delivery_manager", "ups_my_choice", "usps_informed_delivery"].sort(),
    );
    for (const program of PROGRAMS.filter((p) => !p.countries.includes("US"))) {
      expect(program.parserSupport, program.id).toBe("basic");
    }
  });

  it("links the three guides", () => {
    expect(PROGRAMS_BY_ID.usps_informed_delivery.guideSlug).toBe("usps-informed-delivery");
    expect(PROGRAMS_BY_ID.ups_my_choice.guideSlug).toBe("ups-my-choice");
    expect(PROGRAMS_BY_ID.fedex_delivery_manager.guideSlug).toBe("fedex-delivery-manager");
    expect(PROGRAMS.filter((p) => p.guideSlug !== null)).toHaveLength(3);
  });

  it("states the honest details users need", () => {
    expect(PROGRAMS_BY_ID.ups_my_choice.cost).toMatch(/free basic membership; optional Premium \(about \$19\.99\/yr/i);
    expect(PROGRAMS_BY_ID.usps_informed_delivery.gotchas.join(" ")).toMatch(/apartments/i);
    expect(PROGRAMS_BY_ID.usps_informed_delivery.verification).toMatch(/mailed/);
    expect(PROGRAMS_BY_ID.ups_my_choice.setupTime).toMatch(/7–14 days/);
    expect(PROGRAMS_BY_ID.amazon_orders.kind).toBe("account");
    expect(PROGRAMS_BY_ID.ontrac_notifyme.emailAlerts.senders).toEqual([]);
    expect(PROGRAMS_BY_ID.swiss_post_my_consignments.verification).toMatch(/letter/);
    expect(PROGRAMS_BY_ID.sagawa_smart_club.gotchas.join(" ")).toMatch(/security incident/);
    expect(PROGRAMS_BY_ID.posta_kenya_mpost.cost).toMatch(/^Paid/);
  });

  it("only calls a program address-based when it matches parcels by address", () => {
    const address = PROGRAMS.filter((p) => p.kind === "address").map((p) => p.id);
    expect(address.sort()).toEqual(
      [
        "austrian_post_app",
        "canada_post_auto_tracking",
        "dhl_paket_de",
        "fedex_delivery_manager",
        "japan_post_e_delivery",
        "postnl_account",
        "swiss_post_my_consignments",
        "ups_my_choice",
        "usps_informed_delivery",
      ].sort(),
    );
  });

  it("limits FedEx Delivery Manager sign-up to US and Canadian homes and says the international version is shipper-enabled", () => {
    expect(PROGRAMS_BY_ID.fedex_delivery_manager.countries).toEqual(["US", "CA"]);
    const intl = PROGRAMS_BY_ID.fedex_delivery_manager_intl;
    expect(intl.kind).toBe("per_package");
    expect(intl.worldwide).toBe(true);
    expect(intl.shows).toMatch(/only when the shipper has switched Delivery Manager on; you can't sign up/);
    expect(intl.countries).not.toContain("US");
    expect(intl.countries).not.toContain("CA");
  });

  it("lists DHL On Demand Delivery everywhere and Amazon where it has a marketplace", () => {
    expect(PROGRAMS_BY_ID.dhl_on_demand.worldwide).toBe(true);
    expect(PROGRAMS_BY_ID.dhl_on_demand.gotchas.join(" ")).toMatch(/150 countries/);
    expect([...PROGRAMS_BY_ID.amazon_orders.countries].sort()).toEqual(
      ["US", "CA", "MX", "BR", "GB", "IE", "DE", "FR", "IT", "ES", "NL", "BE", "SE", "PL", "TR", "AE", "SA", "EG", "IN", "JP", "AU", "SG"].sort(),
    );
    expect(PROGRAMS_BY_ID.amazon_orders.worldwide).toBeUndefined();
  });

  it("uses research-confirmed carrier senders", () => {
    expect(PROGRAMS_BY_ID.usps_informed_delivery.emailAlerts.senders).toContain(
      "uspsinformeddelivery@email.informeddelivery.usps.com",
    );
    expect(PROGRAMS_BY_ID.usps_informed_delivery.emailAlerts.senders).toContain("auto-reply@usps.com");
    expect(PROGRAMS_BY_ID.ups_my_choice.emailAlerts.senders).toContain("mcinfo@ups.com");
    expect(PROGRAMS_BY_ID.fedex_delivery_manager.emailAlerts.senders).toContain("trackingupdates@fedex.com");
    expect(PROGRAMS_BY_ID.amazon_orders.emailAlerts.senders).toContain("shipment-tracking@amazon.com");
    expect(PROGRAMS_BY_ID.dhl_on_demand.emailAlerts.senders).toContain("noreply.odd@dhl.com");
    expect(PROGRAMS_BY_ID.swiss_post_my_consignments.emailAlerts.senders).toEqual(["notifications@post.ch"]);
    expect(PROGRAMS_BY_ID.austrian_post_app.emailAlerts.senders).toEqual(["meinesendung@post.at"]);
    expect(PROGRAMS_BY_ID.hermes_de_emails.emailAlerts.senders).toContain("noreply@paketankuendigung.myhermes.de");
    expect(PROGRAMS_BY_ID.japan_post_e_delivery.emailAlerts.senders).toContain("info@delivery.post.japanpost.jp");
    expect(PROGRAMS_BY_ID.sagawa_smart_club.emailAlerts.senders).toEqual(["info-nimotsu@sagawa-exp.co.jp"]);
    expect(PROGRAMS_BY_ID.la_poste_mes_suivis.emailAlerts.senders).toEqual(["noreply@notif-colissimo-laposte.info"]);
    expect(PROGRAMS_BY_ID.purolator_emails.emailAlerts.senders).toEqual(["notificationservice@purolator.com"]);
    expect(PROGRAMS_BY_ID.dhl_paket_de.emailAlerts.senders).toEqual(
      expect.arrayContaining(["noreply@dhl.de", "paketankuendigung@dhl.de", "zustellung@dhl.de", "sendungsupdate@dhl.de"]),
    );
    expect(PROGRAMS_BY_ID.aramex_emails.emailAlerts.senders).toEqual(["epod@aramex.com"]);
  });

  it("doesn't guess senders the research couldn't confirm", () => {
    for (const id of ["correos_app", "seur_miseur", "poste_italiane_posteplus", "yamato_kuroneko_members", "nz_post_app", "dpd_be"]) {
      expect(PROGRAMS_BY_ID[id].emailAlerts.senders, id).toEqual([]);
    }
  });
});

describe("getProgram / programSenders / programSignupUrl / programOffersIn", () => {
  it("looks programs up by id", () => {
    expect(getProgram("ups_my_choice")?.name).toBe("UPS My Choice");
    expect(getProgram("swiss_post_my_consignments")?.operator).toBe("Swiss Post");
    expect(getProgram("nope")).toBeNull();
    expect(getProgram("toString")).toBeNull();
    expect(getProgram(42 as unknown as string)).toBeNull();
  });

  it("uses regional senders when a country has them", () => {
    const amazon = PROGRAMS_BY_ID.amazon_orders;
    expect(programSenders(amazon)).toContain("order-update@amazon.com");
    expect(programSenders(amazon, "gb")).toEqual([
      "shipment-tracking@amazon.co.uk",
      "order-update@amazon.co.uk",
      "auto-confirm@amazon.co.uk",
    ]);
    expect(programSenders(amazon, "IT")).toContain("conferma-spedizione@amazon.it");
    expect(programSenders(amazon, "JP")).toContain("auto-confirm@amazon.co.jp");
    expect(programSenders(amazon, "LI")).toEqual(amazon.emailAlerts.senders);
    expect(programSenders(PROGRAMS_BY_ID.fedex_delivery_manager, "CA")).toContain("fedexcanada@fedex.com");
    expect(programSenders(PROGRAMS_BY_ID.gls_app, "AT")).toContain("noreply@gls-rtt.com");
  });

  it("uses country-specific sign-up pages", () => {
    const postnord = PROGRAMS_BY_ID.postnord_app;
    expect(programSignupUrl(postnord, "dk")).toBe("https://www.postnord.dk/en/tools/app-postnord/");
    expect(programSignupUrl(postnord, "SE")).toBe(postnord.signupUrl);
    expect(programSignupUrl(postnord)).toBe(postnord.signupUrl);
    expect(programSignupUrl(PROGRAMS_BY_ID.amazon_orders, "DE")).toBe("https://www.amazon.de/");
    expect(programSignupUrl(PROGRAMS_BY_ID.ups_my_choice, "CA")).toBe("https://www.ups.com/ca/en/track/ups-my-choice");
  });

  it("knows where a program operates", () => {
    expect(programOffersIn(PROGRAMS_BY_ID.swiss_post_my_consignments, "li")).toBe(true);
    expect(programOffersIn(PROGRAMS_BY_ID.swiss_post_my_consignments, "DE")).toBe(false);
    expect(programOffersIn(PROGRAMS_BY_ID.dhl_on_demand, "KE")).toBe(true);
  });

  it("localizes a program without touching the original", () => {
    const amazon = PROGRAMS_BY_ID.amazon_orders;
    const de = localizeProgram(amazon, "DE");
    expect(de.signupUrl).toBe("https://www.amazon.de/");
    expect(de.emailAlerts.senders).toContain("versandbestaetigung@amazon.de");
    expect(amazon.signupUrl).toMatch(/amazon\.com\//);
    expect(amazon.emailAlerts.senders).toContain("shipment-tracking@amazon.com");
    expect(localizeProgram(PROGRAMS_BY_ID.usps_informed_delivery, "US")).toBe(PROGRAMS_BY_ID.usps_informed_delivery);
  });
});
