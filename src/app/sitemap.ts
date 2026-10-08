import type { MetadataRoute } from "next";
import { GUIDES } from "@/content/guides";
import { LEGAL_EFFECTIVE_DATE, SITE_URL, buildSitemap } from "@/lib/site";

/** /sitemap.xml: public pages and every guide (private pages are left out). */
export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap({
    siteUrl: SITE_URL,
    guides: GUIDES.map((guide) => guide.meta),
    legalUpdated: LEGAL_EFFECTIVE_DATE,
  });
}
