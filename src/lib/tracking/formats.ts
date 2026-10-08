import type { CarrierId, DetectedTrackingNumber } from "@/lib/types";
import {
  mod10CheckDigit,
  mod7CheckDigit,
  s10CheckDigit,
  uspsCheckDigit,
  weightedMod11CheckDigit,
} from "./checksums";
import { normalizeTrackingNumber } from "./normalize";

/**
 * Tracking-number formats, from jkeen/tracking_number_data v2.0.0 and USPS
 * Publication 199 v35 (see research/tracking_numbers.md). Only carriers that
 * exist in `CarrierId` are covered; LaserShip is OnTrac, and UPU S10
 * international mail is reported as USPS (USPS delivers and tracks inbound
 * S10 items in the US).
 */

/**
 * How much surrounding evidence `findTrackingNumbers` needs before it trusts a
 * match in free text.
 * - `distinctive`: a prefix, length and/or check digit make accidental matches unlikely.
 * - `context`: short or all-digit; needs a tracking link, a carrier hint or a nearby keyword.
 * - `carrier`: generic shape and no check digit; needs that carrier (hint, link or name)
 *   *and* a tracking keyword or link.
 */
export type Evidence = "distinctive" | "context" | "carrier";

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
  | "dhl_ecommerce_14"
  | "amazon_tba"
  | "amazon_international"
  | "ontrac_cd"
  | "lasership_lx"
  | "lasership_1ls7"
  | "lasership_1ls7_18"
  | "lasership_1lscx";

/** A detection plus the internal facts the extractor needs. */
export interface FormatMatch extends DetectedTrackingNumber {
  formatId: FormatId;
  evidence: Evidence;
}

interface Shape {
  /** null = the format has no check digit. */
  valid: boolean | null;
  format: string;
  /** Canonical number when it differs from the input (USPS: PIC without 420+ZIP). */
  trackingNumber?: string;
}

interface FormatDef {
  id: FormatId;
  carrier: CarrierId;
  evidence: Evidence;
  /** Higher = more specific; breaks ties between formats that both match. */
  rank: number;
  /** Returns null when `s` (normalized) does not have this format's shape. */
  match: (s: string) => Shape | null;
}

const FEDEX_12_WEIGHTS = [3, 1, 7, 3, 1, 7, 3, 1, 7, 3, 1] as const;
const FEDEX_34_WEIGHTS = [1, 7, 3, 1, 7, 3, 1, 7, 3, 1, 7, 3, 1] as const;

/** Countries accepted in the S10 suffix (the 191 "Courier" entries of tracking_number_data s10.json). */
const S10_COUNTRIES = new Set(
  (
    "AF AL DZ AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI KH CM CA " +
    "CV CF TD CL CN HK CO KM CG CR HR CU CY CZ CI KP CD DK DJ DM DO EC EG SV GQ ER EE ET FJ FI " +
    "FR GA GM GE DE GH GB GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI " +
    "KR KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MR MU MX MD MC MN ME MA MZ MM NA NR " +
    "NP NL NZ NI NE NG NO OM PK PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC " +
    "SL SG SK SI SB SO ZA SS ES LK SD SR SZ SE CH SY TJ TZ TH MK TL TG TO TT TN TR TM TV UG UA " +
    "AE US UY UZ VU VA VE VN YE ZM ZW"
  ).split(" "),
);

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
 * Ways to read `s` as [optional 420 + ZIP routing prefix] + PIC. A PIC always
 * starts with 9 (or is a bare 20-digit legacy number), so a leading "420" is
 * always routing. Order mirrors the reference regex (ZIP+4 tried first).
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
    carrier: "usps",
    evidence: "distinctive",
    rank: 90,
    match(s) {
      const m = /^[A-Z]{2}([0-9]{8})([0-9])([A-Z]{2})$/.exec(s);
      if (!m || !S10_COUNTRIES.has(m[3])) return null;
      return { valid: ok(m[2], s10CheckDigit(m[1])), format: "UPU S10 international mail" };
    },
  },
  {
    id: "fedex_12",
    carrier: "fedex",
    evidence: "context",
    rank: 50,
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
    match: (s) => (/^J[A-Z]{2,3}[0-9]{9,10}$/.test(s) ? { valid: null, format: "DHL Express piece ID" } : null),
  },
  {
    id: "dhl_ecommerce",
    carrier: "dhl",
    evidence: "context",
    rank: 35,
    match: (s) =>
      /^(?:GM|LX|RX|UV|CN|SG|TH|IN|HK|MY)[0-9][0-9A-Z]{9,38}$/.test(s)
        ? { valid: null, format: "DHL eCommerce" }
        : null,
  },
  {
    id: "dhl_ecommerce_14",
    carrier: "dhl",
    evidence: "carrier",
    rank: 10,
    match: (s) => (/^[0-9]{14}$/.test(s) ? { valid: null, format: "DHL eCommerce (14 digits)" } : null),
  },
  {
    id: "amazon_tba",
    carrier: "amazon",
    evidence: "distinctive",
    rank: 90,
    match: (s) => (/^TB[ACM][0-9]{12}$/.test(s) ? { valid: null, format: "Amazon Logistics (TBA)" } : null),
  },
  {
    id: "amazon_international",
    carrier: "amazon",
    evidence: "carrier",
    rank: 20,
    match: (s) => (/^[AFC][0-9]{10}$/.test(s) ? { valid: null, format: "Amazon international" } : null),
  },
  {
    id: "ontrac_cd",
    carrier: "ontrac",
    evidence: "distinctive",
    rank: 90,
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
    match: (s) => (/^L[AIEHNX][1-3][0-9]{7}$/.test(s) ? { valid: null, format: "LaserShip L" } : null),
  },
  {
    id: "lasership_1ls7",
    carrier: "ontrac",
    evidence: "distinctive",
    rank: 85,
    match: (s) => (/^1LS7[12][0-9]{10}$/.test(s) ? { valid: null, format: "LaserShip 1LS7 (15)" } : null),
  },
  {
    id: "lasership_1ls7_18",
    carrier: "ontrac",
    evidence: "distinctive",
    rank: 85,
    // Printed as 1LS7xxxxxxxxxxxx-1; normalization drops the dash.
    match: (s) => (/^1LS7[12][0-9]{2}01[1-4][0-9]{6}1$/.test(s) ? { valid: null, format: "LaserShip 1LS7 (18)" } : null),
  },
  {
    id: "lasership_1lscx",
    carrier: "ontrac",
    evidence: "distinctive",
    rank: 85,
    match: (s) => (/^1LSCX[0-9A-Z]{10}$/.test(s) ? { valid: null, format: "LaserShip 1LSCX" } : null),
  },
];

function validityScore(valid: boolean | null): number {
  if (valid === true) return 2;
  if (valid === null) return 1;
  return 0;
}

/**
 * Every format that `s` matches, best first: a validating check digit beats
 * no check digit, which beats a failing one; then the more specific format.
 * `s` must already be normalized.
 */
export function detectAllNormalized(s: string): FormatMatch[] {
  if (s.length < 10 || s.length > 41 || !/^[A-Z0-9]+$/.test(s)) return [];
  const ranked: { match: FormatMatch; rank: number }[] = [];
  for (const def of FORMATS) {
    const shape = def.match(s);
    if (!shape) continue;
    ranked.push({
      rank: def.rank,
      match: {
        trackingNumber: shape.trackingNumber ?? s,
        carrier: def.carrier,
        format: shape.format,
        checksumValid: shape.valid,
        formatId: def.id,
        evidence: def.evidence,
      },
    });
  }
  ranked.sort(
    (a, b) =>
      validityScore(b.match.checksumValid) - validityScore(a.match.checksumValid) || b.rank - a.rank,
  );
  return ranked.map((r) => r.match);
}

/**
 * Classify one candidate tracking number (any spacing/case). Returns the most
 * specific matching format, or null when nothing matches. A format with a
 * check digit that fails is still returned (`checksumValid: false`) when no
 * better reading exists, so callers can tell "typo" from "not a number".
 *
 * USPS numbers scanned with the `420` + ZIP routing prefix are returned as the
 * PIC (the part USPS calls the tracking number).
 */
export function detectTrackingNumber(raw: string): DetectedTrackingNumber | null {
  const best = detectAllNormalized(normalizeTrackingNumber(raw))[0];
  if (!best) return null;
  return toPublic(best);
}

/** Strips internal fields from a match. */
export function toPublic(m: FormatMatch): DetectedTrackingNumber {
  return {
    trackingNumber: m.trackingNumber,
    carrier: m.carrier,
    format: m.format,
    checksumValid: m.checksumValid,
  };
}
