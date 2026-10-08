import { describe, expect, it } from "vitest";
import {
  EMAIL_PROVIDERS,
  PROGRAMS,
  buildFilterInstructions,
  collectSenders,
  guessEmailProvider,
  type EmailProvider,
} from "@/lib/programs";
import type { ProgramId } from "@/lib/types";

const INBOUND = "r-k3j9x2m4q8w1@in.example.com";
const US_PROGRAMS: ProgramId[] = [
  "usps_informed_delivery",
  "ups_my_choice",
  "fedex_delivery_manager",
  "amazon_orders",
  "dhl_on_demand",
  "ontrac_notifyme",
];
const PROVIDERS: EmailProvider[] = ["gmail", "outlook", "yahoo", "icloud", "other"];

describe("collectSenders", () => {
  it("dedupes and keeps program order", () => {
    const senders = collectSenders(["ups_my_choice", "ups_my_choice", "usps_informed_delivery"]);
    expect(senders).toEqual([
      "mcinfo@ups.com",
      "pkginfo@ups.com",
      "uspsinformeddelivery@email.informeddelivery.usps.com",
      "uspsinformeddelivery@informeddelivery.usps.com",
      "auto-reply@usps.com",
      "auto-reply@tracking.usps.com",
    ]);
  });

  it("ignores unknown ids and programs without email alerts", () => {
    expect(collectSenders(["ontrac_notifyme", "bogus" as ProgramId])).toEqual([]);
  });

  it("uses regional senders and validated extras", () => {
    const senders = collectSenders(["amazon_orders"], {
      country: "GB",
      extraSenders: ["Test@Verify.Example.com", "evil) OR (x", "", "verify.example.com"],
    });
    expect(senders).toEqual([
      "shipment-tracking@amazon.co.uk",
      "order-update@amazon.co.uk",
      "auto-confirm@amazon.co.uk",
      "test@verify.example.com",
      "verify.example.com",
    ]);
  });
});

describe("buildFilterInstructions", () => {
  it.each(PROVIDERS)("%s mentions the inbound address and lists senders", (provider) => {
    const result = buildFilterInstructions(provider, INBOUND, US_PROGRAMS);
    expect(result.provider).toBe(provider);
    expect(result.label).toBe(EMAIL_PROVIDERS.find((p) => p.id === provider)?.label);
    expect(result.steps.some((step) => step.includes(INBOUND))).toBe(true);
    expect(result.senders).toEqual(collectSenders(US_PROGRAMS));
    expect(result.senders).toContain("mcinfo@ups.com");
    for (const link of result.links) expect(new URL(link.url).protocol).toBe("https:");
  });

  it("builds a Gmail from:(… OR …) query and requires confirming the forwarding address first", () => {
    const result = buildFilterInstructions("gmail", INBOUND, ["usps_informed_delivery", "ups_my_choice"]);
    expect(result.filterQuery).toBe(
      "from:(uspsinformeddelivery@email.informeddelivery.usps.com OR uspsinformeddelivery@informeddelivery.usps.com OR auto-reply@usps.com OR auto-reply@tracking.usps.com OR mcinfo@ups.com OR pkginfo@ups.com)",
    );
    expect(result.needsForwardingVerification).toBe(true);
    expect(result.verificationNote).toContain(INBOUND);
    // The forwarding address is added and confirmed before the filter is created.
    const addIndex = result.steps.findIndex((s) => s.includes("Add a forwarding address"));
    const confirmIndex = result.steps.findIndex((s) => s.includes("Confirm"));
    const filterIndex = result.steps.findIndex((s) => s.includes("Create a new filter"));
    expect(addIndex).toBeGreaterThanOrEqual(0);
    expect(addIndex).toBeLessThan(confirmIndex);
    expect(confirmIndex).toBeLessThan(filterIndex);
    expect(result.steps.join(" ")).toContain('"Forward it to"');
    expect(result.steps.join(" ")).toContain("Disable forwarding");
    const prefilled = result.links.find((l) => l.url.includes("#create-filter/from="));
    expect(decodeURIComponent(prefilled?.url.split("from=")[1] ?? "")).toBe(
      result.filterQuery?.slice("from:(".length, -1),
    );
  });

  it("keeps the Gmail query within Gmail's filter length even with every program", () => {
    const all = buildFilterInstructions("gmail", INBOUND, PROGRAMS.map((p) => p.id));
    expect(all.filterQuery?.length).toBeLessThan(1400);
    expect(all.caveats.join(" ")).not.toMatch(/split the senders/);
  });

  it("uses regional senders for the account's country", () => {
    const result = buildFilterInstructions("gmail", INBOUND, ["amazon_orders"], { country: "DE" });
    expect(result.filterQuery).toContain("versandbestaetigung@amazon.de");
    expect(result.filterQuery).not.toContain("amazon.com");
  });

  it("warns Outlook users about Microsoft 365 blocking external forwarding", () => {
    const result = buildFilterInstructions("outlook", INBOUND, US_PROGRAMS);
    expect(result.filterQuery).toBeNull();
    expect(result.needsForwardingVerification).toBe(false);
    expect(result.caveats.join(" ")).toMatch(/Microsoft 365.*block/);
    expect(result.steps.join(" ")).toContain("Redirect to");
  });

  it("explains Yahoo's paid-plan and forward-everything limits", () => {
    const result = buildFilterInstructions("yahoo", INBOUND, US_PROGRAMS);
    expect(result.needsForwardingVerification).toBe(true);
    expect(result.steps[0]).toMatch(/Yahoo Mail Plus/);
    expect(result.caveats.join(" ")).toMatch(/forwards everything/);
  });

  it("tells iCloud users to make one rule per sender", () => {
    const result = buildFilterInstructions("icloud", INBOUND, ["ups_my_choice"]);
    expect(result.steps.join(" ")).toContain("2 in total");
    expect(result.needsForwardingVerification).toBe(false);
  });

  it("gives generic instructions for other providers", () => {
    const result = buildFilterInstructions("other", INBOUND, ["fedex_delivery_manager"]);
    expect(result.steps.join(" ")).toContain("trackingupdates@fedex.com");
    expect(result.filterQuery).toBeNull();
  });

  it("handles nothing to forward and bad input without throwing", () => {
    const empty = buildFilterInstructions("gmail", INBOUND, ["ontrac_notifyme"]);
    expect(empty.filterQuery).toBeNull();
    expect(empty.senders).toEqual([]);
    expect(empty.steps.join(" ")).toMatch(/nothing to forward/);
    const weird = buildFilterInstructions("aol" as EmailProvider, "  ", ["ups_my_choice"]);
    expect(weird.provider).toBe("other");
    expect(weird.steps.join(" ")).toContain("your Package Radar address");
  });
});

describe("guessEmailProvider", () => {
  it.each([
    ["jane@gmail.com", "gmail"],
    ["Jane@GoogleMail.com", "gmail"],
    ["jane@outlook.com", "outlook"],
    ["jane@hotmail.co.uk", "outlook"],
    ["jane@live.com", "outlook"],
    ["jane@yahoo.com", "yahoo"],
    ["jane@yahoo.co.uk", "yahoo"],
    ["jane@icloud.com", "icloud"],
    ["jane@me.com", "icloud"],
    ["jane@example.com", "other"],
    ["", "other"],
  ])("%s -> %s", (email, provider) => {
    expect(guessEmailProvider(email)).toBe(provider);
  });
});
