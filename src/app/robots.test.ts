import { describe, expect, it } from "vitest";
import robots from "./robots";
import { SITE_URL } from "@/lib/site";

describe("robots.txt", () => {
  it("allows the site, blocks API and private pages, and points to the sitemap", () => {
    const result = robots();
    expect(result.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/setup", "/signin"],
    });
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});
