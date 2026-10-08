/**
 * State / province tables for the countries whose addresses we parse.
 *
 * US data: USPS Publication 28 Appendix B (50 states, DC, territories, Freely
 * Associated States and the AA/AE/AP military "states"), via research/address.md.
 */

/** A region code plus every full name (uppercase, accents stripped) we accept for it. */
export interface RegionEntry {
  code: string;
  /** Display name. */
  name: string;
  /** Extra uppercase spellings that map to this code. */
  aliases?: string[];
}

export const US_REGIONS: readonly RegionEntry[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia", aliases: ["WASHINGTON DC", "WASHINGTON D C"] },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  // Territories and Freely Associated States served by USPS.
  { code: "AS", name: "American Samoa" },
  { code: "FM", name: "Federated States of Micronesia", aliases: ["MICRONESIA"] },
  { code: "GU", name: "Guam" },
  { code: "MH", name: "Marshall Islands" },
  { code: "MP", name: "Northern Mariana Islands" },
  { code: "PW", name: "Palau" },
  { code: "PR", name: "Puerto Rico" },
  { code: "VI", name: "U.S. Virgin Islands", aliases: ["VIRGIN ISLANDS", "US VIRGIN ISLANDS", "U S VIRGIN ISLANDS"] },
  // Military ("APO/FPO/DPO" city).
  { code: "AA", name: "Armed Forces Americas" },
  {
    code: "AE",
    name: "Armed Forces Europe",
    aliases: ["ARMED FORCES AFRICA", "ARMED FORCES CANADA", "ARMED FORCES MIDDLE EAST"],
  },
  { code: "AP", name: "Armed Forces Pacific" },
];

/** US territories and Freely Associated States (not one of the 50 states or DC). */
export const US_TERRITORY_CODES: ReadonlySet<string> = new Set(["AS", "FM", "GU", "MH", "MP", "PW", "PR", "VI"]);

/** USPS military "state" codes used with APO/FPO/DPO addresses. */
export const US_MILITARY_CODES: ReadonlySet<string> = new Set(["AA", "AE", "AP"]);

export const CA_REGIONS: readonly RegionEntry[] = [
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "British Columbia" },
  { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" },
  { code: "NL", name: "Newfoundland and Labrador", aliases: ["NEWFOUNDLAND", "NEWFOUNDLAND LABRADOR"] },
  { code: "NS", name: "Nova Scotia" },
  { code: "NT", name: "Northwest Territories" },
  { code: "NU", name: "Nunavut" },
  { code: "ON", name: "Ontario" },
  { code: "PE", name: "Prince Edward Island", aliases: ["PEI"] },
  { code: "QC", name: "Quebec", aliases: ["PQ"] },
  { code: "SK", name: "Saskatchewan" },
  { code: "YT", name: "Yukon", aliases: ["YUKON TERRITORY"] },
];

export const AU_REGIONS: readonly RegionEntry[] = [
  { code: "NSW", name: "New South Wales" },
  { code: "VIC", name: "Victoria" },
  { code: "QLD", name: "Queensland" },
  { code: "WA", name: "Western Australia" },
  { code: "SA", name: "South Australia" },
  { code: "TAS", name: "Tasmania" },
  { code: "ACT", name: "Australian Capital Territory" },
  { code: "NT", name: "Northern Territory" },
];

/** Lookup tables built from a region list: code -> code, and uppercase full name -> code. */
export interface RegionLookup {
  codes: ReadonlyMap<string, string>;
  names: ReadonlyMap<string, string>;
  /** Longest full name, in words (bounds the multi-word search). */
  maxNameWords: number;
}

/** Uppercase, strip accents and punctuation, collapse spaces. */
export function regionKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[.'’]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Build code and name lookups for a region list. */
export function buildRegionLookup(entries: readonly RegionEntry[]): RegionLookup {
  const codes = new Map<string, string>();
  const names = new Map<string, string>();
  let maxNameWords = 1;
  for (const entry of entries) {
    codes.set(entry.code, entry.code);
    for (const name of [entry.name, ...(entry.aliases ?? [])]) {
      const key = regionKey(name);
      if (key.length <= 3 && !key.includes(" ")) {
        // Short aliases such as "PQ" or "PEI" behave like codes.
        codes.set(key, entry.code);
      } else {
        names.set(key, entry.code);
        maxNameWords = Math.max(maxNameWords, key.split(" ").length);
      }
    }
  }
  return { codes, names, maxNameWords };
}

export const US_LOOKUP = buildRegionLookup(US_REGIONS);
export const CA_LOOKUP = buildRegionLookup(CA_REGIONS);
export const AU_LOOKUP = buildRegionLookup(AU_REGIONS);

/** Display name for a US state / territory code, e.g. "IL" -> "Illinois". */
export function usRegionName(code: string): string | null {
  const upper = code.trim().toUpperCase();
  return US_REGIONS.find((entry) => entry.code === upper)?.name ?? null;
}

/**
 * Canadian province from the first letter(s) of a postal code ("K1A 0B1" -> "ON").
 * X covers both Nunavut (X0A, X0B, X0C) and the Northwest Territories.
 */
export function canadaProvinceFromPostcode(postcode: string): string | null {
  const pc = postcode.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]\d[A-Z]/.test(pc)) return null;
  const first = pc[0];
  if (first === "X") return /^X0[ABC]/.test(pc) ? "NU" : "NT";
  const map: Record<string, string> = {
    A: "NL",
    B: "NS",
    C: "PE",
    E: "NB",
    G: "QC",
    H: "QC",
    J: "QC",
    K: "ON",
    L: "ON",
    M: "ON",
    N: "ON",
    P: "ON",
    R: "MB",
    S: "SK",
    T: "AB",
    V: "BC",
    Y: "YT",
  };
  return map[first] ?? null;
}

/** Australian state / territory from a 4-digit postcode ("2000" -> "NSW"). */
export function australiaStateFromPostcode(postcode: string): string | null {
  if (!/^\d{4}$/.test(postcode)) return null;
  const n = Number(postcode);
  if (n >= 200 && n <= 299) return "ACT";
  if (n >= 800 && n <= 999) return "NT";
  if (n >= 2600 && n <= 2618) return "ACT";
  if (n >= 2900 && n <= 2920) return "ACT";
  if (n >= 1000 && n <= 2999) return "NSW";
  if ((n >= 3000 && n <= 3999) || (n >= 8000 && n <= 8999)) return "VIC";
  if ((n >= 4000 && n <= 4999) || (n >= 9000 && n <= 9999)) return "QLD";
  if (n >= 5000 && n <= 5999) return "SA";
  if (n >= 6000 && n <= 6999) return "WA";
  if (n >= 7000 && n <= 7999) return "TAS";
  return null;
}
