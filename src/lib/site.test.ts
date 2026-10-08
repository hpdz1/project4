import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SITE_NAME,
  absoluteUrl,
  adsenseScriptSrc,
  buildSitemap,
  normalizeContactEmail,
  normalizeSiteUrl,
  pageMetadata,
  parseAdSlot,
  parseAdsenseClient,
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
