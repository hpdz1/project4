/**
 * Site-wide constants and public (NEXT_PUBLIC_*) configuration.
 *
 * Safe to import from Server and Client Components: everything here is either
 * a constant or derived from NEXT_PUBLIC_* variables, which Next.js inlines at
 * build time. Each env var is read with a literal `process.env.NAME` so the
 * inlining works.
 */
import type { Metadata, MetadataRoute } from "next";

export const SITE_NAME = "Package Radar";
export const SITE_TAGLINE = "See what's on the way to your home";
export const DEFAULT_TITLE = `${SITE_NAME} — see what's on the way to your home`;
export const SITE_DESCRIPTION =
  "One dashboard for the delivery alerts your carriers already send about your home. Turn on USPS Informed Delivery, UPS My Choice or FedEx Delivery Manager once, forward their emails, and see every package on the way in one place. No tracking numbers to type, no carrier passwords.";

/** Effective date of the privacy policy and terms (YYYY-MM-DD). */
export const LEGAL_EFFECTIVE_DATE = "2026-10-08";

const DEFAULT_SITE_URL = "http://localhost:3000";
const DEFAULT_CONTACT_EMAIL = "hello@example.com";
const ADSENSE_CLIENT_RE = /^ca-pub-\d{10,20}$/;
const AD_SLOT_RE = /^\d{4,20}$/;

/**
 * Normalize a configured site URL: http(s) only, no trailing slash.
 * Anything unparseable falls back to http://localhost:3000.
 */
export function normalizeSiteUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return DEFAULT_SITE_URL;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return DEFAULT_SITE_URL;
    }
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
  } catch {
    return DEFAULT_SITE_URL;
  }
}

/** A plausible email address, or the default contact address. */
export function normalizeContactEmail(raw: string | undefined): string {
  const value = raw?.trim();
  return value && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)
    ? value
    : DEFAULT_CONTACT_EMAIL;
}

/** `ca-pub-` followed by 10–20 digits, else null (treated as "AdSense not configured"). */
export function parseAdsenseClient(raw: string | undefined): string | null {
  const value = raw?.trim();
  return value && ADSENSE_CLIENT_RE.test(value) ? value : null;
}

/** "ca-pub-123" -> "pub-123" (the form ads.txt uses). */
export function publisherIdFromClient(client: string | null): string | null {
  return client ? client.replace(/^ca-/, "") : null;
}

/** AdSense ad-unit ids are numeric; anything else is treated as unset. */
export function parseAdSlot(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  return value && AD_SLOT_RE.test(value) ? value : undefined;
}

/** Canonical origin of the site, e.g. "https://packageradar.app" (no trailing slash). */
export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export const CONTACT_EMAIL = normalizeContactEmail(
  process.env.NEXT_PUBLIC_CONTACT_EMAIL,
);

/** AdSense client id ("ca-pub-…") or null when AdSense is not configured. */
export const ADSENSE_CLIENT = parseAdsenseClient(
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT,
);

/** Publisher id for ads.txt ("pub-…"), or null when AdSense is not configured. */
export function adsensePublisherId(): string | null {
  return publisherIdFromClient(ADSENSE_CLIENT);
}

export type AdPlacement = "landing" | "guide" | "dashboard";

/** Manual ad-unit ids per placement (undefined = no ad there). */
export const AD_SLOTS: Readonly<Record<AdPlacement, string | undefined>> = {
  landing: parseAdSlot(process.env.NEXT_PUBLIC_ADSENSE_SLOT_LANDING),
  guide: parseAdSlot(process.env.NEXT_PUBLIC_ADSENSE_SLOT_GUIDE),
  dashboard: parseAdSlot(process.env.NEXT_PUBLIC_ADSENSE_SLOT_DASHBOARD),
};

/**
 * Real ads load only in production builds with a valid client id, so local
 * development, tests and preview builds without the env var never request ads.
 */
export const adsEnabled =
  Boolean(ADSENSE_CLIENT) && process.env.NODE_ENV === "production";

/** Dashed "Ad placeholder" boxes for checking layouts (development only). */
export const showAdPlaceholders =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_SHOW_AD_PLACEHOLDERS === "1";

/** The AdSense loader URL for a client id. */
export function adsenseScriptSrc(client: string): string {
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
}

/** Absolute URL for a site path ("/guides" -> "https://…/guides"). */
export function absoluteUrl(path: string, siteUrl: string = SITE_URL): string {
  const base = siteUrl.replace(/\/+$/, "");
  if (path === "" || path === "/") return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export interface PageMetadataInput {
  /** Page title; the root layout's template appends " · Package Radar". */
  title: string;
  description: string;
  /** Site path used for the canonical URL and og:url, e.g. "/privacy". */
  path: string;
  /** Article pages get og:type=article with dates (YYYY-MM-DD). */
  article?: { publishedTime: string; modifiedTime: string };
}

/**
 * Per-page metadata with a canonical URL and a complete Open Graph block.
 * Next.js merges `openGraph` shallowly, so every page that sets one must set
 * all of it; this helper keeps them consistent.
 */
export function pageMetadata(input: PageMetadataInput): Metadata {
  const { title, description, path, article } = input;
  const shared = {
    title,
    description,
    url: path,
    siteName: SITE_NAME,
    locale: "en_US",
  };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: article
      ? {
          ...shared,
          type: "article",
          publishedTime: article.publishedTime,
          modifiedTime: article.modifiedTime,
        }
      : { ...shared, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

/**
 * Build sitemap entries. `lastModified` is only set where we know a real date
 * (guides' `updated`, the legal pages' effective date); Google ignores
 * lastmod values that are not verifiably accurate.
 */
export function buildSitemap(input: {
  siteUrl: string;
  guides: ReadonlyArray<{ slug: string; updated: string }>;
  legalUpdated: string;
}): MetadataRoute.Sitemap {
  const { siteUrl, guides, legalUpdated } = input;
  const newestGuide = guides.reduce<string | undefined>(
    (max, g) => (max === undefined || g.updated > max ? g.updated : max),
    undefined,
  );
  const entry = (path: string, lastModified?: string) =>
    lastModified
      ? { url: absoluteUrl(path, siteUrl), lastModified }
      : { url: absoluteUrl(path, siteUrl) };

  return [
    entry("/"),
    entry("/guides", newestGuide),
    ...guides.map((g) => entry(`/guides/${g.slug}`, g.updated)),
    entry("/about"),
    entry("/privacy", legalUpdated),
    entry("/terms", legalUpdated),
    entry("/contact"),
  ];
}
