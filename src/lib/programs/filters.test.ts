import { describe, expect, it } from "vitest";
import { COUNTRIES } from "@/lib/location";
import {
  EMAIL_PROVIDERS,
  PROGRAMS,
  buildFilterInstructions,
  collectSenders,
  getCoverage,
  guessEmailProvider,
  isEmailProvider,
  suggestedEmailProviders,
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
const PROVIDERS: EmailProvider[] = EMAIL_PROVIDERS.map((p) => p.id);
const REGIONAL: EmailProvider[] = ["gmx", "seznam", "mailru", "yandex", "qq", "netease", "naver", "daum"];

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

  it("keeps the Gmail query within Gmail's filter length with every program offered in any one country", () => {
    for (const { code } of COUNTRIES) {
      const coverage = getCoverage(code, null);
      const ids = [...coverage.addressPrograms, ...coverage.accountPrograms, ...coverage.perPackage].map((p) => p.id);
      const result = buildFilterInstructions("gmail", INBOUND, ids, { country: code });
      expect(result.filterQuery?.length ?? 0, code).toBeLessThan(1400);
      expect(result.caveats.join(" "), code).not.toMatch(/split the senders/);
    }
  });

  it("tells Gmail users to split an over-long filter", () => {
    const all = buildFilterInstructions("gmail", INBOUND, PROGRAMS.map((p) => p.id));
    expect(all.filterQuery?.length).toBeGreaterThan(1400);
    expect(all.caveats.join(" ")).toMatch(/split the senders across two filters/);
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
    expect(result.caveats.join(" ")).toMatch(/Yahoo! JAPAN Mail .* is a separate service/);
  });

  it("tells iCloud users to make one rule per sender", () => {
    const result = buildFilterInstructions("icloud", INBOUND, ["ups_my_choice"]);
    expect(result.steps.join(" ")).toContain("2 in total");
    expect(result.needsForwardingVerification).toBe(false);
  });

  it("gives generic instructions for other providers, with honest fallbacks", () => {
    const result = buildFilterInstructions("other", INBOUND, ["fedex_delivery_manager"]);
    expect(result.steps.join(" ")).toContain("trackingupdates@fedex.com");
    expect(result.filterQuery).toBeNull();
    const caveats = result.caveats.join(" ");
    expect(caveats).toMatch(/can't automatically forward only some messages/);
    expect(caveats).toMatch(/forward carrier emails by hand/);
    expect(caveats).toMatch(/mail app such as Thunderbird/);
    expect(caveats).toMatch(/separate free Gmail or Outlook\.com address/);
  });

  it.each(REGIONAL)("%s: a forwarding rule for the chosen senders, hedged because it's untested", (provider) => {
    const result = buildFilterInstructions(provider, INBOUND, ["dhl_paket_de", "amazon_orders"], { country: "DE" });
    expect(result.provider).toBe(provider);
    expect(result.filterQuery).toBeNull();
    const steps = result.steps.join(" ");
    expect(steps).toContain(INBOUND);
    expect(steps).toContain("paketankuendigung@dhl.de");
    expect(steps).toContain("versandbestaetigung@amazon.de");
    expect(result.verificationNote).toContain(INBOUND);
    const caveats = result.caveats.join(" ");
    expect(caveats).toMatch(/haven't been able to test these steps/);
    expect(caveats).toMatch(/forward carrier emails by hand/);
    expect(result.links.length).toBeGreaterThan(0);
  });

  it("expects a confirmation email only where the research says the provider sends one", () => {
    const confirming = REGIONAL.filter((p) => buildFilterInstructions(p, INBOUND, ["dhl_paket_de"]).needsForwardingVerification);
    expect(confirming).toEqual(["mailru", "yandex"]);
    expect(buildFilterInstructions("mailru", INBOUND, ["dhl_paket_de"]).steps.join(" ")).toMatch(
      /will probably email a confirmation link to r-k3j9x2m4q8w1@in\.example\.com/,
    );
    expect(buildFilterInstructions("seznam", INBOUND, ["dhl_paket_de"]).steps.join(" ")).toMatch(
      /If Seznam emails a confirmation to/,
    );
  });

  it("names the provider's own menu labels and regional caveats", () => {
    expect(buildFilterInstructions("gmx", INBOUND, ["dhl_paket_de"]).steps.join(" ")).toContain("Filterregeln");
    expect(buildFilterInstructions("gmx", INBOUND, ["dhl_paket_de"]).caveats.join(" ")).toMatch(/POP3\/IMAP/);
    expect(buildFilterInstructions("qq", INBOUND, ["amazon_orders"]).caveats.join(" ")).toMatch(/WeChat/);
    expect(buildFilterInstructions("naver", INBOUND, ["amazon_orders"]).caveats.join(" ")).toMatch(/KakaoTalk/);
  });

  it("says when there's nothing to forward, for regional providers too", () => {
    for (const provider of REGIONAL) {
      const result = buildFilterInstructions(provider, INBOUND, ["ontrac_notifyme"]);
      expect(result.senders).toEqual([]);
      expect(result.steps.join(" ")).toMatch(/nothing to forward/);
    }
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
    ["jane@ymail.com", "yahoo"],
    ["jane@yahoo.co.jp", "other"],
    ["jane@gmx.de", "gmx"],
    ["jane@web.de", "gmx"],
    ["jane@gmx.com", "gmx"],
    ["jane@seznam.cz", "seznam"],
    ["jane@email.cz", "seznam"],
    ["jane@mail.ru", "mailru"],
    ["jane@bk.ru", "mailru"],
    ["jane@yandex.ru", "yandex"],
    ["jane@ya.ru", "yandex"],
    ["jane@qq.com", "qq"],
    ["jane@163.com", "netease"],
    ["jane@126.com", "netease"],
    ["jane@naver.com", "naver"],
    ["jane@hanmail.net", "daum"],
    ["jane@orange.fr", "other"],
    ["jane@libero.it", "other"],
    ["jane@example.com", "other"],
    ["", "other"],
  ])("%s -> %s", (email, provider) => {
    expect(guessEmailProvider(email)).toBe(provider);
  });
});

describe("EMAIL_PROVIDERS", () => {
  it("has unique ids, labels for tabs and headings, and unique domains, with Other last", () => {
    const ids = EMAIL_PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.at(-1)).toBe("other");
    expect(ids.slice(0, 4)).toEqual(["gmail", "outlook", "yahoo", "icloud"]);
    for (const p of EMAIL_PROVIDERS) {
      expect(p.label.trim().length).toBeGreaterThan(0);
      expect(p.shortLabel.trim().length).toBeGreaterThan(0);
      expect(p.shortLabel.length).toBeLessThanOrEqual(p.label.length);
      for (const domain of p.domains) expect(guessEmailProvider(`someone@${domain}`), domain).toBe(p.id);
    }
    const domains = EMAIL_PROVIDERS.flatMap((p) => p.domains);
    expect(new Set(domains).size).toBe(domains.length);
  });

  it("recognizes provider ids", () => {
    expect(isEmailProvider("gmx")).toBe(true);
    expect(isEmailProvider("other")).toBe(true);
    expect(isEmailProvider("aol")).toBe(false);
    expect(isEmailProvider(undefined)).toBe(false);
  });
});

describe("suggestedEmailProviders", () => {
  it.each([
    ["DE", ["gmx", "gmail", "outlook", "yahoo", "icloud", "other"]],
    ["at", ["gmx", "gmail", "outlook", "yahoo", "icloud", "other"]],
    ["CZ", ["seznam", "gmail", "outlook", "yahoo", "icloud", "other"]],
    ["RU", ["mailru", "yandex", "gmail", "outlook", "yahoo", "icloud", "other"]],
    ["CN", ["qq", "netease", "gmail", "outlook", "yahoo", "icloud", "other"]],
    ["KR", ["naver", "daum", "gmail", "outlook", "yahoo", "icloud", "other"]],
    ["US", ["gmail", "outlook", "yahoo", "icloud", "other"]],
    ["JP", ["gmail", "outlook", "yahoo", "icloud", "other"]],
    ["ZZ", ["gmail", "outlook", "yahoo", "icloud", "other"]],
    [null, ["gmail", "outlook", "yahoo", "icloud", "other"]],
  ])("%s -> %j", (country, expected) => {
    expect(suggestedEmailProviders(country)).toEqual(expected);
  });

  it("only suggests providers we have instructions for", () => {
    for (const { code } of COUNTRIES) {
      for (const provider of suggestedEmailProviders(code)) expect(isEmailProvider(provider)).toBe(true);
    }
  });
});
