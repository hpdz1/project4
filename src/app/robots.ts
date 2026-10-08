import type { MetadataRoute } from "next";
import { SITE_URL, absoluteUrl } from "@/lib/site";

/** /robots.txt: everything public is crawlable; API and private pages are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/setup", "/signin"],
    },
    sitemap: absoluteUrl("/sitemap.xml", SITE_URL),
  };
}
