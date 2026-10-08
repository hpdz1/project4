import { describe, expect, it } from "vitest";
import type { GuideMeta } from "@/content/guides";
import { serializeJsonLd } from "./json-ld";
import {
  formatIsoDate,
  groupGuidesByCategory,
  guideJsonLd,
  relatedGuides,
} from "./guides";
import { isCurrentPath } from "./nav";

function meta(slug: string, category: GuideMeta["category"]): GuideMeta {
  return {
    slug,
    title: `Title ${slug}`,
    description: `About ${slug}`,
    published: "2026-09-01",
    updated: "2026-10-01",
    readingMinutes: 5,
    category,
  };
}

describe("formatIsoDate", () => {
  it("formats a calendar date without shifting the day", () => {
    expect(formatIsoDate("2026-10-08")).toBe("October 8, 2026");
    expect(formatIsoDate("2026-01-01")).toBe("January 1, 2026");
  });

  it("returns unparseable input unchanged", () => {
    expect(formatIsoDate("soon")).toBe("soon");
    expect(formatIsoDate("2026-10-08T10:00:00Z")).toBe("2026-10-08T10:00:00Z");
  });
});

describe("groupGuidesByCategory", () => {
  it("orders categories and keeps guide order within each", () => {
    const groups = groupGuidesByCategory([
      meta("fake-texts", "Safety"),
      meta("informed-delivery", "Carriers"),
      meta("how-it-works", "Getting started"),
      meta("ups", "Carriers"),
    ]);
    expect(groups.map((g) => g.category)).toEqual([
      "Getting started",
      "Carriers",
      "Safety",
    ]);
    expect(groups[1].guides.map((g) => g.slug)).toEqual(["informed-delivery", "ups"]);
  });

  it("puts unknown categories last", () => {
    const groups = groupGuidesByCategory([
      { slug: "x", category: "Moving" },
      { slug: "y", category: "Troubleshooting" },
    ]);
    expect(groups.map((g) => g.category)).toEqual(["Troubleshooting", "Moving"]);
  });

  it("returns nothing for no guides", () => {
    expect(groupGuidesByCategory([])).toEqual([]);
  });
});

describe("relatedGuides", () => {
  const all = [
    meta("a", "Carriers"),
    meta("b", "Safety"),
    meta("c", "Carriers"),
    meta("d", "Getting started"),
    meta("e", "Carriers"),
  ];

  it("prefers the same category and excludes the current guide", () => {
    expect(relatedGuides(all[0], all).map((g) => g.slug)).toEqual(["c", "e", "b"]);
  });

  it("respects the limit", () => {
    expect(relatedGuides(all[1], all, 2).map((g) => g.slug)).toEqual(["a", "c"]);
    expect(relatedGuides(all[1], all, 0)).toEqual([]);
  });
});

describe("guideJsonLd", () => {
  it("describes the article and its breadcrumb", () => {
    const data = guideJsonLd(meta("informed-delivery", "Carriers"), "https://x.example");
    const [article, breadcrumb] = data["@graph"];
    expect(data["@context"]).toBe("https://schema.org");
    expect(article).toMatchObject({
      "@type": "Article",
      headline: "Title informed-delivery",
      datePublished: "2026-09-01",
      dateModified: "2026-10-01",
      url: "https://x.example/guides/informed-delivery",
      author: { "@type": "Organization", name: "Package Radar" },
    });
    expect(breadcrumb.itemListElement.map((i) => i.item)).toEqual([
      "https://x.example/",
      "https://x.example/guides",
      "https://x.example/guides/informed-delivery",
    ]);
  });
});

describe("serializeJsonLd", () => {
  it("escapes < so a value can't close the script tag", () => {
    const out = serializeJsonLd({ headline: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out)).toEqual({ headline: "</script><script>alert(1)</script>" });
  });
});

describe("isCurrentPath", () => {
  it("matches a section and its children", () => {
    expect(isCurrentPath("/guides", "/guides")).toBe(true);
    expect(isCurrentPath("/guides/informed-delivery", "/guides")).toBe(true);
    expect(isCurrentPath("/guidesx", "/guides")).toBe(false);
  });

  it("only matches home exactly and never matches hash links", () => {
    expect(isCurrentPath("/", "/")).toBe(true);
    expect(isCurrentPath("/about", "/")).toBe(false);
    expect(isCurrentPath("/", "/#how-it-works")).toBe(false);
    expect(isCurrentPath(null, "/guides")).toBe(false);
  });
});
