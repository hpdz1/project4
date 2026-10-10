import { SITE_NAME } from "@/lib/site";

/**
 * The site name in running text, marked translate="no" so browser
 * translation keeps "Package Radar" as is.
 */
export function Brand() {
  return <span translate="no">{SITE_NAME}</span>;
}
