/**
 * Pure helpers for the guide pages (grouping, related guides, dates,
 * structured data). Kept free of React so they can be unit-tested.
 */
import type { GuideMeta } from "@/content/guides";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

export type GuideCategory = GuideMeta["category"];

/** Display order of the guide categories on /guides. */
export const GUIDE_CATEGORY_ORDER: readonly GuideCategory[] = [
  "Getting started",
  "Carriers",
  "Safety",
  "Troubleshooting",
];

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * "2026-10-08" -> "October 8, 2026". The date is a calendar date, so it is
 * formatted in UTC to avoid shifting a day in western time zones. Unparseable
 * input is returned unchanged.
 */
export function formatIsoDate(iso: string): string {
  const m = ISO_DATE_RE.exec(iso);
  if (!m) return iso;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Group guides by category in GUIDE_CATEGORY_ORDER, keeping each category's
 * guides in their original order. Unknown categories go last; empty
 * categories are dropped.
 */
export function groupGuidesByCategory<T extends { category: string }>(
  metas: readonly T[],
): Array<{ category: string; guides: T[] }> {
  const order: string[] = [...GUIDE_CATEGORY_ORDER];
  for (const meta of metas) {
    if (!order.includes(meta.category)) order.push(meta.category);
  }
  return order
    .map((category) => ({
      category,
      guides: metas.filter((m) => m.category === category),
    }))
    .filter((group) => group.guides.length > 0);
}

/**
 * Up to `limit` other guides: same category first, then the rest, each in
 * original order.
 */
export function relatedGuides<T extends { slug: string; category: string }>(
  current: Pick<T, "slug" | "category">,
  metas: readonly T[],
  limit = 3,
): T[] {
  const others = metas.filter((m) => m.slug !== current.slug);
  const same = others.filter((m) => m.category === current.category);
  const rest = others.filter((m) => m.category !== current.category);
  return [...same, ...rest].slice(0, Math.max(0, limit));
}

/**
 * schema.org Article + BreadcrumbList for a guide. The author is the site
 * itself (an Organization) — we don't invent personal bylines.
 */
export function guideJsonLd(meta: GuideMeta, siteUrl: string) {
  const url = absoluteUrl(`/guides/${meta.slug}`, siteUrl);
  const organization = {
    "@type": "Organization",
    name: SITE_NAME,
    url: absoluteUrl("/", siteUrl),
  };
  const article = {
    "@type": "Article",
    headline: meta.title,
    description: meta.description,
    datePublished: meta.published,
    dateModified: meta.updated,
    mainEntityOfPage: url,
    url,
    inLanguage: "en",
    author: organization,
    publisher: organization,
  };
  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/", siteUrl) },
      { "@type": "ListItem", position: 2, name: "Guides", item: absoluteUrl("/guides", siteUrl) },
      { "@type": "ListItem", position: 3, name: meta.title, item: url },
    ],
  };
  return {
    "@context": "https://schema.org",
    "@graph": [article, breadcrumb] as const,
  };
}
