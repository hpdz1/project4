import type { CarrierId } from "@/lib/types";
import { s10CheckDigit } from "./checksums";

/**
 * UPU S10 international mail numbers (e.g. RB123456785US): two service
 * letters, an 8-digit serial, a check digit and the ISO 3166-1 country of the
 * post that issued the number. About 200 postal operators use them; the
 * destination post usually tracks the same number.
 */

/**
 * Countries accepted in the S10 suffix: the 191 "Courier" entries of
 * tracking_number_data s10.json, plus postal operators that issue S10 numbers
 * under their own code without being in that list (Taiwan, Macao, the Crown
 * Dependencies, Gibraltar, the Faroes, Greenland, the Dutch Caribbean, French
 * Pacific posts, Bermuda, the Cayman Islands and the US Compact states).
 */
export const S10_COUNTRIES: ReadonlySet<string> = new Set(
  (
    "AF AL DZ AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI KH CM CA " +
    "CV CF TD CL CN HK CO KM CG CR HR CU CY CZ CI KP CD DK DJ DM DO EC EG SV GQ ER EE ET FJ FI " +
    "FR GA GM GE DE GH GB GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI " +
    "KR KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MR MU MX MD MC MN ME MA MZ MM NA NR " +
    "NP NL NZ NI NE NG NO OM PK PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC " +
    "SL SG SK SI SB SO ZA SS ES LK SD SR SZ SE CH SY TJ TZ TH MK TL TG TO TT TN TR TM TV UG UA " +
    "AE US UY UZ VU VA VE VN YE ZM ZW " +
    "TW MO JE GG IM GI FO GL AW CW SX NC PF BM KY MH FM PW"
  ).split(" "),
);

/**
 * Non-country suffixes seen on S10-shaped numbers (observed, not UPU
 * assignments): Yanwen uses YP with valid S10 check digits; Chronopost uses
 * JB, JF, TS and RV, and some real JB numbers fail the S10 check.
 */
const PSEUDO_SUFFIXES: Readonly<Record<string, { carrier: CarrierId; checkOptional: boolean }>> = {
  YP: { carrier: "yanwen", checkOptional: false },
  JB: { carrier: "chronopost", checkOptional: true },
  JF: { carrier: "chronopost", checkOptional: true },
  TS: { carrier: "chronopost", checkOptional: true },
  RV: { carrier: "chronopost", checkOptional: true },
};

/** The national post (or the carrier it hands parcels to) for each country we name. */
export const NATIONAL_POST: Readonly<Record<string, CarrierId>> = {
  US: "usps",
  GB: "royal_mail",
  CA: "canada_post",
  DE: "dhl_paket",
  NL: "postnl",
  BE: "bpost",
  FR: "la_poste",
  CH: "swiss_post",
  AT: "austrian_post",
  ES: "correos",
  IT: "poste_italiane",
  PT: "ctt",
  IE: "an_post",
  PL: "poczta_polska",
  SE: "postnord",
  DK: "postnord",
  NO: "posten_bring",
  FI: "posti",
  TR: "ptt",
  AU: "australia_post",
  NZ: "nz_post",
  JP: "japan_post",
  KR: "korea_post",
  CN: "china_post",
  HK: "hongkong_post",
  SG: "singpost",
  IN: "india_post",
  BR: "correios",
  AE: "emirates_post",
  IL: "israel_post",
};

/**
 * Carrier for an S10 number from its service letters and suffix. Within one
 * country the service letters sometimes name a sister company: Royal Mail
 * numbers starting E?, CP or GI are Parcelforce's, and La Poste numbers
 * starting X? or PZ are Chronopost's (the research's prefix table; the
 * corpus has Chronopost numbers in XA, XF, XS, XT, XU, XR, XW and XY).
 */
export function s10Carrier(service: string, suffix: string): CarrierId {
  const pseudo = PSEUDO_SUFFIXES[suffix];
  if (pseudo) return pseudo.carrier;
  if (suffix === "GB" && /^(?:E[A-Z]|CP|GI)$/.test(service)) return "parcelforce";
  if (suffix === "FR" && /^(?:X[A-Z]|PZ)$/.test(service)) return "chronopost";
  return NATIONAL_POST[suffix] ?? "intl_post";
}

export interface S10Number {
  service: string;
  serial: string;
  check: string;
  suffix: string;
  carrier: CarrierId;
  /** ISO country of the issuing post; null for pseudo-suffixes (YP, JB, ...). */
  country: string | null;
  /** null when the suffix's issuer does not reliably use the S10 check (Chronopost JB/JF/TS/RV) and it fails. */
  valid: boolean | null;
}

const S10_RE = /^([A-Z]{2})([0-9]{8})([0-9])([A-Z]{2})$/;

/** Parses a normalized S10 number, or returns null when `s` doesn't have the shape or a known suffix. */
export function parseS10(s: string): S10Number | null {
  const m = S10_RE.exec(s);
  if (!m) return null;
  const [, service, serial, check, suffix] = m;
  const pseudo = PSEUDO_SUFFIXES[suffix];
  if (!pseudo && !S10_COUNTRIES.has(suffix)) return null;
  const passes = check === String(s10CheckDigit(serial));
  return {
    service,
    serial,
    check,
    suffix,
    carrier: s10Carrier(service, suffix),
    country: pseudo ? null : suffix,
    valid: passes ? true : pseudo?.checkOptional ? null : false,
  };
}
