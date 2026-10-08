import { describe, expect, it } from "vitest";
import { PROGRAMS, PROGRAMS_BY_ID, getProgram, programSenders } from "@/lib/programs";
import type { ProgramId } from "@/lib/types";

/** `satisfies` makes the compiler fail if a ProgramId is added to types.ts but not here. */
const ALL_PROGRAM_IDS = {
  usps_informed_delivery: true,
  ups_my_choice: true,
  fedex_delivery_manager: true,
  amazon_orders: true,
  dhl_on_demand: true,
  ontrac_notifyme: true,
  canada_post_auto_tracking: true,
  royal_mail_app: true,
  evri_app: true,
  dpd_uk_app: true,
  postnl_account: true,
  dhl_paket_de: true,
  australia_post_mypost: true,
} as const satisfies Record<ProgramId, true>;

const SENDER_ADDRESS = /^[a-z0-9._-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

describe("PROGRAMS", () => {
  it("has every ProgramId exactly once", () => {
    const ids = PROGRAMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(Object.keys(ALL_PROGRAM_IDS).sort());
    for (const [id, program] of Object.entries(PROGRAMS_BY_ID)) expect(program.id).toBe(id);
  });

  it.each(PROGRAMS.map((p) => [p.id, p] as const))("%s has complete, well-formed data", (_id, program) => {
    for (const text of [program.name, program.operator, program.shows, program.cost, program.verification, program.setupTime]) {
      expect(text.trim().length).toBeGreaterThan(0);
    }
    expect(program.countries.length).toBeGreaterThan(0);
    for (const country of program.countries) expect(country).toMatch(/^[A-Z]{2}$/);
    for (const url of [program.signupUrl, program.dashboardUrl].filter((u): u is string => u !== null)) {
      expect(new URL(url).protocol).toBe("https:");
    }
    const senderLists = [program.emailAlerts.senders, ...Object.values(program.emailAlerts.sendersByCountry ?? {})];
    for (const senders of senderLists) {
      expect(new Set(senders).size).toBe(senders?.length);
      for (const sender of senders ?? []) expect(sender).toMatch(SENDER_ADDRESS);
    }
    // Programs with steps to enable email alerts must say who sends them, and vice versa.
    expect(program.emailAlerts.howToEnable.length > 0).toBe(program.emailAlerts.senders.length > 0);
    expect(program.gotchas.length).toBeGreaterThan(0);
    // "shows" is one sentence.
    expect(program.shows.match(/[.!?](\s|$)/g)?.length).toBe(1);
  });

  it("marks only the US carriers we fully parse as full support", () => {
    const full = PROGRAMS.filter((p) => p.parserSupport === "full").map((p) => p.id);
    expect(full.sort()).toEqual(
      ["amazon_orders", "dhl_on_demand", "fedex_delivery_manager", "ups_my_choice", "usps_informed_delivery"].sort(),
    );
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
  });
});

describe("getProgram / programSenders", () => {
  it("looks programs up by id", () => {
    expect(getProgram("ups_my_choice")?.name).toBe("UPS My Choice");
    expect(getProgram("nope")).toBeNull();
    expect(getProgram("toString")).toBeNull();
  });

  it("uses regional senders when a country has them", () => {
    const amazon = PROGRAMS_BY_ID.amazon_orders;
    expect(programSenders(amazon)).toContain("order-update@amazon.com");
    expect(programSenders(amazon, "gb")).toEqual([
      "shipment-tracking@amazon.co.uk",
      "order-update@amazon.co.uk",
      "auto-confirm@amazon.co.uk",
    ]);
    expect(programSenders(amazon, "FR")).toEqual(amazon.emailAlerts.senders);
    expect(programSenders(PROGRAMS_BY_ID.fedex_delivery_manager, "CA")).toContain("fedexcanada@fedex.com");
  });
});
