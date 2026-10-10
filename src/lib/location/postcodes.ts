/**
 * Postcode formats for countries without a dedicated parser in parse.ts.
 *
 * Patterns run on one address token, or two tokens joined by a space ("113 51"),
 * after tokenKey(): uppercase, accents and periods removed, outer punctuation
 * trimmed (so "D-10117" and "00-950" arrive intact). Each pattern accepts the
 * common ways people type the code (with or without the separator, with the
 * European "CH-" / "D-" style prefix) and `format` returns the national
 * written form.
 *
 * These are general format rules (Universal Postal Union / national post
 * conventions), deliberately loose: they decide what to keep, not whether a
 * code exists.
 */
import { OTHER_COUNTRY_CODE, USPS_SERVED_COUNTRY_CODES, normalizeCountryCode } from "./countries";

export interface PostcodeSpec {
  /** Anchored pattern over one token or two space-joined tokens. */
  pattern: RegExp;
  /** National written form, e.g. "113 51", "00-950", "100-0001". */
  format: (m: RegExpExecArray) => string;
  example: string;
}

/** n digits, optionally behind a country prefix such as "CH-" or "D-". */
function digits(n: number, example: string, prefixes = ""): PostcodeSpec {
  const prefix = prefixes ? `(?:(?:${prefixes})-?)?` : "";
  return { pattern: new RegExp(`^${prefix}(\\d{${n}})$`), format: (m) => m[1], example };
}

/** Two digit groups written with `sep` ("12-345", "123 45"); typed with a dash, a space or nothing. */
function split(a: number, b: number, sep: string, example: string, prefixes = ""): PostcodeSpec {
  const prefix = prefixes ? `(?:(?:${prefixes})-?)?` : "";
  return {
    pattern: new RegExp(`^${prefix}(\\d{${a}})[- ]?(\\d{${b}})$`),
    format: (m) => `${m[1]}${sep}${m[2]}`,
    example,
  };
}

/** n digits always written behind a fixed prefix ("LV-1050", "AD500"); the prefix is optional when typed. */
function prefixed(prefix: string, n: number, written: string, example: string): PostcodeSpec {
  return {
    pattern: new RegExp(`^(?:${prefix}[- ]?)?(\\d{${n}})$`),
    format: (m) => `${written}${m[1]}`,
    example,
  };
}

/** British overseas territories with one fixed postcode each ("FIQQ 1ZZ"). */
function fixed(code: string): PostcodeSpec {
  return { pattern: new RegExp(`^(${code}) ?1ZZ$`), format: (m) => `${m[1]} 1ZZ`, example: `${code} 1ZZ` };
}

/** Irish Eircode: routing key (A65, D6W) + 4-character unique identifier. */
const EIRCODE_RE = /^([AC-FHKNPRTV-Y]\d{2}|D6W) ?([0-9AC-FHKNPRTV-Y]{4})$/;

const SPECS: Readonly<Record<string, PostcodeSpec>> = {
  AD: prefixed("AD", 3, "AD", "AD500"),
  AI: { pattern: /^(?:AI[- ]?)?(2640)$/, format: (m) => `AI-${m[1]}`, example: "AI-2640" },
  AL: digits(4, "1001"),
  AM: digits(4, "0010"),
  AR: { pattern: /^([A-Z]\d{4}[A-Z]{3}|\d{4})$/, format: (m) => m[1], example: "C1425DBA" },
  AT: digits(4, "1010", "A|AT"),
  AX: digits(5, "22100", "AX"),
  AZ: prefixed("AZ", 4, "AZ ", "AZ 1000"),
  BA: digits(5, "71000"),
  BD: digits(4, "1000"),
  BE: digits(4, "1000", "B|BE"),
  BG: digits(4, "1000", "BG"),
  BH: { pattern: /^(\d{3,4})$/, format: (m) => m[1], example: "317" },
  BL: digits(5, "97133"),
  BN: { pattern: /^([A-Z]{2}) ?(\d{4})$/, format: (m) => `${m[1]}${m[2]}`, example: "BS8811" },
  BR: split(5, 3, "-", "01310-100"),
  BT: digits(5, "11001"),
  BY: digits(6, "220050"),
  CC: digits(4, "6799"),
  CH: digits(4, "8001", "CH"),
  CL: digits(7, "8320000"),
  CN: digits(6, "100000"),
  CO: digits(6, "110111"),
  CR: digits(5, "10101"),
  CU: digits(5, "10400"),
  CV: digits(4, "7600"),
  CX: digits(4, "6798"),
  CY: digits(4, "1010", "CY"),
  CZ: split(3, 2, " ", "110 00", "CZ"),
  DE: digits(5, "10117", "D|DE"),
  DK: digits(4, "1050", "DK"),
  DO: digits(5, "10101"),
  DZ: digits(5, "16000"),
  EC: digits(6, "170150"),
  EE: digits(5, "10111", "EE"),
  EG: digits(5, "11511"),
  ES: digits(5, "28013", "E|ES"),
  ET: digits(4, "1000"),
  FI: digits(5, "00100", "FI"),
  FK: fixed("FIQQ"),
  FO: digits(3, "100", "FO"),
  FR: digits(5, "75001", "F|FR"),
  GE: digits(4, "0108"),
  GF: digits(5, "97300"),
  GL: digits(4, "3900"),
  GP: digits(5, "97110"),
  GR: split(3, 2, " ", "105 57", "GR"),
  GS: fixed("SIQQ"),
  GT: digits(5, "01001"),
  GW: digits(4, "1000"),
  HN: digits(5, "11101"),
  HR: digits(5, "10000", "HR"),
  HT: prefixed("HT", 4, "HT", "HT6110"),
  HU: digits(4, "1051", "H|HU"),
  ID: digits(5, "10110"),
  IE: { pattern: EIRCODE_RE, format: (m) => `${m[1]} ${m[2]}`, example: "D02 X285" },
  IL: digits(7, "6100000"),
  IN: { pattern: /^([1-9]\d{2}) ?(\d{3})$/, format: (m) => `${m[1]}${m[2]}`, example: "110001" },
  IO: fixed("BBND"),
  IQ: digits(5, "10001"),
  IR: split(5, 5, "-", "11369-14111"),
  IS: digits(3, "101", "IS"),
  IT: digits(5, "00184", "I|IT"),
  JO: digits(5, "11118"),
  JP: split(3, 4, "-", "100-0001"),
  KE: digits(5, "00100"),
  KG: digits(6, "720001"),
  KH: { pattern: /^(\d{5,6})$/, format: (m) => m[1], example: "120101" },
  KR: digits(5, "03187"),
  KW: digits(5, "13001"),
  KY: { pattern: /^KY(\d)[- ]?(\d{4})$/, format: (m) => `KY${m[1]}-${m[2]}`, example: "KY1-1101" },
  KZ: digits(6, "050000"),
  LA: digits(5, "01000"),
  LI: digits(4, "9490", "FL|LI"),
  LK: digits(5, "00100"),
  LR: digits(4, "1000"),
  LS: digits(3, "100"),
  LT: prefixed("LT", 5, "LT-", "LT-01100"),
  LU: digits(4, "1009", "L|LU"),
  LV: prefixed("LV", 4, "LV-", "LV-1050"),
  MA: digits(5, "10000"),
  MC: digits(5, "98000", "MC"),
  MD: prefixed("MD", 4, "MD-", "MD-2001"),
  ME: digits(5, "81000"),
  MF: digits(5, "97150"),
  MG: digits(3, "101"),
  MK: digits(4, "1000"),
  MM: digits(5, "11181"),
  MN: digits(5, "14200"),
  MQ: digits(5, "97200"),
  MT: { pattern: /^([A-Z]{3}) ?(\d{4})$/, format: (m) => `${m[1]} ${m[2]}`, example: "VLT 1117" },
  MU: digits(5, "11302"),
  MV: digits(5, "20026"),
  MX: digits(5, "06600"),
  MY: digits(5, "50450"),
  MZ: digits(4, "1100"),
  NC: digits(5, "98800"),
  NE: digits(4, "8001"),
  NF: digits(4, "2899"),
  NG: digits(6, "100001"),
  NI: digits(5, "11001"),
  NO: digits(4, "0150", "N|NO"),
  NP: digits(5, "44600"),
  NZ: digits(4, "6011"),
  OM: digits(3, "100"),
  PE: digits(5, "15001"),
  PF: digits(5, "98714"),
  PG: digits(3, "111"),
  PH: digits(4, "1000"),
  PK: digits(5, "44000"),
  PL: split(2, 3, "-", "00-950", "PL"),
  PM: digits(5, "97500"),
  PN: fixed("PCRN"),
  PT: split(4, 3, "-", "1100-148", "P|PT"),
  RE: digits(5, "97400"),
  RO: digits(6, "010011", "RO"),
  RS: digits(5, "11000"),
  RU: digits(6, "101000"),
  SA: { pattern: /^(\d{5})(?:-?\d{4})?$/, format: (m) => m[1], example: "11564" },
  SD: digits(5, "11111"),
  SE: split(3, 2, " ", "113 51", "S|SE"),
  SG: digits(6, "018956"),
  SH: fixed("STHL"),
  SI: digits(4, "1000", "SI"),
  SJ: digits(4, "9170"),
  SK: split(3, 2, " ", "811 01", "SK"),
  SM: digits(5, "47890"),
  SN: digits(5, "12500"),
  SZ: { pattern: /^([A-Z]) ?(\d{3})$/, format: (m) => `${m[1]}${m[2]}`, example: "H100" },
  TC: fixed("TKCA"),
  TH: digits(5, "10200"),
  TJ: digits(6, "734000"),
  TM: digits(6, "744000"),
  TN: digits(4, "1000"),
  TR: digits(5, "06100"),
  TT: digits(6, "100110"),
  TW: { pattern: /^(\d{3})(?:-?(\d{2,3}))?$/, format: (m) => `${m[1]}${m[2] ?? ""}`, example: "100" },
  UA: digits(5, "01001"),
  UY: digits(5, "11000"),
  UZ: digits(6, "100000"),
  VA: { pattern: /^(00120)$/, format: (m) => m[1], example: "00120" },
  VC: prefixed("VC", 4, "VC", "VC0100"),
  VE: digits(4, "1010"),
  VG: prefixed("VG", 4, "VG", "VG1110"),
  VN: digits(6, "100000"),
  WF: digits(5, "98600"),
  XK: digits(5, "10000"),
  YT: digits(5, "97600"),
  ZA: digits(4, "8001"),
  ZM: digits(5, "10101"),
};

/**
 * Countries and territories that don't use postcodes for home delivery
 * (general knowledge; it only decides whether we look for one).
 */
const NO_POSTCODES: ReadonlySet<string> = new Set([
  "AE", "AG", "AO", "AW", "BF", "BI", "BJ", "BO", "BS", "BW", "BZ", "CD", "CF", "CG", "CI", "CK", "CM", "DJ",
  "DM", "ER", "FJ", "GA", "GD", "GH", "GM", "GQ", "GY", "HK", "KI", "KM", "KN", "KP", "LC", "ML", "MO", "MR",
  "MW", "NR", "NU", "QA", "RW", "SB", "SC", "SL", "SR", "SS", "ST", "SY", "TD", "TG", "TK", "TL", "TO", "TV",
  "UG", "VU", "YE", "ZW",
]);

/** Examples for the countries parse.ts handles itself. */
const BUILT_IN_EXAMPLES: Readonly<Record<string, string>> = {
  US: "60614",
  CA: "K1A 0B1",
  GB: "SW1A 1AA",
  GG: "GY1 1AA",
  JE: "JE2 3AB",
  IM: "IM1 1AA",
  GI: "GX11 1AA",
  NL: "1012 AB",
  AU: "2000",
};

/** The format for a country we have a pattern table entry for (not US / CA / GB / NL / AU, which parse.ts handles). */
export function postcodeSpec(country: string): PostcodeSpec | null {
  const code = normalizeCountryCode(country);
  return code && Object.prototype.hasOwnProperty.call(SPECS, code) ? SPECS[code] : null;
}

export interface PostcodeFormat {
  /** What to call it in copy: "ZIP code", "postal code", "PIN code", "Eircode" or "postcode". */
  label: string;
  /** A correctly formatted example, or null when we don't know the format. */
  example: string | null;
  /** False for countries where homes have no postcode (e.g. UAE, Hong Kong); there's nothing to ask for. */
  usesPostcodes: boolean;
}

/**
 * How postcodes look in `country`, for form labels and placeholders, e.g.
 * postcodeFormat("SE") -> { label: "postcode", example: "113 51", usesPostcodes: true }.
 * Unknown codes and "Other" get a generic answer.
 */
export function postcodeFormat(country: string): PostcodeFormat {
  const code = normalizeCountryCode(country) ?? OTHER_COUNTRY_CODE;
  if (code === "US" || USPS_SERVED_COUNTRY_CODES.has(code)) {
    return { label: "ZIP code", example: code === "US" ? BUILT_IN_EXAMPLES.US : null, usesPostcodes: true };
  }
  const label = code === "CA" ? "postal code" : code === "IN" ? "PIN code" : code === "IE" ? "Eircode" : "postcode";
  if (NO_POSTCODES.has(code)) return { label, example: null, usesPostcodes: false };
  const example = BUILT_IN_EXAMPLES[code] ?? postcodeSpec(code)?.example ?? null;
  return { label, example, usesPostcodes: true };
}

/** True when homes in `country` normally have no postcode. */
export function countryHasNoPostcodes(country: string): boolean {
  const code = normalizeCountryCode(country);
  return code !== null && NO_POSTCODES.has(code);
}

/**
 * Formats distinctive enough to suggest a country when none was chosen
 * (the separator must be typed). Checked after the US, Canada, UK,
 * Australia and the Netherlands.
 */
export const DISTINCTIVE_POSTCODES: readonly { country: string; pattern: RegExp }[] = [
  { country: "BR", pattern: /^\d{5}-\d{3}$/ },
  { country: "PT", pattern: /^\d{4}-\d{3}$/ },
  { country: "JP", pattern: /^\d{3}-\d{4}$/ },
  { country: "PL", pattern: /^\d{2}-\d{3}$/ },
  // Eircode with at least one letter in the unique part, so plain numbers don't count.
  { country: "IE", pattern: /^(?:[AC-FHKNPRTV-Y]\d{2}|D6W) (?=[0-9AC-FHKNPRTV-Y]*[AC-FHKNPRTV-Y])[0-9AC-FHKNPRTV-Y]{4}$/ },
];
