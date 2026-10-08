/** Country code used for "somewhere we don't have carrier program data for". */
export const OTHER_COUNTRY_CODE = "ZZ";

/** Countries we have carrier program data for, plus "Other". ISO 3166-1 alpha-2 codes. */
export const COUNTRIES: { code: string; name: string }[] = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "NL", name: "Netherlands" },
  { code: OTHER_COUNTRY_CODE, name: "Other" },
];

/** Codes from COUNTRIES that have program data (everything except "Other"). */
export const SUPPORTED_COUNTRY_CODES: ReadonlySet<string> = new Set(
  COUNTRIES.map((c) => c.code).filter((code) => code !== OTHER_COUNTRY_CODE),
);

/**
 * Uppercase ISO 3166-1 alpha-2 code, or null when `input` isn't two letters.
 * Maps the common non-ISO "UK" to "GB".
 */
export function normalizeCountryCode(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const code = input.trim().toUpperCase();
  if (code === "UK") return "GB";
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/** Display name for a country code we list, else null. */
export function countryName(code: string): string | null {
  const normalized = normalizeCountryCode(code);
  return COUNTRIES.find((c) => c.code === normalized)?.name ?? null;
}
