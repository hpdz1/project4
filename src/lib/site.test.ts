import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_OPERATOR_NAME,
  LEGAL_EFFECTIVE_DATE,
  SITE_NAME,
  absoluteUrl,
  adsenseScriptSrc,
  buildSitemap,
  missingOperatorSettings,
  normalizeContactEmail,
  normalizeSiteUrl,
  pageMetadata,
  parseAdSlot,
  parseAdsenseClient,
  parseOperator,
  parseOperatorCountry,
  parseOptionalText,
  publisherIdFromClient,
} from "./site";

describe("normalizeSiteUrl", () => {
  it("defaults to localhost when unset or blank", () => {
    expect(normalizeSiteUrl(undefined)).toBe("http://localhost:3000");
    expect(normalizeSiteUrl("   ")).toBe("http://localhost:3000");
  });

  it("strips trailing slashes", () => {
    expect(normalizeSiteUrl("https://packageradar.example/")).toBe(
      "https://packageradar.example",
    );
    expect(normalizeSiteUrl("https://packageradar.example//")).toBe(
      "https://packageradar.example",
    );
  });

  it("keeps a path prefix but drops query and hash", () => {
    expect(normalizeSiteUrl("https://example.com/radar/?x=1#y")).toBe(
      "https://example.com/radar",
    );
  });

  it("rejects non-http URLs and garbage", () => {
    expect(normalizeSiteUrl("ftp://example.com")).toBe("http://localhost:3000");
    expect(normalizeSiteUrl("not a url")).toBe("http://localhost:3000");
  });
});

describe("normalizeContactEmail", () => {
  it("accepts a plausible address", () => {
    expect(normalizeContactEmail(" help@packageradar.example ")).toBe(
      "help@packageradar.example",
    );
  });

  it("falls back to the default", () => {
    expect(normalizeContactEmail(undefined)).toBe("hello@example.com");
    expect(normalizeContactEmail("nope")).toBe("hello@example.com");
    expect(normalizeContactEmail("a b@c.d")).toBe("hello@example.com");
  });

  it("falls back to a given address", () => {
    expect(normalizeContactEmail(undefined, "team@x.example")).toBe("team@x.example");
    expect(normalizeContactEmail("nope", "team@x.example")).toBe("team@x.example");
    expect(normalizeContactEmail("p@x.example", "team@x.example")).toBe("p@x.example");
  });
});

describe("legal pages", () => {
  it("are effective from the worldwide rewrite", () => {
    expect(LEGAL_EFFECTIVE_DATE).toBe("2026-10-10");
  });
});

describe("parseOptionalText", () => {
  it("is null when unset or blank", () => {
    expect(parseOptionalText(undefined)).toBeNull();
    expect(parseOptionalText("")).toBeNull();
    expect(parseOptionalText("  \n\t ")).toBeNull();
  });

  it("trims and collapses whitespace", () => {
    expect(parseOptionalText("  Example Labs \n Ltd ")).toBe("Example Labs Ltd");
  });

  it("caps very long values at 300 characters", () => {
    const value = parseOptionalText("x".repeat(500));
    expect(value).toHaveLength(300);
  });
});

describe("parseOperatorCountry", () => {
  it("turns ISO codes into English country names", () => {
    expect(parseOperatorCountry("DE")).toBe("Germany");
    expect(parseOperatorCountry(" gb ")).toBe("United Kingdom");
    expect(parseOperatorCountry("US")).toBe("United States");
  });

  it("keeps unknown codes and free text as typed", () => {
    expect(parseOperatorCountry("QQ")).toBe("QQ");
    expect(parseOperatorCountry("ZZ")).toBe("ZZ");
    expect(parseOperatorCountry("the State of Delaware, United States")).toBe(
      "the State of Delaware, United States",
    );
  });

  it("is null when unset", () => {
    expect(parseOperatorCountry(undefined)).toBeNull();
    expect(parseOperatorCountry("   ")).toBeNull();
  });
});

describe("parseOperator", () => {
  it("defaults to a generic name and the contact email", () => {
    const operator = parseOperator({}, "hello@x.example");
    expect(operator).toEqual({
      name: DEFAULT_OPERATOR_NAME,
      nameIsSet: false,
      address: null,
      country: null,
      euRepresentative: null,
      ukRepresentative: null,
      privacyEmail: "hello@x.example",
    });
    expect(DEFAULT_OPERATOR_NAME).toBe("the operator of Package Radar");
    expect(missingOperatorSettings(operator)).toEqual([
      "NEXT_PUBLIC_OPERATOR_NAME",
      "NEXT_PUBLIC_OPERATOR_ADDRESS",
      "NEXT_PUBLIC_OPERATOR_COUNTRY",
    ]);
  });

  it("reads every configured value", () => {
    const operator = parseOperator(
      {
        name: " Example Labs Ltd ",
        address: "1 Sample Street,\n London EC1A 1AA, United Kingdom",
        country: "gb",
        euRepresentative: "Rep Co GmbH, Berlin",
        ukRepresentative: "UK Rep Ltd, Leeds",
        privacyEmail: "privacy@x.example",
      },
      "hello@x.example",
    );
    expect(operator).toEqual({
      name: "Example Labs Ltd",
      nameIsSet: true,
      address: "1 Sample Street, London EC1A 1AA, United Kingdom",
      country: "United Kingdom",
      euRepresentative: "Rep Co GmbH, Berlin",
      ukRepresentative: "UK Rep Ltd, Leeds",
      privacyEmail: "privacy@x.example",
    });
    expect(missingOperatorSettings(operator)).toEqual([]);
  });

  it("ignores an invalid privacy email", () => {
    expect(parseOperator({ privacyEmail: "not an email" }, "hello@x.example").privacyEmail).toBe(
      "hello@x.example",
    );
  });
});

describe("AdSense configuration parsing", () => {
  it("accepts ca-pub- with 10 to 20 digits", () => {
    expect(parseAdsenseClient("ca-pub-1234567890123456")).toBe(
      "ca-pub-1234567890123456",
    );
    expect(parseAdsenseClient(" ca-pub-1234567890 ")).toBe("ca-pub-1234567890");
  });

  it("treats anything else as unset", () => {
    expect(parseAdsenseClient(undefined)).toBeNull();
    expect(parseAdsenseClient("")).toBeNull();
    expect(parseAdsenseClient("pub-1234567890123456")).toBeNull();
    expect(parseAdsenseClient("ca-pub-123")).toBeNull();
    expect(parseAdsenseClient("ca-pub-123456789012345678901")).toBeNull();
    expect(parseAdsenseClient("ca-pub-12345678901234x")).toBeNull();
  });

  it("derives the ads.txt publisher id", () => {
    expect(publisherIdFromClient("ca-pub-1234567890123456")).toBe(
      "pub-1234567890123456",
    );
    expect(publisherIdFromClient(null)).toBeNull();
  });

  it("only accepts numeric slot ids", () => {
    expect(parseAdSlot("1234567890")).toBe("1234567890");
    expect(parseAdSlot(" 1234567890 ")).toBe("1234567890");
    expect(parseAdSlot("")).toBeUndefined();
    expect(parseAdSlot(undefined)).toBeUndefined();
    expect(parseAdSlot("slot-1")).toBeUndefined();
  });

  it("builds the loader URL", () => {
    expect(adsenseScriptSrc("ca-pub-1234567890123456")).toBe(
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456",
    );
  });
});

describe("env-derived constants", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("enables ads only in production with a valid client id", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "ca-pub-1234567890123456");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_SLOT_GUIDE", "1111111111");
    vi.resetModules();
    const site = await import("./site");
    expect(site.ADSENSE_CLIENT).toBe("ca-pub-1234567890123456");
    expect(site.adsensePublisherId()).toBe("pub-1234567890123456");
    expect(site.adsEnabled).toBe(true);
    expect(site.AD_SLOTS.guide).toBe("1111111111");
    expect(site.AD_SLOTS.landing).toBeUndefined();
    expect(site.showAdPlaceholders).toBe(false);
  });

  it("keeps ads off outside production", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "ca-pub-1234567890123456");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SHOW_AD_PLACEHOLDERS", "1");
    vi.resetModules();
    const site = await import("./site");
    expect(site.adsEnabled).toBe(false);
    expect(site.showAdPlaceholders).toBe(true);
  });

  it("treats an invalid client id as unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "pub-oops");
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const site = await import("./site");
    expect(site.ADSENSE_CLIENT).toBeNull();
    expect(site.adsensePublisherId()).toBeNull();
    expect(site.adsEnabled).toBe(false);
  });

  it("reads the site URL and contact email", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://packageradar.example/");
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "support@packageradar.example");
    vi.resetModules();
    const site = await import("./site");
    expect(site.SITE_URL).toBe("https://packageradar.example");
    expect(site.CONTACT_EMAIL).toBe("support@packageradar.example");
  });

  it("reads the operator identity", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "support@packageradar.example");
    vi.stubEnv("NEXT_PUBLIC_OPERATOR_NAME", "Example Labs Ltd");
    vi.stubEnv("NEXT_PUBLIC_OPERATOR_ADDRESS", "1 Sample Street, London");
    vi.stubEnv("NEXT_PUBLIC_OPERATOR_COUNTRY", "DE");
    vi.stubEnv("NEXT_PUBLIC_EU_REPRESENTATIVE", "Rep Co GmbH");
    vi.stubEnv("NEXT_PUBLIC_UK_REPRESENTATIVE", "UK Rep Ltd");
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_EMAIL", "privacy@packageradar.example");
    vi.resetModules();
    const site = await import("./site");
    expect(site.OPERATOR).toEqual({
      name: "Example Labs Ltd",
      nameIsSet: true,
      address: "1 Sample Street, London",
      country: "Germany",
      euRepresentative: "Rep Co GmbH",
      ukRepresentative: "UK Rep Ltd",
      privacyEmail: "privacy@packageradar.example",
    });
    expect(site.PRIVACY_EMAIL).toBe("privacy@packageradar.example");
  });

  it("defaults the operator identity and privacy email", async () => {
    for (const name of [
      "NEXT_PUBLIC_OPERATOR_NAME",
      "NEXT_PUBLIC_OPERATOR_ADDRESS",
      "NEXT_PUBLIC_OPERATOR_COUNTRY",
      "NEXT_PUBLIC_EU_REPRESENTATIVE",
      "NEXT_PUBLIC_UK_REPRESENTATIVE",
      "NEXT_PUBLIC_PRIVACY_EMAIL",
    ]) {
      vi.stubEnv(name, "");
    }
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "support@packageradar.example");
    vi.resetModules();
    const site = await import("./site");
    expect(site.OPERATOR.name).toBe("the operator of Package Radar");
    expect(site.OPERATOR.nameIsSet).toBe(false);
    expect(site.OPERATOR.address).toBeNull();
    expect(site.OPERATOR.country).toBeNull();
    expect(site.OPERATOR.euRepresentative).toBeNull();
    expect(site.OPERATOR.ukRepresentative).toBeNull();
    expect(site.PRIVACY_EMAIL).toBe("support@packageradar.example");
  });

  it("shows operator placeholders in development only", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    expect((await import("./site")).showOperatorPlaceholders).toBe(true);

    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    expect((await import("./site")).showOperatorPlaceholders).toBe(false);

    vi.stubEnv("NODE_ENV", "test");
    vi.resetModules();
    expect((await import("./site")).showOperatorPlaceholders).toBe(false);
  });
});

describe("absoluteUrl", () => {
  it("joins paths onto the site URL", () => {
    expect(absoluteUrl("/", "https://x.example")).toBe("https://x.example/");
    expect(absoluteUrl("", "https://x.example")).toBe("https://x.example/");
    expect(absoluteUrl("/guides", "https://x.example/")).toBe(
      "https://x.example/guides",
    );
    expect(absoluteUrl("about", "https://x.example")).toBe(
      "https://x.example/about",
    );
  });
});

describe("pageMetadata", () => {
  it("sets canonical, Open Graph and Twitter fields", () => {
    const meta = pageMetadata({
      title: "Privacy policy",
      description: "What we collect.",
      path: "/privacy",
    });
    expect(meta.title).toBe("Privacy policy");
    expect(meta.description).toBe("What we collect.");
    expect(meta.alternates).toEqual({ canonical: "/privacy" });
    expect(meta.openGraph).toMatchObject({
      type: "website",
      url: "/privacy",
      siteName: SITE_NAME,
      title: "Privacy policy",
      description: "What we collect.",
    });
    expect(meta.twitter).toMatchObject({ card: "summary", title: "Privacy policy" });
  });

  it("marks articles with their dates", () => {
    const meta = pageMetadata({
      title: "Guide",
      description: "d",
      path: "/guides/x",
      article: { publishedTime: "2026-09-01", modifiedTime: "2026-10-01" },
    });
    expect(meta.openGraph).toMatchObject({
      type: "article",
      publishedTime: "2026-09-01",
      modifiedTime: "2026-10-01",
    });
  });
});

describe("buildSitemap", () => {
  const siteUrl = "https://packageradar.example";

  it("lists public pages and each guide with real dates only", () => {
    const entries = buildSitemap({
      siteUrl,
      guides: [
        { slug: "informed-delivery", updated: "2026-09-30" },
        { slug: "ups-my-choice", updated: "2026-10-04" },
      ],
      legalUpdated: "2026-10-08",
    });
    expect(entries.map((e) => e.url)).toEqual([
      "https://packageradar.example/",
      "https://packageradar.example/guides",
      "https://packageradar.example/guides/informed-delivery",
      "https://packageradar.example/guides/ups-my-choice",
      "https://packageradar.example/about",
      "https://packageradar.example/privacy",
      "https://packageradar.example/terms",
      "https://packageradar.example/contact",
    ]);
    const byUrl = new Map(entries.map((e) => [e.url, e.lastModified]));
    expect(byUrl.get("https://packageradar.example/")).toBeUndefined();
    expect(byUrl.get("https://packageradar.example/guides")).toBe("2026-10-04");
    expect(byUrl.get("https://packageradar.example/guides/informed-delivery")).toBe(
      "2026-09-30",
    );
    expect(byUrl.get("https://packageradar.example/privacy")).toBe("2026-10-08");
    expect(byUrl.get("https://packageradar.example/about")).toBeUndefined();
    expect(entries.every((e) => !("changeFrequency" in e) && !("priority" in e))).toBe(
      true,
    );
  });

  it("never lists private pages", () => {
    const urls = buildSitemap({ siteUrl, guides: [], legalUpdated: "2026-10-08" }).map(
      (e) => e.url,
    );
    for (const p of ["/dashboard", "/setup", "/signin", "/api"]) {
      expect(urls.some((u) => u.includes(p))).toBe(false);
    }
    expect(urls).toContain("https://packageradar.example/guides");
  });
});
