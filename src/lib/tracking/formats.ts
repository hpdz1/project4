import type { CarrierId, DetectedTrackingNumber } from "@/lib/types";
import { sameFamily } from "./carriers";
import {
  correosCheckLetter,
  evriCheckDigit,
  glsCheckDigit,
  gs1CheckDigit,
  identcodeCheckDigit,
  iso7064Mod3736CheckChar,
  luhnCheckDigit,
  mod10CheckDigit,
  mod7CheckDigit,
  sfCheckDigit,
  uspsCheckDigit,
  weightedMod11CheckDigit,
} from "./checksums";
import { normalizeTrackingNumber } from "./normalize";
import { parseS10 } from "./s10";

/**
 * Tracking-number formats. US carriers: jkeen/tracking_number_data v2.0.0 and
 * USPS Publication 199 v35 (research/tracking_numbers.md); LaserShip is
 * OnTrac. Worldwide: research/worldwide/tracking-formats-intl.md, with every
 * check-digit rule re-verified against real sourced numbers by an independent
 * implementation. UPU S10 international mail is reported as the post named by
 * its country suffix (US -> USPS, GB -> Royal Mail, ...) or `intl_post`.
 */

/**
 * How much surrounding evidence `findTrackingNumbers` needs before it trusts a
 * match in free text.
 * - `distinctive`: a prefix, length and/or check digit make accidental matches unlikely.
 * - `context`: short or all-digit; needs a tracking link, a carrier hint, the carrier's
 *   name or a nearby tracking keyword.
 * - `named`: all-digit with a check digit that several carriers share or that random
 *   numbers often pass; needs a tracking link, a carrier hint or the carrier's name
 *   (a keyword alone can't tell whose number it is).
 * - `carrier`: generic shape and no check digit; needs that carrier (hint, link or name)
 *   *and* a tracking keyword or link.
 */
export type Evidence = "distinctive" | "context" | "named" | "carrier";

export type FormatId =
  | "ups_1z"
  | "ups_waybill"
  | "usps_impb"
  | "usps_legacy"
  | "usps_20"
  | "s10"
  | "fedex_12"
  | "fedex_15"
  | "fedex_96"
  | "fedex_34"
  | "fedex_gsn"
  | "fedex_astra"
  | "fedex_sscc18"
  | "fedex_ground_economy_20"
  | "dhl_express"
  | "dhl_piece_id"
  | "dhl_ecommerce"
  | "dhl_ecommerce_gm"
  | "dhl_ecommerce_jvgl"
  | "dhl_ecommerce_14"
  | "dhl_paket_sscc"
  | "dhl_paket_jjd"
  | "dhl_paket_jd"
  | "dhl_paket_jjd16"
  | "dhl_paket_identcode"
  | "amazon_tba"
  | "amazon_international"
  | "amazon_eu"
  | "ontrac_cd"
  | "lasership_lx"
  | "lasership_1ls7"
  | "lasership_1ls7_18"
  | "lasership_1lscx"
  | "canada_post_16"
  | "purolator_12"
  | "purolator_alpha"
  | "estafeta_22_lettered"
  | "estafeta_22"
  | "estafeta_10"
  | "hermes_h20"
  | "hermes_14"
  | "evri_16"
  | "evri_numeric_16"
  | "parcelforce_pb"
  | "royal_mail_2d"
  | "dpd_15_letter"
  | "dpd_15_digit"
  | "dpd_14"
  | "dpd_fr_250"
  | "dpd_pl"
  | "gls_12"
  | "gls_11"
  | "gls_track_id"
  | "postnl_3s"
  | "bpost_32"
  | "colissimo_13"
  | "la_poste_15"
  | "chronopost_15"
  | "swiss_post_18"
  | "austrian_post_22"
  | "correos_23"
  | "correos_16"
  | "correos_pr"
  | "poste_ra"
  | "poste_uw"
  | "poste_2ima"
  | "poste_5p"
  | "inpost_24"
  | "inpost_jjd16"
  | "poczta_px"
  | "poczta_20"
  | "packeta_z"
  | "packeta_10"
  | "postnord_se11"
  | "postnord_sscc"
  | "bring_sscc"
  | "bring_37"
  | "bring_70"
  | "posti_jjfi"
  | "posti_sscc"
  | "australia_post_domestic"
  | "japan_post_12"
  | "japan_post_11"
  | "yamato_12"
  | "sagawa_12"
  | "korea_post_13"
  | "sf_express_sf"
  | "sf_express_12"
  | "cainiao_lp"
  | "cainiao_cng"
  | "cainiao_dofr"
  | "yunexpress_yt"
  | "fourpx"
  | "yanwen_bys"
  | "delhivery"
  | "blue_dart_11"
  | "aramex";

/** A detection plus the internal facts the extractor needs. */
export interface FormatMatch extends DetectedTrackingNumber {
  formatId: FormatId;
  evidence: Evidence;
  /** See `FormatDef.generic`. */
  generic: boolean;
}

interface Shape {
  /** null = the format has no check digit. */
  valid: boolean | null;
  format: string;
  /** Canonical number when it differs from the input (USPS: PIC without 420+ZIP). */
  trackingNumber?: string;
  /** Carrier when it depends on the number (S10: the post named by the country suffix). */
  carrier?: CarrierId;
  /** ISO country encoded in the number. */
  originCountry?: string | null;
}

interface FormatDef {
  id: FormatId;
  carrier: CarrierId;
  evidence: Evidence;
  /**
   * Any string of this length (or prefix) fits and there is no check digit
   * ("24 digits"): only a classification when that carrier is known.
   */
  generic?: boolean;
  /** Higher = more specific; breaks ties between formats that both match. */
  rank: number;
  /** Normalized lengths this format can have (cheap pre-filter before `match`). */
  lengths: readonly number[];
  /** Returns null when `s` (normalized) does not have this format's shape. */
  match: (s: string) => Shape | null;
}

const FEDEX_12_WEIGHTS = [3, 1, 7, 3, 1, 7, 3, 1, 7, 3, 1] as const;
const FEDEX_34_WEIGHTS = [1, 7, 3, 1, 7, 3, 1, 7, 3, 1, 7, 3, 1] as const;

/** `check` is the printed check character; true when it equals `expected`. */
function ok(check: string, expected: number): boolean {
  return check === String(expected);
}

/** Splits off the last character as the check digit. */
function body(s: string): [serial: string, check: string] {
  return [s.slice(0, -1), s.slice(-1)];
}

// ---------------------------------------------------------------------------
// USPS
// ---------------------------------------------------------------------------

/**
 * Ways to read `s` as [optional 420 + ZIP routing prefix] + PIC. IMpb and
 * 22-digit legacy PICs start with 9, so a leading "420" means routing (bare
 * 20-digit numbers are handled by `usps_20`). ZIP+4 is tried first, like the
 * reference regex, but both readings are checked.
 */
function uspsRoutings(s: string): { pic: string; zipLen: 0 | 5 | 9 }[] {
  if (!/^[0-9]+$/.test(s)) return [];
  if (!s.startsWith("420")) return [{ pic: s, zipLen: 0 }];
  return [
    { pic: s.slice(12), zipLen: 9 },
    { pic: s.slice(8), zipLen: 5 },
  ];
}

/**
 * IMpb PIC shape (Pub 199 Appendix J). Commercial AIs: 92 = 9-digit MID (starts
 * with 9), 93 = 6-digit MID (doesn't), 95 = retail; PIC is 22 or 26 digits.
 * AI 94 puts a 2-digit Source ID before the MID, so its MID can't be read from
 * a fixed position; N constructs are 22, 26 or 30 digits. (The research
 * fact-check overrides tracking_number_data here, which rejects 30-digit N10
 * numbers whose Source ID doesn't start with 9.)
 */
function isImpbPic(pic: string): boolean {
  const len = pic.length;
  const mid9 = pic[5] === "9";
  switch (pic.slice(0, 2)) {
    case "92":
      return mid9 && (len === 22 || len === 26);
    case "93":
      return !mid9 && (len === 22 || len === 26);
    case "94":
      return len === 22 || len === 26 || len === 30;
    case "95":
      return len === 22 || len === 26;
    default:
      return false;
  }
}

/** Valid when the PIC's own check digit (Pub 199 §4.6) matches. */
function uspsPicValid(pic: string): boolean {
  const [serial, check] = body(pic);
  return ok(check, uspsCheckDigit(serial));
}

/** Legacy 20-digit numbers are checked as if prefixed with AI "91" unless they already start with 91. */
function usps20Valid(pic: string, allowPlain: boolean): boolean {
  const [serial, check] = body(pic);
  const implied = serial.startsWith("91") ? serial : `91${serial}`;
  if (ok(check, uspsCheckDigit(implied))) return true;
  return allowPlain && ok(check, uspsCheckDigit(serial));
}

function bestRouting(
  s: string,
  accept: (pic: string, zipLen: 0 | 5 | 9) => boolean,
  validate: (pic: string) => boolean,
): { pic: string; zipLen: 0 | 5 | 9; valid: boolean } | null {
  let fallback: { pic: string; zipLen: 0 | 5 | 9; valid: boolean } | null = null;
  for (const { pic, zipLen } of uspsRoutings(s)) {
    if (!accept(pic, zipLen)) continue;
    const valid = validate(pic);
    if (valid) return { pic, zipLen, valid };
    fallback ??= { pic, zipLen, valid };
  }
  return fallback;
}

function routedName(base: string, pic: string, zipLen: number): string {
  return zipLen === 0
    ? `${base} (${pic.length} digits)`
    : `${base} (${pic.length} digits, from 420+ZIP barcode)`;
}

const uspsImpb: FormatDef = {
  id: "usps_impb",
  carrier: "usps",
  evidence: "distinctive",
  rank: 95,
  lengths: [22, 26, 30, 34],
  match(s) {
    const hit = bestRouting(
      s,
      (pic, zipLen) => isImpbPic(pic) && (zipLen === 0 || pic.length === 22 || (zipLen === 5 && pic.length === 26)),
      uspsPicValid,
    );
    if (!hit) return null;
    return { valid: hit.valid, format: routedName("USPS IMpb", hit.pic, hit.zipLen), trackingNumber: hit.pic };
  },
};

const uspsLegacy: FormatDef = {
  id: "usps_legacy",
  carrier: "usps",
  evidence: "distinctive",
  rank: 94,
  lengths: [22, 28, 30, 32, 34],
  match(s) {
    const hit = bestRouting(
      s,
      (pic, zipLen) => (pic.length === 22 && pic.startsWith("91")) || (zipLen > 0 && pic.length === 20),
      (pic) => (pic.length === 22 ? uspsPicValid(pic) : usps20Valid(pic, false)),
    );
    if (!hit) return null;
    return { valid: hit.valid, format: routedName("USPS legacy", hit.pic, hit.zipLen), trackingNumber: hit.pic };
  },
};

const usps20: FormatDef = {
  id: "usps_20",
  carrier: "usps",
  evidence: "context",
  rank: 60,
  lengths: [20],
  match(s) {
    if (!/^[0-9]{20}$/.test(s)) return null;
    return { valid: usps20Valid(s, true), format: "USPS (20 digits)" };
  },
};

// ---------------------------------------------------------------------------
// Everything else
// ---------------------------------------------------------------------------

const FORMATS: readonly FormatDef[] = [
  {
    id: "ups_1z",
    carrier: "ups",
    evidence: "distinctive",
    rank: 100,
    lengths: [18],
    match(s) {
      const m = /^1Z([A-Z0-9]{15})([0-9])$/.exec(s);
      if (!m) return null;
      return { valid: ok(m[2], mod10CheckDigit(m[1], 1, 2)), format: "UPS 1Z" };
    },
  },
  {
    id: "ups_waybill",
    carrier: "ups",
    evidence: "context",
    rank: 60,
    lengths: [11],
    match(s) {
      const m = /^[AHJKTV]([0-9]{9})([0-9])$/.exec(s);
      if (!m) return null;
      return { valid: ok(m[2], mod10CheckDigit(m[1], 1, 2)), format: "UPS waybill" };
    },
  },
  uspsImpb,
  uspsLegacy,
  usps20,
  {
    id: "s10",
    carrier: "intl_post",
    evidence: "distinctive",
    rank: 90,
    lengths: [13],
    match(s) {
      const p = parseS10(s);
      if (!p) return null;
      return { valid: p.valid, format: "UPU S10 international mail", carrier: p.carrier, originCountry: p.country };
    },
  },
  {
    id: "fedex_12",
    carrier: "fedex",
    evidence: "context",
    rank: 50,
    lengths: [12],
    match(s) {
      if (!/^[0-9]{12}$/.test(s)) return null;
      const [serial, check] = body(s);
      return { valid: ok(check, weightedMod11CheckDigit(serial, FEDEX_12_WEIGHTS)), format: "FedEx Express (12 digits)" };
    },
  },
  {
    id: "fedex_15",
    carrier: "fedex",
    evidence: "context",
    rank: 50,
    lengths: [15],
    match(s) {
      if (!/^[0-9]{15}$/.test(s)) return null;
      const [serial, check] = body(s);
      return { valid: ok(check, mod10CheckDigit(serial, 1, 3)), format: "FedEx Ground (15 digits)" };
    },
  },
  {
    id: "fedex_96",
    carrier: "fedex",
    evidence: "distinctive",
    rank: 90,
    lengths: [22],
    match(s) {
      const m = /^96[0-9]{5}([0-9]{14})([0-9])$/.exec(s);
      if (!m) return null;
      return { valid: ok(m[2], mod10CheckDigit(m[1], 1, 3)), format: "FedEx Ground 96 (22 digits)" };
    },
  },
  {
    id: "fedex_gsn",
    carrier: "fedex",
    evidence: "distinctive",
    rank: 90,
    lengths: [34],
    match(s) {
      const m = /^96[0-9]{18}([0-9]{13})([0-9])$/.exec(s);
      if (!m) return null;
      return { valid: ok(m[2], weightedMod11CheckDigit(m[1], FEDEX_34_WEIGHTS)), format: "FedEx Ground GSN (34 digits)" };
    },
  },
  {
    id: "fedex_34",
    carrier: "fedex",
    evidence: "distinctive",
    // Below USPS: a 34-digit "420..." string can pass both; the USPS reading is preferred.
    rank: 70,
    lengths: [34],
    match(s) {
      const m = /^[0-8][0-9]{19}([0-9]{13})([0-9])$/.exec(s);
      if (!m) return null;
      return { valid: ok(m[2], weightedMod11CheckDigit(m[1], FEDEX_34_WEIGHTS)), format: "FedEx Express (34 digits)" };
    },
  },
  {
    id: "fedex_astra",
    carrier: "fedex",
    evidence: "distinctive",
    rank: 85,
    lengths: [32],
    match(s) {
      const m = /^3[0-9]{15}([0-9]{11})([0-9])[0-9]{4}$/.exec(s);
      if (!m) return null;
      return { valid: ok(m[2], weightedMod11CheckDigit(m[1], FEDEX_12_WEIGHTS)), format: "FedEx ASTRA (32 digits)" };
    },
  },
  {
    id: "fedex_sscc18",
    carrier: "fedex",
    evidence: "context",
    rank: 45,
    lengths: [18],
    match(s) {
      // Per tracking_number_data: the check covers only the 15 digits after the 2-digit container type.
      const m = /^[0-9]{2}([0-9]{15})([0-9])$/.exec(s);
      if (!m) return null;
      return { valid: ok(m[2], mod10CheckDigit(m[1], 3, 1)), format: "FedEx Ground SSCC-18" };
    },
  },
  {
    id: "fedex_ground_economy_20",
    carrier: "fedex",
    evidence: "context",
    rank: 55,
    lengths: [20],
    match(s) {
      // FedEx Ground Economy (SmartPost) prints a USPS IMpb without its "92" AI:
      // service code (3) + 9-digit MID starting with 9 + serial (7) + check. The
      // check digit is the IMpb one, computed with the "92" in place (real FedEx
      // email fixture 61299998820821171811 validates only this way).
      if (!/^[0-9]{3}9[0-9]{16}$/.test(s)) return null;
      const [serial, check] = body(s);
      return { valid: ok(check, uspsCheckDigit(`92${serial}`)), format: "FedEx Ground Economy (20 digits)" };
    },
  },
  {
    id: "dhl_express",
    carrier: "dhl",
    evidence: "context",
    rank: 40,
    lengths: [10, 11],
    match(s) {
      const m = /^([0-9]{9,10})([0-9])$/.exec(s);
      if (!m) return null;
      return { valid: ok(m[2], mod7CheckDigit(m[1])), format: `DHL Express (${s.length} digits)` };
    },
  },
  {
    id: "dhl_piece_id",
    carrier: "dhl",
    evidence: "context",
    rank: 40,
    lengths: [12, 13, 14],
    match: (s) => (/^J[A-Z]{2,3}[0-9]{9,10}$/.test(s) ? { valid: null, format: "DHL Express piece ID" } : null),
  },
  {
    id: "dhl_ecommerce",
    carrier: "dhl_ecommerce",
    evidence: "context",
    rank: 35,
    lengths: range(12, 41),
    match: (s) =>
      /^(?:GM|LX|RX|UV|CN|SG|TH|IN|HK|MY)[0-9][0-9A-Z]{9,38}$/.test(s)
        ? { valid: null, format: "DHL eCommerce" }
        : null,
  },
  {
    id: "dhl_ecommerce_14",
    carrier: "dhl_ecommerce",
    evidence: "carrier",
    generic: true,
    rank: 10,
    lengths: [14],
    match: (s) => (/^[0-9]{14}$/.test(s) ? { valid: null, format: "DHL eCommerce (14 digits)" } : null),
  },
  {
    id: "amazon_tba",
    carrier: "amazon",
    evidence: "distinctive",
    rank: 90,
    lengths: [15],
    match: (s) => (/^TB[ACM][0-9]{12}$/.test(s) ? { valid: null, format: "Amazon Logistics (TBA)" } : null),
  },
  {
    id: "amazon_international",
    carrier: "amazon",
    evidence: "carrier",
    rank: 20,
    lengths: [11],
    match: (s) => (/^[AFC][0-9]{10}$/.test(s) ? { valid: null, format: "Amazon international" } : null),
  },
  {
    id: "ontrac_cd",
    carrier: "ontrac",
    evidence: "distinctive",
    rank: 90,
    lengths: [15],
    match(s) {
      const m = /^([CD])([0-9]{13})([0-9])$/.exec(s);
      if (!m) return null;
      // tracking_number_data: prepend 4 (C) / 5 (D) unless the serial already starts with it.
      const lead = m[1] === "C" ? "4" : "5";
      const serial = m[2].startsWith(lead) ? m[2] : lead + m[2];
      return { valid: ok(m[3], mod10CheckDigit(serial, 1, 2)), format: `OnTrac ${m[1]}` };
    },
  },
  {
    id: "lasership_lx",
    carrier: "ontrac",
    evidence: "distinctive",
    rank: 80,
    lengths: [10],
    match: (s) => (/^L[AIEHNX][1-3][0-9]{7}$/.test(s) ? { valid: null, format: "LaserShip L" } : null),
  },
  {
    id: "lasership_1ls7",
    carrier: "ontrac",
    evidence: "distinctive",
    rank: 85,
    lengths: [15],
    match: (s) => (/^1LS7[12][0-9]{10}$/.test(s) ? { valid: null, format: "LaserShip 1LS7 (15)" } : null),
  },
  {
    id: "lasership_1ls7_18",
    carrier: "ontrac",
    evidence: "distinctive",
    rank: 85,
    lengths: [17],
    // Printed as 1LS7xxxxxxxxxxxx-1; normalization drops the dash.
    match: (s) => (/^1LS7[12][0-9]{2}01[1-4][0-9]{6}1$/.test(s) ? { valid: null, format: "LaserShip 1LS7 (18)" } : null),
  },
  {
    id: "lasership_1lscx",
    carrier: "ontrac",
    evidence: "distinctive",
    rank: 85,
    lengths: [15],
    match: (s) => (/^1LSCX[0-9A-Z]{10}$/.test(s) ? { valid: null, format: "LaserShip 1LSCX" } : null),
  },
];

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

// ---------------------------------------------------------------------------
// Worldwide (research/worldwide/tracking-formats-intl.md). The research's
// tiers map to evidence: Tier A (distinctive prefix or shape, plus a check
// digit where one exists) -> "distinctive"; Tier B (bare digits with a check
// digit) -> "named" ("context" where the prefix narrows it); Tier C (generic
// shape, no check digit) -> "carrier".
// ---------------------------------------------------------------------------

const ALL_DIGITS_RE = /^[0-9]+$/;

type FormatName = string | ((s: string) => string);

function nameOf(format: FormatName, s: string): string {
  return typeof format === "string" ? format : format(s);
}

/** All-digit format; `check` computes the last digit from the others (null = no check digit). */
function digitsFormat(
  id: FormatId,
  carrier: CarrierId,
  evidence: Evidence,
  rank: number,
  lengths: readonly number[],
  format: FormatName,
  check: ((serial: string) => number) | null,
  prefix?: RegExp,
): FormatDef {
  return {
    id,
    carrier,
    evidence,
    generic: check === null,
    rank,
    lengths,
    match(s) {
      if (!ALL_DIGITS_RE.test(s) || (prefix && !prefix.test(s))) return null;
      if (!check) return { valid: null, format: nameOf(format, s) };
      const [serial, c] = body(s);
      return { valid: ok(c, check(serial)), format: nameOf(format, s) };
    },
  };
}

/** A shape with no check digit. */
function shapeFormat(
  id: FormatId,
  carrier: CarrierId,
  evidence: Evidence,
  rank: number,
  lengths: readonly number[],
  re: RegExp,
  format: string,
  originCountry?: string,
): FormatDef {
  return {
    id,
    carrier,
    evidence,
    rank,
    lengths,
    match: (s) => (re.test(s) ? { valid: null, format, ...(originCountry ? { originCountry } : {}) } : null),
  };
}

/** 15 characters checked with ISO/IEC 7064 MOD 37,36 (DPD and La Poste/Chronopost on the same network). */
function iso15(s: string, re: RegExp, format: string): Shape | null {
  if (!re.test(s)) return null;
  const [serial, check] = body(s);
  return { valid: check === iso7064Mod3736CheckChar(serial), format };
}

function correos(s: string, re: RegExp, format: string): Shape | null {
  if (!re.test(s)) return null;
  const [serial, check] = body(s);
  return { valid: check === correosCheckLetter(serial), format };
}

const INTL_FORMATS: readonly FormatDef[] = [
  // DHL Paket / Deutsche Post (Germany)
  {
    id: "dhl_paket_sscc",
    carrier: "dhl_paket",
    evidence: "distinctive",
    rank: 92,
    lengths: [20],
    match(s) {
      if (!/^0034043[3-5][0-9]{12}$/.test(s)) return null;
      const [serial, check] = body(s);
      return { valid: ok(check, gs1CheckDigit(serial)), format: "DHL Paket NVE/SSCC (20 digits)" };
    },
  },
  shapeFormat("dhl_paket_jjd", "dhl_paket", "distinctive", 80, range(21, 27), /^JJD[0-9]{18,24}$/, "DHL Paket licence plate (JJD)"),
  shapeFormat("dhl_paket_jd", "dhl_paket", "distinctive", 75, [20], /^JD[0-9]{18}$/, "DHL Paket licence plate (JD)"),
  // J(J)D + 16 digits is used by DHL and by InPost UK (formerly Yodel): only the sender, link or name can tell.
  shapeFormat("dhl_paket_jjd16", "dhl_paket", "named", 30, [18, 19], /^J?JD[0-9]{16}$/, "DHL licence plate (JJD, 16 digits)"),
  shapeFormat("inpost_jjd16", "inpost", "named", 29, [18, 19], /^J?JD[0-9]{16}$/, "InPost UK (JJD, 16 digits)"),
  digitsFormat("dhl_paket_identcode", "dhl_paket", "named", 42, [12], "DHL Paket Identcode (12 digits)", identcodeCheckDigit),
  // DHL eCommerce
  shapeFormat("dhl_ecommerce_gm", "dhl_ecommerce", "distinctive", 70, [18, 19, 20], /^GM[0-9]{16,18}$/, "DHL eCommerce"),
  shapeFormat("dhl_ecommerce_jvgl", "dhl_ecommerce", "distinctive", 70, range(12, 30), /^JVGL[0-9][0-9A-Z]{7,25}$/, "DHL eCommerce (JVGL)"),
  // Hermes (Germany) and Evri (UK, formerly Hermes UK)
  shapeFormat("hermes_h20", "hermes", "distinctive", 70, [20], /^H[0-9]{19}$/, "Hermes (H + 19 digits)"),
  digitsFormat("hermes_14", "hermes", "named", 40, [14], "Hermes (14 digits)", gs1CheckDigit),
  {
    id: "evri_16",
    carrier: "evri",
    evidence: "distinctive",
    rank: 80,
    lengths: [16],
    match(s) {
      if (!/^[HT][0-9A-Z]{5}[0-9]{10}$/.test(s)) return null;
      const [serial, check] = body(s);
      return { valid: ok(check, evriCheckDigit(serial)), format: "Evri (16 characters)" };
    },
  },
  digitsFormat("evri_numeric_16", "evri", "carrier", 5, [16], "Evri (16 digits)", null),
  // Royal Mail domestic (S10 numbers are handled by "s10") and Parcelforce
  shapeFormat("parcelforce_pb", "parcelforce", "distinctive", 70, [14], /^PB[A-Z]{2}[0-9]{10}$/, "Parcelforce (PB)"),
  shapeFormat(
    "royal_mail_2d",
    "royal_mail",
    "carrier",
    5,
    [21],
    /^(?:32[0-9]{11}[A-F0-9]{8}|(?=[A-F0-9]*[A-F])[A-F0-9]{2}[0-9]{7}[A-F0-9]{12})$/,
    "Royal Mail (2D barcode reference)",
  ),
  // DPD (Geopost), Chronopost and La Poste share the 14 + ISO 7064 check character layout.
  {
    id: "dpd_15_letter",
    carrier: "dpd",
    evidence: "distinctive",
    rank: 60,
    lengths: [15],
    match: (s) => iso15(s, /^[0-9]{14}[A-Z]$/, "DPD (14 digits + check character)"),
  },
  {
    id: "dpd_15_digit",
    carrier: "dpd",
    evidence: "named",
    rank: 38,
    lengths: [15],
    match: (s) => iso15(s, /^[0-9]{15}$/, "DPD (14 digits + check character)"),
  },
  {
    id: "chronopost_15",
    carrier: "chronopost",
    evidence: "named",
    rank: 37,
    lengths: [15],
    match: (s) => iso15(s, /^[0-9]{14}[0-9A-Z]$/, "Chronopost (14 digits + check character)"),
  },
  {
    id: "la_poste_15",
    carrier: "la_poste",
    evidence: "distinctive",
    rank: 75,
    lengths: [15],
    match: (s) => iso15(s, /^(?:86[56]|87[05]|88[05])[0-9]{11}[0-9A-Z]$/, "La Poste (15 characters)"),
  },
  digitsFormat("dpd_14", "dpd", "carrier", 8, [14], "DPD (14 digits)", null),
  // DPD France 250... numbers have no ISO 7064 character (4 of 4 real numbers fail it).
  shapeFormat("dpd_fr_250", "dpd", "carrier", 9, [15, 16], /^250[0-9]{12,13}$/, "DPD France (250...)"),
  shapeFormat("dpd_pl", "dpd", "named", 20, [14], /^[0-9]{13}U$/, "DPD Poland (13 digits + U)"),
  // GLS
  digitsFormat("gls_12", "gls", "named", 41, [12], "GLS (12 digits)", glsCheckDigit),
  digitsFormat("gls_11", "gls", "carrier", 6, [11], "GLS (11 digits)", null),
  shapeFormat("gls_track_id", "gls", "carrier", 5, [8], /^(?=[A-Z]*[0-9])(?=[0-9]*[A-Z])[A-Z0-9]{8}$/, "GLS Track ID"),
  // Benelux
  shapeFormat("postnl_3s", "postnl", "distinctive", 80, [13, 15], /^3S[A-Z]{1,4}[0-9]{6,11}$/, "PostNL (3S)"),
  shapeFormat("bpost_32", "bpost", "carrier", 6, [18, 24], /^32(?:32|99)[0-9]{14}(?:[0-9]{6})?$/, "bpost (18 or 24 digits)"),
  // France
  {
    id: "colissimo_13",
    carrier: "la_poste",
    evidence: "distinctive",
    rank: 80,
    lengths: [13],
    match(s) {
      if (!/^(?:[1-36-9][A-Z]|5[N-Z])[0-9]{11}$/.test(s)) return null;
      // Key = GS1 over the 10 digits after the 2-character product code.
      return { valid: ok(s[12], gs1CheckDigit(s.slice(2, 12))), format: "Colissimo (13 characters)" };
    },
  },
  // Switzerland, Austria
  shapeFormat("swiss_post_18", "swiss_post", "carrier", 6, [18], /^99[0-9]{16}$/, "Swiss Post (18 digits)"),
  digitsFormat("austrian_post_22", "austrian_post", "carrier", 3, [22], "Austrian Post (22 digits)", null),
  // Spain (check letter), Italy
  {
    id: "correos_23",
    carrier: "correos",
    evidence: "distinctive",
    rank: 80,
    lengths: [23],
    match: (s) => correos(s, /^(?:[PD][A-Z]|CD)[A-Z0-9]{4}[0-9]{16}[A-Z]$/, "Correos (23 characters)"),
  },
  {
    id: "correos_16",
    carrier: "correos",
    evidence: "distinctive",
    rank: 80,
    lengths: [16],
    match: (s) => correos(s, /^[PD][A-Z][A-Z0-9]{4}[0-9]{9}[A-Z]$/, "Correos (16 characters)"),
  },
  shapeFormat("correos_pr", "correos", "distinctive", 70, [18], /^PR[0-9]{15}C$/, "Correos (PR)"),
  // "RA" + digits is also a common return-authorization shape, so it needs Poste Italiane named.
  shapeFormat("poste_ra", "poste_italiane", "named", 20, [13], /^RA[0-9]{11}$/, "Poste Italiane (RA)"),
  shapeFormat("poste_uw", "poste_italiane", "distinctive", 60, [13], /^[13]UW(?=(?:[A-Z]*[0-9]){6})[0-9A-Z]{10}$/, "Poste Italiane (UW)"),
  shapeFormat("poste_2ima", "poste_italiane", "distinctive", 60, [14], /^2IMA[0-9]{10}$/, "Poste Italiane (2IMA)"),
  // One real sample (5P65D73186819); a letter after "5P" keeps it apart from Colissimo 5P + 11 digits.
  shapeFormat(
    "poste_5p",
    "poste_italiane",
    "context",
    30,
    [13],
    /^5P(?=[0-9]*[A-Z])(?=(?:[A-Z]*[0-9]){6})[0-9A-Z]{11}$/,
    "Poste Italiane (5P)",
  ),
  // Poland, Czechia
  digitsFormat("inpost_24", "inpost", "carrier", 10, [24], "InPost (24 digits)", null),
  shapeFormat("poczta_px", "poczta_polska", "carrier", 6, [12], /^PX[0-9]{10}$/, "Poczta Polska (PX)"),
  digitsFormat("poczta_20", "poczta_polska", "carrier", 3, [20], "Poczta Polska (20 digits)", null),
  shapeFormat("packeta_z", "packeta", "carrier", 6, [11], /^Z[0-9]{10}$/, "Packeta (Z)"),
  digitsFormat("packeta_10", "packeta", "carrier", 3, [10], "Packeta (10 digits)", null),
  // Nordics (SSCCs: GS1 company prefix + serial, "00" application identifier)
  shapeFormat("postnord_se11", "postnord", "distinctive", 70, [13], /^[0-9]{11}SE$/, "PostNord (11 digits + SE)", "SE"),
  digitsFormat("postnord_sscc", "postnord", "named", 38, [20], "SSCC (20 digits)", gs1CheckDigit, /^00/),
  digitsFormat("bring_sscc", "posten_bring", "named", 37, [20], "SSCC (20 digits)", gs1CheckDigit, /^00/),
  digitsFormat("bring_37", "posten_bring", "named", 38, [18], "Bring (18 digits)", gs1CheckDigit, /^37[03]/),
  digitsFormat("bring_70", "posten_bring", "named", 38, [17], "Bring (17 digits)", gs1CheckDigit, /^70/),
  shapeFormat("posti_jjfi", "posti", "distinctive", 75, [21], /^JJFI[0-9]{17}$/, "Posti (JJFI)"),
  digitsFormat("posti_sscc", "posti", "named", 36, [20], "SSCC (20 digits)", gs1CheckDigit, /^00/),
  // Australia (domestic article IDs have no public specification)
  shapeFormat(
    "australia_post_domestic",
    "australia_post",
    "carrier",
    4,
    [20, 21, 22, 23],
    /^[0-9][0-9A-Z]{0,4}[0-9]{16,22}$/,
    "Australia Post (domestic)",
  ),
  // Japan: Japan Post, Yamato and Sagawa share the "7DR" check (number mod 7).
  digitsFormat("japan_post_12", "japan_post", "named", 36, [12], "Japan Post (12 digits)", mod7CheckDigit),
  digitsFormat("japan_post_11", "japan_post", "named", 36, [11], "Japan Post (11 digits)", mod7CheckDigit),
  digitsFormat("yamato_12", "yamato", "named", 37, [12], "Yamato (12 digits)", mod7CheckDigit),
  digitsFormat("sagawa_12", "sagawa", "named", 35, [12], "Sagawa (12 digits)", mod7CheckDigit),
  digitsFormat("korea_post_13", "korea_post", "carrier", 5, [13], "Korea Post (13 digits)", null),
  // China
  {
    id: "sf_express_sf",
    carrier: "sf_express",
    evidence: "distinctive",
    rank: 85,
    lengths: [15],
    match(s) {
      if (!/^SF[0-9]{13}$/.test(s)) return null;
      return { valid: ok(s[14], sfCheckDigit(s.slice(2))), format: "SF Express (SF)" };
    },
  },
  {
    id: "sf_express_12",
    carrier: "sf_express",
    evidence: "named",
    rank: 34,
    lengths: [12],
    match(s) {
      if (!ALL_DIGITS_RE.test(s)) return null;
      return { valid: ok(s[11], sfCheckDigit(s)), format: "SF Express (12 digits)" };
    },
  },
  shapeFormat("cainiao_lp", "cainiao", "distinctive", 70, [16], /^LP[0-9]{14}$/, "Cainiao (LP)"),
  shapeFormat("cainiao_cng", "cainiao", "distinctive", 70, [17], /^CNG[0-9]{14}$/, "Cainiao (CNG)"),
  shapeFormat("cainiao_dofr", "cainiao", "distinctive", 70, [19], /^DOFR[0-9]{13}HD$/, "Cainiao (DOFR)"),
  shapeFormat("yunexpress_yt", "yunexpress", "distinctive", 70, [18], /^YT[0-9]{16}$/, "YunExpress (YT)"),
  shapeFormat("fourpx", "fourpx", "distinctive", 75, [18], /^4PX[0-9]{13}CN$/, "4PX", "CN"),
  shapeFormat("yanwen_bys", "yanwen", "context", 30, [12], /^BYS[0-9]{9}$/, "Yanwen (BYS)"),
  // Canada, Mexico
  digitsFormat("canada_post_16", "canada_post", "named", 40, [16], "Canada Post (16 digits)", gs1CheckDigit),
  digitsFormat("purolator_12", "purolator", "named", 39, [12], "Purolator (12 digits)", luhnCheckDigit, /^[0-5]/),
  shapeFormat("purolator_alpha", "purolator", "carrier", 8, [12], /^(?!BYS|LTN)[A-Z]{3}[0-9]{9}$/, "Purolator (3 letters + 9 digits)"),
  shapeFormat(
    "estafeta_22_lettered",
    "estafeta",
    "distinctive",
    70,
    [22],
    /^[0-9]{12}(?:[A-Z][0-9]|[0-9][A-Z])[0-9]{8}$/,
    "Estafeta (22 characters)",
  ),
  digitsFormat("estafeta_22", "estafeta", "carrier", 4, [22], "Estafeta (22 digits)", null),
  digitsFormat("estafeta_10", "estafeta", "carrier", 4, [10], "Estafeta (10 digits)", null),
  // India, Middle East
  digitsFormat("delhivery", "delhivery", "carrier", 7, [13, 14], (s) => `Delhivery (${s.length} digits)`, null),
  digitsFormat("blue_dart_11", "blue_dart", "named", 33, [11], "Blue Dart (11 digits)", mod7CheckDigit),
  digitsFormat("aramex", "aramex", "named", 33, [10, 11], (s) => `Aramex (${s.length} digits)`, mod7CheckDigit),
  // Amazon Europe: country code + 10 digits. Only UK, DE and FR are evidenced; BE and PL
  // would collide with VAT numbers. Needs Amazon named, hinted or linked.
  shapeFormat("amazon_eu", "amazon", "named", 25, [12], /^(?:UK|DE|FR)[0-9]{10}$/, "Amazon (EU)"),
];

/** No-check-digit shapes that are just digits behind a short numeric prefix. */
const GENERIC_SHAPES: ReadonlySet<FormatId> = new Set<FormatId>(["dpd_fr_250", "bpost_32", "swiss_post_18", "australia_post_domestic"]);

const ALL_FORMATS: readonly FormatDef[] = [...FORMATS, ...INTL_FORMATS].map((def) =>
  GENERIC_SHAPES.has(def.id) ? { ...def, generic: true } : def,
);

/** Formats by normalized length, in definition order. */
const BY_LENGTH: ReadonlyMap<number, readonly FormatDef[]> = (() => {
  const map = new Map<number, FormatDef[]>();
  for (const def of ALL_FORMATS) {
    for (const len of def.lengths) {
      const list = map.get(len) ?? [];
      list.push(def);
      map.set(len, list);
    }
  }
  return map;
})();

/** Every normalized length some format can have. */
export const CANDIDATE_LENGTHS: ReadonlySet<number> = new Set(BY_LENGTH.keys());

/** Longest normalized tracking number any format accepts. */
export const MAX_CANDIDATE_LENGTH = Math.max(...CANDIDATE_LENGTHS);

/** One character repeated ("111111111111", "000000000000000"): only passes check digits by accident. */
export function isRepeatedChar(s: string): boolean {
  for (let i = 1; i < s.length; i++) if (s[i] !== s[0]) return false;
  return true;
}

function validityScore(valid: boolean | null): number {
  if (valid === true) return 2;
  if (valid === null) return 1;
  return 0;
}

/** Formats that only mean something next to their carrier's name, hint or link. */
function isWeak(m: FormatMatch): boolean {
  return m.evidence === "named" || m.generic;
}

export interface DetectOptions {
  /** Skip formats that need context (for candidates that can only be accepted on their own). */
  distinctiveOnly?: boolean;
}

/**
 * Every format that `s` matches, best first: readings that stand on their own
 * before context-only ones (`named` and generic formats, which random numbers
 * and other carriers' typos often fit); then a validating check digit before
 * no check digit before a failing one; then the more specific format. `s`
 * must already be normalized. Numbers made of one repeated character never match.
 */
export function detectAllNormalized(s: string, opts: DetectOptions = {}): FormatMatch[] {
  const defs = BY_LENGTH.get(s.length);
  if (!defs || !/^[A-Z0-9]+$/.test(s) || isRepeatedChar(s)) return [];
  const ranked: { match: FormatMatch; rank: number }[] = [];
  for (const def of defs) {
    if (opts.distinctiveOnly && def.evidence !== "distinctive") continue;
    const shape = def.match(s);
    if (!shape) continue;
    const match: FormatMatch = {
      trackingNumber: shape.trackingNumber ?? s,
      carrier: shape.carrier ?? def.carrier,
      format: shape.format,
      checksumValid: shape.valid,
      formatId: def.id,
      evidence: def.evidence,
      generic: def.generic === true,
    };
    if (shape.originCountry) match.originCountry = shape.originCountry;
    ranked.push({ rank: def.rank, match });
  }
  ranked.sort(
    (a, b) =>
      Number(isWeak(a.match)) - Number(isWeak(b.match)) ||
      validityScore(b.match.checksumValid) - validityScore(a.match.checksumValid) ||
      b.rank - a.rank,
  );
  return ranked.map((r) => r.match);
}

export interface DetectTrackingOptions {
  /** Carrier the number is known to come from; its formats (and its sister companies') win. */
  carrierHint?: CarrierId;
}

/**
 * Classify one candidate tracking number (any spacing/case). Returns the most
 * specific matching format, or null when nothing matches. A format with a
 * check digit that fails is still returned (`checksumValid: false`) when no
 * better reading exists, so callers can tell "typo" from "not a number".
 *
 * USPS numbers scanned with the `420` + ZIP routing prefix are returned as the
 * PIC (the part USPS calls the tracking number). Many all-digit formats are
 * shared by carriers worldwide: without `carrierHint`, shapes that are just
 * "N digits" (InPost 24, Delhivery 13/14, ...) are not reported, and formats
 * that need their carrier named (GLS 12, Yamato 12, ...) only when their check
 * digit passes and nothing else fits; with it, the hinted carrier's formats
 * come first.
 */
export function detectTrackingNumber(raw: string, opts: DetectTrackingOptions = {}): DetectedTrackingNumber | null {
  const all = detectAllNormalized(normalizeTrackingNumber(raw));
  const hint = opts.carrierHint && opts.carrierHint !== "unknown" ? opts.carrierHint : null;
  const hinted = (m: FormatMatch) => (hint === null ? 0 : m.carrier === hint ? 2 : sameFamily(m.carrier, hint) ? 1 : 0);
  const best = all
    // Unhinted, a context-only format is no answer on its own, and failing one is no sign of a typo.
    .filter((m) => hinted(m) > 0 || !(m.generic || (isWeak(m) && m.checksumValid === false)))
    .map((m, i) => ({ m, i }))
    .sort((a, b) => hinted(b.m) - hinted(a.m) || a.i - b.i)[0];
  return best ? toPublic(best.m) : null;
}

/** Strips internal fields from a match. */
export function toPublic(m: FormatMatch): DetectedTrackingNumber {
  const out: DetectedTrackingNumber = {
    trackingNumber: m.trackingNumber,
    carrier: m.carrier,
    format: m.format,
    checksumValid: m.checksumValid,
  };
  if (m.originCountry) out.originCountry = m.originCountry;
  return out;
}
