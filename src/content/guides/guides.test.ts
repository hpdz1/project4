import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GUIDES, getGuide, type GuideMeta } from "./index";

const GUIDES_DIR = dirname(fileURLToPath(import.meta.url));

const EXPECTED: ReadonlyArray<Pick<GuideMeta, "slug" | "category">> = [
  { slug: "how-to-see-every-package-coming-to-your-address", category: "Getting started" },
  { slug: "track-a-package-without-a-tracking-number", category: "Getting started" },
  { slug: "usps-informed-delivery", category: "Carriers" },
  { slug: "ups-my-choice", category: "Carriers" },
  { slug: "fedex-delivery-manager", category: "Carriers" },
  { slug: "fake-delivery-text-scams", category: "Safety" },
  { slug: "package-you-didnt-order", category: "Safety" },
  { slug: "package-says-delivered-but-not-here", category: "Troubleshooting" },
  { slug: "parcel-notifications-europe", category: "Around the world" },
  { slug: "parcel-notifications-asia-pacific", category: "Around the world" },
  { slug: "parcel-notifications-americas-middle-east-africa", category: "Around the world" },
];

/** Long, country-by-country guides for readers outside the US. */
const REGIONAL_SLUGS = EXPECTED.filter((g) => g.category === "Around the world").map((g) => g.slug);

/** Guides that point non-US readers to every regional guide. */
const LINKS_TO_REGIONAL = [
  "how-to-see-every-package-coming-to-your-address",
  "track-a-package-without-a-tracking-number",
];

/** Claims we must never make (no one can look up packages for an arbitrary address). */
const BANNED_PHRASES: readonly RegExp[] = [
  /track any (?:package|parcel)/i,
  /any (?:package|parcel) by address/i,
  /(?:package|parcel)s? (?:for|to) any address/i,
  /look up any address/i,
  /enter any address/i,
  // We never store item descriptions (they can reveal sensitive purchases).
  /\b(?:stores?|keeps?|saves?) (?:the |your )?(?:item|product) (?:names?|descriptions?)\b/i,
];

/** External links may only point at official carrier, retailer or government sites. */
const OFFICIAL_DOMAINS = [
  "usps.com",
  "uspis.gov",
  "ups.com",
  "fedex.com",
  "ftc.gov",
  "dhl.com",
  "dhl.de",
  "amazon.com",
  "ontrac.com",
  "walmart.com",
  "target.com",
  "canadapost-postescanada.ca",
  // Europe
  "anpost.com",
  "bpost.be",
  "ceskaposta.cz",
  "correos.es",
  "dhlparcel.nl",
  "dpd.co.uk",
  "dpd.com",
  "evri.com",
  "laposte.fr",
  "post.at",
  "post.ch",
  "poste.it",
  "posten.no",
  "posti.fi",
  "postnl.nl",
  "postnord.se",
  // Asia-Pacific
  "aramex.com.au",
  "auspost.com.au",
  "japanpost.jp",
  "nzpost.co.nz",
  "sendle.com",
  "singpost.com",
  // Americas, Middle East and Africa
  "correios.com.br",
  "emiratespost.ae",
  "israelpost.co.il",
  "splonline.com.sa",
];

const STATIC_ROUTES = new Set(["/", "/setup", "/dashboard", "/guides", "/about", "/privacy", "/terms", "/contact"]);

const WORDS_PER_MINUTE = 230;

interface RenderedGuide {
  meta: GuideMeta;
  html: string;
  text: string;
  words: number;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function countWords(text: string): number {
  return text.split(" ").filter((token) => /[A-Za-z0-9]/.test(token)).length;
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? decodeEntities(m[1]) : null;
}

function anchorTags(html: string): string[] {
  return html.match(/<a\s[^>]*>/g) ?? [];
}

function isValidIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return date.toISOString().slice(0, 10) === value;
}

const rendered: RenderedGuide[] = GUIDES.map(({ meta, Content }) => {
  const html = renderToStaticMarkup(createElement(Content));
  const text = htmlToText(html);
  return { meta, html, text, words: countWords(text) };
});

describe("guide registry", () => {
  it("lists the eleven guides in index order with their categories", () => {
    expect(GUIDES.map((g) => ({ slug: g.meta.slug, category: g.meta.category }))).toEqual(EXPECTED);
  });

  it("has unique slugs", () => {
    const slugs = GUIDES.map((g) => g.meta.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has exactly one article file per guide, named after its slug", async () => {
    const files = readdirSync(GUIDES_DIR)
      .filter((f) => f.endsWith(".tsx") && !f.includes(".test."))
      .map((f) => f.replace(/\.tsx$/, ""))
      .sort();
    expect(files).toEqual(GUIDES.map((g) => g.meta.slug).sort());

    for (const file of files) {
      const mod: unknown = await import(join(GUIDES_DIR, `${file}.tsx`));
      const { meta, default: Content } = mod as { meta: GuideMeta; default: unknown };
      expect(meta.slug).toBe(file);
      expect(getGuide(file)?.meta).toBe(meta);
      expect(getGuide(file)?.Content).toBe(Content);
    }
  });

  it("getGuide finds every guide and nothing else", () => {
    for (const guide of GUIDES) {
      expect(getGuide(guide.meta.slug)).toBe(guide);
    }
    expect(getGuide("not-a-guide")).toBeUndefined();
    expect(getGuide("")).toBeUndefined();
    expect(getGuide("USPS-INFORMED-DELIVERY")).toBeUndefined();
  });
});

describe.each(rendered)("$meta.slug", ({ meta, html, text, words }) => {
  it("has valid metadata", () => {
    expect(meta.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(meta.title.trim().length).toBeGreaterThan(10);
    expect(meta.title.length).toBeLessThanOrEqual(80);
    expect(meta.description.trim().length).toBeGreaterThan(50);
    expect(meta.description.length).toBeLessThanOrEqual(160);
    expect(isValidIsoDate(meta.published)).toBe(true);
    expect(isValidIsoDate(meta.updated)).toBe(true);
    expect(meta.updated >= meta.published).toBe(true);
    expect(Number.isInteger(meta.readingMinutes)).toBe(true);
  });

  it("is a substantial article with an honest reading time", () => {
    // Regional guides cover many countries, so they run longer.
    const [min, max] = REGIONAL_SLUGS.includes(meta.slug) ? [1500, 2500] : [900, 1600];
    expect(words).toBeGreaterThanOrEqual(min);
    expect(words).toBeLessThanOrEqual(max);
    expect(Math.abs(meta.readingMinutes - words / WORDS_PER_MINUTE)).toBeLessThanOrEqual(1.5);
  });

  it("uses headings correctly", () => {
    expect(html).not.toMatch(/<h1[\s>]/);
    const h2s = html.match(/<h2[\s>][\s\S]*?<\/h2>/g) ?? [];
    expect(h2s.length).toBeGreaterThanOrEqual(3);
    for (const heading of html.match(/<h[23][\s>][\s\S]*?<\/h[23]>/g) ?? []) {
      expect(htmlToText(heading).length).toBeGreaterThan(0);
    }
  });

  it("only uses https for external links, opened safely in a new tab, to official sites", () => {
    const external = anchorTags(html).filter((tag) => /^[a-z]+:/i.test(attr(tag, "href") ?? ""));
    expect(external.length).toBeGreaterThan(0);
    for (const tag of external) {
      const href = attr(tag, "href") ?? "";
      expect(href, tag).toMatch(/^https:\/\//);
      expect(attr(tag, "rel"), tag).toBe("noopener noreferrer");
      expect(attr(tag, "target"), tag).toBe("_blank");
      const host = new URL(href).hostname;
      expect(
        OFFICIAL_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`)),
        host,
      ).toBe(true);
    }
  });

  it("only links internally to routes that exist", () => {
    const internal = anchorTags(html)
      .map((tag) => attr(tag, "href") ?? "")
      .filter((href) => !/^[a-z]+:/i.test(href));
    expect(internal.some((href) => href.startsWith("/guides/"))).toBe(true);
    for (const href of internal) {
      const guideSlug = /^\/guides\/([^/?#]+)$/.exec(href)?.[1];
      if (guideSlug) {
        expect(getGuide(guideSlug), href).toBeDefined();
        expect(guideSlug, "links to itself").not.toBe(meta.slug);
      } else {
        expect(STATIC_ROUTES.has(href), href).toBe(true);
      }
    }
  });

  it("never claims packages can be looked up by address", () => {
    for (const phrase of BANNED_PHRASES) {
      expect(text).not.toMatch(phrase);
    }
  });

  it("keeps codes, addresses and tracking-number prefixes out of browser translation", () => {
    for (const tag of html.match(/<code(?:\s[^>]*)?>/g) ?? []) {
      expect(tag, "code element without translate=no").toMatch(/translate="no"/);
    }
  });

  it("has no rendering slips", () => {
    expect(text).not.toMatch(/\bundefined\b|\[object Object\]|\bNaN\b/);
    // A missing {" "} in JSX glues a word onto a link or emphasis.
    expect(html).not.toMatch(/[A-Za-z0-9]<(?:a|strong|em|code)[\s>]/);
    expect(html).not.toMatch(/<\/(?:a|strong|em|code)>[A-Za-z0-9]/);
    // Straight quotes in prose usually mean a missed curly quote or entity.
    expect(text).not.toMatch(/'/);
  });
});

describe.each(rendered.filter((g) => REGIONAL_SLUGS.includes(g.meta.slug)))(
  "regional guide $meta.slug",
  ({ meta, html, text }) => {
    it("is listed under Around the world", () => {
      expect(meta.category).toBe("Around the world");
    });

    it("is organised into enough sections to scan by country", () => {
      expect((html.match(/<h2[\s>]/g) ?? []).length).toBeGreaterThanOrEqual(7);
    });

    it("has a comparison table with column headers", () => {
      expect(html).toMatch(/<table>/);
      expect((html.match(/<th scope="col">/g) ?? []).length).toBeGreaterThanOrEqual(3);
    });

    it("cites several official pages over https", () => {
      const external = anchorTags(html)
        .map((tag) => attr(tag, "href") ?? "")
        .filter((href) => /^[a-z]+:/i.test(href));
      expect(external.length).toBeGreaterThanOrEqual(5);
      for (const href of external) expect(href).toMatch(/^https:\/\//);
    });

    it("links to setup and the other regional guides", () => {
      const hrefs = anchorTags(html).map((tag) => attr(tag, "href"));
      expect(hrefs).toContain("/setup");
      expect(hrefs).toContain("/guides/how-to-see-every-package-coming-to-your-address");
    });

    it("is honest about what email forwarding can and can’t see", () => {
      expect(text).toMatch(/can’t be forwarded|Not reachable/);
      expect(text).toMatch(/We don’t store what you ordered/);
    });

    it("marks the brand name as not to be translated", () => {
      expect(html).toMatch(/<span translate="no">Package Radar<\/span>/);
      expect(text).not.toMatch(/track (?:any|every) (?:package|parcel) by address/i);
    });
  },
);

describe.each(LINKS_TO_REGIONAL)("%s", (slug) => {
  it("points readers outside the US to every regional guide", () => {
    const guide = rendered.find((g) => g.meta.slug === slug);
    expect(guide).toBeDefined();
    const hrefs = anchorTags(guide?.html ?? "").map((tag) => attr(tag, "href"));
    for (const regional of REGIONAL_SLUGS) {
      expect(hrefs).toContain(`/guides/${regional}`);
    }
    expect(guide?.html).toMatch(/<h2>Outside the US\?<\/h2>/);
  });
});
