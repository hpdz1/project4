import { SUPPORTED_COUNTRY_CODES, countryName, normalizeCountryCode } from "./countries";
import {
  AU_LOOKUP,
  CA_LOOKUP,
  US_LOOKUP,
  australiaStateFromPostcode,
  canadaProvinceFromPostcode,
  type RegionLookup,
} from "./regions";
import { zipToState } from "./zip";

/** What we could read from a typed address or postcode. Never contains the street itself. */
export interface ParsedLocation {
  /** ISO 3166-1 alpha-2, e.g. "US". */
  country: string;
  /** Normalized ZIP / postcode: US ZIP5, "K1A 0B1", "SW1A 1AA", "1012 AB", "2000", "10117". */
  postalCode: string | null;
  /** State / province / territory code, e.g. "IL", "ON", "NSW". Inferred from the postcode when not typed. */
  region: string | null;
  /** Best-effort city / locality. */
  city: string | null;
  /** True when the input looks like it includes a street line (house number or street type). */
  hasStreet: boolean;
  /** Plain-language problems to show the user. */
  warnings: string[];
}

/** Inputs longer than this are truncated before parsing. */
const MAX_INPUT_LENGTH = 300;

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/** One whitespace-separated word. `seg` is the comma-separated part it came from. */
interface Tok {
  /** As typed (minus wrapping quotes / brackets), for display. */
  raw: string;
  /** Uppercase, accents and periods removed, outer punctuation trimmed. Never empty. */
  key: string;
  seg: number;
}

/** A run of tokens [start, end) plus the normalized postcode it spells. */
interface Span {
  start: number;
  end: number;
  value: string;
}

function tokenKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[.'’]/g, "")
    .replace(/^[^A-Z0-9#]+/, "")
    .replace(/[^A-Z0-9#]+$/, "");
}

function tokenize(input: string): Tok[] {
  const toks: Tok[] = [];
  input.split(/[,;|\n\r]+/).forEach((segment, seg) => {
    for (const word of segment.split(/\s+/)) {
      const key = tokenKey(word);
      if (!key) continue;
      const raw = word.replace(/^[("'“‘[]+/, "").replace(/[)"'”’\]:]+$/, "");
      toks.push({ raw, key, seg });
    }
  });
  return toks;
}

/** Index of the first token in the same comma-separated part as `toks[i]`. */
function segmentStart(toks: Tok[], i: number): number {
  let s = i;
  while (s > 0 && toks[s - 1].seg === toks[i].seg) s--;
  return s;
}

const hasLetter = (key: string) => /[A-Z]/.test(key);
const hasDigit = (key: string) => /\d/.test(key);

// ---------------------------------------------------------------------------
// Street vocabulary (USPS Pub 28 subset, plus common UK/AU street types)
// ---------------------------------------------------------------------------

/**
 * Street types that mark the end of a street name. Deliberately a subset of
 * Pub 28 C1: words such as VALLEY, SPRING, LAKE, PARK or HEIGHTS also appear
 * in city names, so they are left out.
 */
const STREET_TYPES: ReadonlySet<string> = new Set([
  "ST", "STREET", "STR", "AVE", "AV", "AVENUE", "AVN", "RD", "ROAD", "DR", "DRIVE", "DRV", "LN", "LANE",
  "BLVD", "BOULEVARD", "CT", "COURT", "CRT", "PL", "PLACE", "TER", "TERR", "TERRACE", "CIR", "CIRCLE",
  "PKWY", "PARKWAY", "PKY", "HWY", "HIGHWAY", "WAY", "WY", "TRL", "TRAIL", "SQ", "SQUARE", "LOOP", "ALY",
  "ALLEY", "XING", "CROSSING", "CV", "COVE", "PATH", "WALK", "PIKE", "TPKE", "TURNPIKE", "EXPY",
  "EXPRESSWAY", "FWY", "FREEWAY", "PLZ", "PLAZA", "CRES", "CRESCENT", "CLOSE", "GDNS", "GARDENS", "GRV",
  "GROVE", "MEWS", "ROW", "PDE", "PARADE", "ESPLANADE", "RUN", "BYP", "BYPASS", "CSWY", "CAUSEWAY",
  "RTE", "ROUTE",
]);

/** Street types usually followed by a number ("Highway 50", "County Road 12"). */
const NUMBERED_TYPES: ReadonlySet<string> = new Set(["HWY", "HIGHWAY", "RTE", "ROUTE", "RD", "ROAD"]);

/** Abbreviated directionals only: full words such as NORTH start city names ("North Bergen"). */
const DIRECTIONALS: ReadonlySet<string> = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);

/** Pub 28 C2 unit designators that take a number ("APT 4B"). Full words like KEY/SIDE/UPPER are left out (city names). */
const UNIT_WITH_VALUE: ReadonlySet<string> = new Set([
  "APT", "APARTMENT", "APTMT", "STE", "SUITE", "UNIT", "BLDG", "BUILDING", "FL", "FLR", "FLOOR", "RM",
  "ROOM", "LOT", "TRLR", "SPC", "DEPT", "HNGR", "NO", "NUM", "FLAT",
]);

/** Pub 28 C2 abbreviations that stand alone ("BSMT", "REAR"). */
const UNIT_NO_VALUE: ReadonlySet<string> = new Set(["BSMT", "FRNT", "LOWR", "UPPR", "REAR", "OFC", "PH", "LBBY"]);

/**
 * Words that, right before a number, mean the number isn't a postcode ("PO Box 12345").
 * FL is left out: it is Florida far more often than "floor".
 */
const NOT_POSTCODE_AFTER: ReadonlySet<string> = new Set(
  [...UNIT_WITH_VALUE, "#", "BOX", "PMB", "POB", "RR", "HC", "PSC", "CMR", "ROUTE", "RTE", "HWY", "HIGHWAY"].filter(
    (word) => word !== "FL",
  ),
);

/** Two-letter US codes that are also street abbreviations (Court, Northeast, Mount, Prairie, Way, Key, Lane). */
const AMBIGUOUS_REGION_CODES: ReadonlySet<string> = new Set(["CT", "NE", "MT", "PR", "WY", "KY", "LA"]);

function isHouseNumber(key: string): boolean {
  return /^(?:\d+[A-Z]?|\d+-\d+[A-Z]?|[NSEW]\d+[NSEW]\d+)$/.test(key);
}

function isUnitValue(key: string): boolean {
  const bare = key.replace(/^#/, "");
  return /^[A-Z0-9][A-Z0-9-]*$/.test(bare) && (hasDigit(bare) || bare.length <= 2);
}

/** How many tokens a unit designator at `i` spans ("APT 4B" = 2, "#4" = 1), or 0. */
function unitLength(toks: Tok[], i: number): number {
  const tok = toks[i];
  if (!tok) return 0;
  if (tok.key.startsWith("#")) {
    if (tok.key.length > 1) return 1;
    return toks[i + 1] && isUnitValue(toks[i + 1].key) ? 2 : 1;
  }
  if (UNIT_NO_VALUE.has(tok.key)) return 1;
  if (UNIT_WITH_VALUE.has(tok.key)) {
    const next = toks[i + 1];
    if (next && next.key === "#" && toks[i + 2] && isUnitValue(toks[i + 2].key)) return 3;
    return next && isUnitValue(next.key) ? 2 : 0;
  }
  return 0;
}

/** Box-style patterns: "PO BOX 12", "P O BOX 12", "POST OFFICE BOX 12", "RR 2 BOX 152", "PSC 1234 BOX 5678". */
const BOX_PATTERNS: readonly { words: readonly string[]; po: boolean }[] = [
  { words: ["POST", "OFFICE", "BOX", "#"], po: true },
  { words: ["P", "O", "BOX", "#"], po: true },
  { words: ["PO", "BOX", "#"], po: true },
  { words: ["POBOX", "#"], po: true },
  { words: ["POB", "#"], po: true },
  { words: ["BOX", "#"], po: true },
  { words: ["PMB", "#"], po: false },
  { words: ["RURAL", "ROUTE", "#"], po: false },
  { words: ["RR", "#"], po: false },
  { words: ["HC", "#"], po: false },
  { words: ["PSC", "#"], po: false },
  { words: ["CMR", "#"], po: false },
];

/** Length of a box pattern at `i` (including an optional trailing "BOX n"), and whether it's a PO Box. */
function boxAt(toks: Tok[], i: number): { length: number; po: boolean } {
  for (const pattern of BOX_PATTERNS) {
    let k = i;
    let ok = true;
    for (const word of pattern.words) {
      const tok = toks[k];
      if (!tok) {
        ok = false;
        break;
      }
      if (word === "#") {
        if (tok.key === "#" && toks[k + 1] && hasDigit(toks[k + 1].key)) k++;
        if (!hasDigit(toks[k].key)) {
          ok = false;
          break;
        }
      } else if (tok.key !== word) {
        ok = false;
        break;
      }
      k++;
    }
    if (!ok) continue;
    if (toks[k]?.key === "BOX" && toks[k + 1] && hasDigit(toks[k + 1].key)) k += 2;
    return { length: k - i, po: pattern.po };
  }
  return { length: 0, po: false };
}

/** A street type at `k` that ends a street name. "ST" only counts at the end or before a unit/directional ("Port St Lucie"). */
function isStreetTypeLoose(toks: Tok[], k: number): boolean {
  const key = toks[k].key;
  if (!STREET_TYPES.has(key)) return false;
  if (key !== "ST") return true;
  const next = toks[k + 1];
  return !next || unitLength(toks, k + 1) > 0 || DIRECTIONALS.has(next.key);
}

interface Stripped {
  /** Tokens left after removing the street / box / unit prefix. */
  rest: Tok[];
  hadStreet: boolean;
  poBox: boolean;
}

/**
 * Remove a leading street line ("123 N Main St Apt 4"), box line ("PO Box 9")
 * or unit ("Suite 200") from one comma-separated part, leaving what follows
 * (usually the city when the user typed no commas).
 *
 * Without a house number, a street type only ends the street when
 * `looseCut` is set (the part runs straight into the state / postcode, as in
 * "Main Ave Springfield IL"); a part of its own ("Washington Court House, OH")
 * is taken to be the city.
 */
function stripStreet(cand: Tok[], looseCut = false): Stripped {
  let i = 0;
  let hadStreet = false;
  let poBox = false;
  const box = boxAt(cand, 0);
  if (box.length) {
    i = box.length;
    poBox = box.po;
  } else if (cand.length > 1 && isHouseNumber(cand[0].key)) {
    hadStreet = true;
    let j = -1;
    for (let k = 2; k < cand.length; k++) {
      if (STREET_TYPES.has(cand[k].key)) {
        j = k;
        break;
      }
    }
    if (j >= 0) {
      i = j + 1;
      if (NUMBERED_TYPES.has(cand[j].key) && cand[i] && /^\d+[A-Z]?$/.test(cand[i].key)) i++;
      if (cand[i] && DIRECTIONALS.has(cand[i].key)) i++;
    } else {
      // No street type ("123 Broadway"): only a unit designator tells us where the street ends.
      let u = -1;
      for (let k = 2; k < cand.length; k++) {
        if (unitLength(cand, k) > 0) {
          u = k;
          break;
        }
      }
      if (u < 0) return { rest: [], hadStreet, poBox };
      i = u;
    }
  } else if (looseCut) {
    for (let k = 1; k < cand.length - 1; k++) {
      if (isStreetTypeLoose(cand, k)) {
        i = k + 1;
        hadStreet = true;
        if (cand[i] && DIRECTIONALS.has(cand[i].key) && cand[i + 1]) i++;
        break;
      }
    }
  }
  for (;;) {
    const unit = unitLength(cand, i);
    const more = unit || boxAt(cand, i).length;
    if (!more) break;
    i += more;
  }
  return { rest: cand.slice(i), hadStreet, poBox };
}

/** Does one comma-separated part read like a street line? */
function looksLikeStreet(part: Tok[]): boolean {
  if (part.length === 0) return false;
  if (part.length > 1 && isHouseNumber(part[0].key) && part.slice(1).some((t) => hasLetter(t.key))) return true;
  for (let k = 1; k < part.length; k++) if (isStreetTypeLoose(part, k)) return true;
  return false;
}

/** Group tokens [0, end) by comma-separated part. */
function partsBefore(toks: Tok[], end: number): Tok[][] {
  const parts: Tok[][] = [];
  for (let i = 0; i < end; i++) {
    const last = parts[parts.length - 1];
    if (last && last[0].seg === toks[i].seg) last.push(toks[i]);
    else parts.push([toks[i]]);
  }
  return parts;
}

// ---------------------------------------------------------------------------
// Postcodes
// ---------------------------------------------------------------------------

type PostcodeMatcher = (a: string, b: string | null) => { value: string; length: 1 | 2 } | null;

const US_ZIP_RE = /^(\d{5})(?:[-–]?\d{4})?$/;
const CA_POSTCODE_RE = /^([ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z])[- ]?(\d[ABCEGHJ-NPRSTV-Z]\d)$/;
const UK_POSTCODE_RE =
  /^(?:GIR ?0AA|[A-PR-UWYZ](?:\d{1,2}|[A-HK-Y]\d(?:\d|[ABEHMNPRV-Y])?|\d[A-HJKPS-UW]) ?\d[ABD-HJLNP-UW-Z]{2})$/;
const NL_POSTCODE_RE = /^([1-9]\d{3}) ?([A-Z]{2})$/;

const matchUs: PostcodeMatcher = (a) => {
  const m = US_ZIP_RE.exec(a);
  return m ? { value: m[1], length: 1 } : null;
};

const matchCa: PostcodeMatcher = (a, b) => {
  const pair = b ? CA_POSTCODE_RE.exec(`${a} ${b}`) : null;
  if (pair) return { value: `${pair[1]} ${pair[2]}`, length: 2 };
  const single = CA_POSTCODE_RE.exec(a);
  return single ? { value: `${single[1]} ${single[2]}`, length: 1 } : null;
};

const matchGb: PostcodeMatcher = (a, b) => {
  const canonical = (s: string) => {
    const compact = s.replace(/\s+/g, "");
    return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
  };
  if (b && UK_POSTCODE_RE.test(`${a} ${b}`)) return { value: canonical(`${a}${b}`), length: 2 };
  return UK_POSTCODE_RE.test(a) && a.length >= 5 ? { value: canonical(a), length: 1 } : null;
};

const matchNl: PostcodeMatcher = (a, b) => {
  const valid = (m: RegExpExecArray | null) => (m && !["SA", "SD", "SS"].includes(m[2]) ? m : null);
  const pair = b ? valid(NL_POSTCODE_RE.exec(`${a} ${b}`)) : null;
  if (pair) return { value: `${pair[1]} ${pair[2]}`, length: 2 };
  const single = valid(NL_POSTCODE_RE.exec(a));
  return single ? { value: `${single[1]} ${single[2]}`, length: 1 } : null;
};

const matchAu: PostcodeMatcher = (a) => (/^\d{4}$/.test(a) ? { value: a, length: 1 } : null);

const matchDe: PostcodeMatcher = (a) => (/^\d{5}$/.test(a) ? { value: a, length: 1 } : null);

/** The last postcode in the input that `accept` doesn't veto. */
function findLastPostcode(toks: Tok[], matcher: PostcodeMatcher, accept?: (span: Span) => boolean): Span | null {
  for (let i = toks.length - 1; i >= 0; i--) {
    const next = toks[i + 1] && toks[i + 1].seg === toks[i].seg ? toks[i + 1].key : null;
    const m = matcher(toks[i].key, next);
    if (!m) continue;
    const span = { start: i, end: i + m.length, value: m.value };
    if (!accept || accept(span)) return span;
  }
  return null;
}

/** Vetoes numbers that follow "Box"/"Apt" etc. */
function notAfterUnitWord(toks: Tok[]) {
  return (span: Span): boolean => {
    const s = segmentStart(toks, span.start);
    return !(span.start > s && NOT_POSTCODE_AFTER.has(toks[span.start - 1].key));
  };
}

/** Vetoes numbers that are really house numbers: first in their part and followed by words ("12345 Main St"). */
function notHouseNumber(toks: Tok[]) {
  const afterUnit = notAfterUnitWord(toks);
  return (span: Span): boolean => {
    if (!afterUnit(span)) return false;
    if (span.start !== segmentStart(toks, span.start)) return true;
    for (let k = span.end; k < toks.length && toks[k].seg === toks[span.start].seg; k++) {
      if (hasLetter(toks[k].key)) return false;
    }
    return true;
  };
}

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

interface RegionMatch {
  start: number;
  end: number;
  code: string;
}

/** A state / province name or code ending right before token `anchor` (whole words, longest name first). */
function regionBefore(toks: Tok[], anchor: number, lookup: RegionLookup): RegionMatch | null {
  for (let n = Math.min(lookup.maxNameWords, anchor); n >= 1; n--) {
    const start = anchor - n;
    const words = toks.slice(start, anchor);
    if (words.some((w) => w.seg !== words[0].seg || !/^[A-Z]+$/.test(w.key))) continue;
    const key = words.map((w) => w.key).join(" ");
    const code = lookup.names.get(key) ?? (n === 1 ? lookup.codes.get(key) : undefined);
    if (code) return { start, end: anchor, code };
  }
  return null;
}

/**
 * Reject a region that is really part of the street line: "456 Elm Ct" (no
 * ZIP) or "1600 Pennsylvania" are streets, not Connecticut / Pennsylvania.
 */
function regionIsPlausible(toks: Tok[], region: RegionMatch, hasPostcode: boolean): boolean {
  const s = segmentStart(toks, region.start);
  if (region.start === s) return true;
  const before = toks.slice(s, region.start);
  if (!isHouseNumber(before[0].key)) return true;
  if (hasPostcode && !AMBIGUOUS_REGION_CODES.has(toks[region.start].key)) return true;
  return stripStreet(before).rest.some((t) => hasLetter(t.key));
}

// ---------------------------------------------------------------------------
// City
// ---------------------------------------------------------------------------

function titleCase(text: string): string {
  return text.toLowerCase().replace(/(^|[\s\-.])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** The city as typed (casing is fixed up later), or null when it doesn't look like a place name. */
function cityText(tokens: Tok[]): string | null {
  if (tokens.length === 0 || tokens.length > 6 || hasDigit(tokens[0].key)) return null;
  let text = tokens.map((t) => t.raw).join(" ").trim();
  if (/^[^.]+\.$/.test(tokens[tokens.length - 1].raw)) text = text.replace(/\.$/, "");
  if (!/[A-Za-z]/.test(text) || text.length > 60) return null;
  return text;
}

/** Keep the user's casing unless they typed everything in one case ("SPRINGFIELD", "springfield"). */
function displayCity(city: string | null, input: string): string | null {
  if (!city) return null;
  const mixed = input !== input.toUpperCase() && input !== input.toLowerCase();
  return mixed ? city : titleCase(city);
}

interface Locality {
  seg: number;
  city: string | null;
  hadStreet: boolean;
  poBox: boolean;
}

/** The locality in the comma-separated part that ends right before token `end`, minus any street prefix. */
function localityBefore(toks: Tok[], end: number): Locality | null {
  const prev = end - 1;
  if (prev < 0) return null;
  const cand = toks.slice(segmentStart(toks, prev), end);
  const sharesPartWithAnchor = end < toks.length && toks[end].seg === toks[prev].seg;
  const stripped = stripStreet(cand, sharesPartWithAnchor);
  return { seg: toks[prev].seg, city: cityText(stripped.rest), hadStreet: stripped.hadStreet, poBox: stripped.poBox };
}

/** The locality right after a postcode, as in "1012 LG Amsterdam" or "10117 Berlin, Germany". */
function localityAfter(toks: Tok[], span: Span): string | null {
  const seg = toks[span.start].seg;
  const same = toks.slice(span.end).filter((t) => t.seg === seg);
  if (same.length) return cityText(same);
  const next = toks[span.end];
  if (!next) return null;
  const nextPart = toks.slice(span.end).filter((t) => t.seg === next.seg);
  return nextPart.some((t) => hasDigit(t.key)) ? null : cityText(nextPart);
}

// ---------------------------------------------------------------------------
// Countries
// ---------------------------------------------------------------------------

/**
 * Country names typed at the end of an address. Ambiguous ones are left out:
 * CA/DE/NL are also state or province codes, "Wales" ends "New South Wales",
 * "Mexico" ends "New Mexico", and Holland / Georgia / Jersey are US places.
 */
const COUNTRY_ALIASES: ReadonlyMap<string, string> = new Map([
  ["US", "US"],
  ["USA", "US"],
  ["U S", "US"],
  ["U S A", "US"],
  ["UNITED STATES", "US"],
  ["UNITED STATES OF AMERICA", "US"],
  ["CANADA", "CA"],
  ["UK", "GB"],
  ["U K", "GB"],
  ["UNITED KINGDOM", "GB"],
  ["GREAT BRITAIN", "GB"],
  ["ENGLAND", "GB"],
  ["SCOTLAND", "GB"],
  ["NORTHERN IRELAND", "GB"],
  ["NETHERLANDS", "NL"],
  ["THE NETHERLANDS", "NL"],
  ["NEDERLAND", "NL"],
  ["GERMANY", "DE"],
  ["DEUTSCHLAND", "DE"],
  ["AUSTRALIA", "AU"],
  // Countries without program data: recognized so we don't misread their postcodes as US ZIPs.
  ["FRANCE", "FR"],
  ["SPAIN", "ES"],
  ["ITALY", "IT"],
  ["IRELAND", "IE"],
  ["NEW ZEALAND", "NZ"],
  ["BELGIUM", "BE"],
  ["SWITZERLAND", "CH"],
  ["AUSTRIA", "AT"],
  ["SWEDEN", "SE"],
  ["NORWAY", "NO"],
  ["DENMARK", "DK"],
  ["POLAND", "PL"],
  ["PORTUGAL", "PT"],
  ["JAPAN", "JP"],
  ["SINGAPORE", "SG"],
]);

/** Remove a trailing country name; returns its code. */
function stripTrailingCountry(toks: Tok[]): { toks: Tok[]; country: string | null } {
  for (let n = Math.min(4, toks.length); n >= 1; n--) {
    const words = toks.slice(toks.length - n);
    if (words.some((w) => w.seg !== words[0].seg)) continue;
    const code = COUNTRY_ALIASES.get(words.map((w) => w.key).join(" "));
    if (code) return { toks: toks.slice(0, toks.length - n), country: code };
  }
  return { toks, country: null };
}

/** A Dutch-looking "1234 AB" at the start of a part followed by a street type is a US house number ("1234 NE Glisan St"). */
function nlIsPlausible(toks: Tok[]) {
  return (span: Span): boolean => {
    if (span.start !== segmentStart(toks, span.start)) return true;
    const seg = toks[span.start].seg;
    return !toks.slice(span.end).some((t) => t.seg === seg && STREET_TYPES.has(t.key));
  };
}

/** Country implied by the shape of the address, or null when nothing is distinctive. */
function detectCountry(toks: Tok[]): string | null {
  const zip = findLastPostcode(toks, matchUs, notHouseNumber(toks));
  if (zip && (regionBefore(toks, zip.start, US_LOOKUP) || /\d{5}[-–]?\d{4}/.test(toks[zip.start].key))) return "US";
  if (findLastPostcode(toks, matchCa)) return "CA";
  if (findLastPostcode(toks, matchGb)) return "GB";
  const au = findLastPostcode(toks, matchAu, (span) => regionBefore(toks, span.start, AU_LOOKUP) !== null);
  if (au) return "AU";
  if (findLastPostcode(toks, matchNl, nlIsPlausible(toks))) return "NL";
  return null;
}

// ---------------------------------------------------------------------------
// Per-country parsing
// ---------------------------------------------------------------------------

interface CountryParse {
  postalCode: string | null;
  region: string | null;
  city: string | null;
  hasStreet: boolean;
  warnings: string[];
}

interface StructuredSpec {
  matcher: PostcodeMatcher;
  accept?: (toks: Tok[]) => (span: Span) => boolean;
  lookup: RegionLookup;
  inferRegion: (postcode: string) => string | null;
  /** "ZIP code", "postal code", "postcode". */
  postcodeLabel: string;
  missingPostcode: string;
}

/** Shared parser for "street, city REGION POSTCODE" countries (US, CA, AU). */
function parseStructured(toks: Tok[], spec: StructuredSpec): CountryParse & { poBox: boolean } {
  const warnings: string[] = [];
  const postcode = findLastPostcode(toks, spec.matcher, spec.accept?.(toks));
  const anchor = postcode ? postcode.start : toks.length;
  let region = regionBefore(toks, anchor, spec.lookup);
  if (region && !regionIsPlausible(toks, region, postcode !== null)) region = null;

  const inferred = postcode ? spec.inferRegion(postcode.value) : null;
  if (!postcode) warnings.push(spec.missingPostcode);
  else if (region && inferred && region.code !== inferred) {
    warnings.push(
      `${capitalize(spec.postcodeLabel)} ${postcode.value} is in ${inferred}, but the address says ${region.code}. Please double-check it.`,
    );
  }

  const localityEnd = region ? region.start : postcode ? postcode.start : null;
  const locality = localityEnd !== null ? localityBefore(toks, localityEnd) : null;
  const streetParts = partsBefore(toks, localityEnd ?? toks.length).filter((part) => part[0].seg !== locality?.seg);
  const poBox = Boolean(locality?.poBox) || streetParts.some((part) => boxAt(part, 0).po);

  return {
    postalCode: postcode?.value ?? null,
    region: region?.code ?? inferred,
    city: locality?.city ?? null,
    hasStreet: Boolean(locality?.hadStreet) || streetParts.some(looksLikeStreet),
    warnings,
    poBox,
  };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function parseUs(toks: Tok[]): CountryParse {
  const result = parseStructured(toks, {
    matcher: matchUs,
    accept: notHouseNumber,
    lookup: US_LOOKUP,
    inferRegion: zipToState,
    postcodeLabel: "ZIP code",
    missingPostcode: "We couldn't find a ZIP code. Add your 5-digit ZIP code so we can check which programs cover you.",
  });
  if (result.postalCode && !zipToState(result.postalCode)) {
    result.warnings.push(`ZIP code ${result.postalCode} doesn't look right. Please double-check it.`);
  }
  if (result.poBox) {
    result.warnings.push(
      "This looks like a PO Box. USPS Informed Delivery works with PO Boxes, but UPS My Choice and FedEx Delivery Manager need your street address.",
    );
  }
  return result;
}

function parseCa(toks: Tok[]): CountryParse {
  return parseStructured(toks, {
    matcher: matchCa,
    lookup: CA_LOOKUP,
    inferRegion: canadaProvinceFromPostcode,
    postcodeLabel: "postal code",
    missingPostcode: "We couldn't find a postal code. Add it (for example K1A 0B1) so we can check coverage.",
  });
}

function parseAu(toks: Tok[]): CountryParse {
  return parseStructured(toks, {
    matcher: matchAu,
    accept: notHouseNumber,
    lookup: AU_LOOKUP,
    inferRegion: australiaStateFromPostcode,
    postcodeLabel: "postcode",
    missingPostcode: "We couldn't find a postcode. Add your 4-digit postcode so we can check coverage.",
  });
}

/** Street-line check for countries without a structured parser: a part with both a number and a word. */
function genericHasStreet(parts: Tok[][]): boolean {
  return parts.some(
    (part) => looksLikeStreet(part) || (part.some((t) => hasDigit(t.key)) && part.some((t) => /[A-Z]{2}/.test(t.key))),
  );
}

/** Tokens outside [span.start, span.end), grouped by comma-separated part. */
function partsWithout(toks: Tok[], span: Span | null): Tok[][] {
  const kept = span ? [...toks.slice(0, span.start), ...toks.slice(span.end)] : toks;
  return partsBefore(kept, kept.length);
}

function parseGb(toks: Tok[]): CountryParse {
  const postcode = findLastPostcode(toks, matchGb);
  const locality = postcode ? localityBefore(toks, postcode.start) : null;
  const parts = partsWithout(toks, postcode).filter((part) => part[0].seg !== locality?.seg);
  return {
    postalCode: postcode?.value ?? null,
    region: null,
    city: locality?.city ?? null,
    hasStreet: Boolean(locality?.hadStreet) || genericHasStreet(parts),
    warnings: postcode ? [] : ["We couldn't find a postcode. Add it (for example SW1A 1AA) so we can check coverage."],
  };
}

/** Netherlands and Germany: "street number, POSTCODE City". */
function parsePostcodeFirst(toks: Tok[], matcher: PostcodeMatcher, missing: string): CountryParse {
  const postcode = findLastPostcode(toks, matcher, notAfterUnitWord(toks));
  let city = postcode ? localityAfter(toks, postcode) : null;
  if (!city && postcode) city = localityBefore(toks, postcode.start)?.city ?? null;
  const parts = partsWithout(toks, postcode).filter((part) => !(city && cityText(part) === city));
  return {
    postalCode: postcode?.value ?? null,
    region: null,
    city,
    hasStreet: genericHasStreet(parts),
    warnings: postcode ? [] : [missing],
  };
}

function parseOther(toks: Tok[]): CountryParse {
  return {
    postalCode: null,
    region: null,
    city: null,
    hasStreet: genericHasStreet(partsBefore(toks, toks.length)),
    warnings: [],
  };
}

function parseFor(country: string, toks: Tok[]): CountryParse {
  switch (country) {
    case "US":
      return parseUs(toks);
    case "CA":
      return parseCa(toks);
    case "AU":
      return parseAu(toks);
    case "GB":
      return parseGb(toks);
    case "NL":
      return parsePostcodeFirst(toks, matchNl, "We couldn't find a postcode. Add it (for example 1012 AB) so we can check coverage.");
    case "DE":
      return parsePostcodeFirst(toks, matchDe, "We couldn't find a postcode. Add your 5-digit Postleitzahl so we can check coverage.");
    default:
      return parseOther(toks);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read the country, ZIP / postcode, state / province and city from a one-line
 * address or a bare postcode. Runs in the browser; the street itself is only
 * used to find the boundaries and is never returned.
 *
 * The country comes from `countryHint` when given (e.g. a country picker),
 * else from a trailing country name, else from the postcode's shape (Canada,
 * UK, Australia with a state, Netherlands), else "US". A bare 5-digit number
 * is only treated as German with `countryHint` "DE" (or a typed "Germany").
 *
 * Never throws; problems are reported in `warnings`.
 *
 * @example parseLocation("123 Main St Apt 4B, Springfield, IL 62701-1234")
 *   // { country: "US", postalCode: "62701", region: "IL", city: "Springfield", hasStreet: true, warnings: [] }
 */
export function parseLocation(input: string, countryHint?: string): ParsedLocation {
  const text = typeof input === "string" ? input.slice(0, MAX_INPUT_LENGTH) : "";
  const hint = normalizeCountryCode(countryHint);
  const stripped = stripTrailingCountry(tokenize(text));
  const toks = stripped.toks;
  const detected = stripped.country ?? detectCountry(toks);
  const country = hint ?? detected ?? "US";

  if (toks.length === 0 && !stripped.country) {
    return {
      country,
      postalCode: null,
      region: null,
      city: null,
      hasStreet: false,
      warnings: [country === "US" ? "Enter your address or ZIP code." : "Enter your address or postcode."],
    };
  }

  const parsed = parseFor(country, toks);
  const warnings = [...parsed.warnings];
  if (detected && detected !== country && SUPPORTED_COUNTRY_CODES.has(detected)) {
    const name = countryName(detected) ?? detected;
    warnings.push(`This looks like an address in ${name}. Choose ${name} as your country if that's right.`);
  }
  return {
    country,
    postalCode: parsed.postalCode,
    region: parsed.region,
    city: displayCity(parsed.city, text),
    hasStreet: parsed.hasStreet,
    warnings,
  };
}
