/** Country code used for "somewhere not in the list" (ISO 3166-1 user-assigned code). */
export const OTHER_COUNTRY_CODE = "ZZ";

/**
 * Every officially assigned ISO 3166-1 alpha-2 code (249), plus XK for Kosovo:
 * a user-assigned code that carriers, CLDR and most software use, so people
 * living there can pick it.
 */
const COUNTRY_CODES: readonly string[] = `
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
DE DJ DK DM DO DZ
EC EE EG EH ER ES ET
FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
HK HM HN HR HT HU
ID IE IL IM IN IO IQ IR IS IT
JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ
LA LB LC LI LK LR LS LT LU LV LY
MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
NA NC NE NF NG NI NL NO NP NR NU NZ
OM
PA PE PF PG PH PK PL PM PN PR PS PT PW PY
QA
RE RO RS RU RW
SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
UA UG UM US UY UZ
VA VC VE VG VI VN VU
WF WS
XK
YE YT
ZA ZM ZW`
  .trim()
  .split(/\s+/);

/** English display names from the runtime's CLDR data; the code itself if Intl.DisplayNames is unavailable. */
function englishNames(codes: readonly string[]): Map<string, string> {
  const names = new Map<string, string>();
  let display: Intl.DisplayNames | null = null;
  try {
    display = new Intl.DisplayNames("en", { type: "region" });
  } catch {
    display = null;
  }
  for (const code of codes) {
    let name: string | undefined;
    try {
      name = display?.of(code);
    } catch {
      name = undefined;
    }
    names.set(code, name && name.trim() ? name : code);
  }
  return names;
}

const NAMES = englishNames(COUNTRY_CODES);

const collator = (() => {
  try {
    return new Intl.Collator("en", { sensitivity: "base" });
  } catch {
    return null;
  }
})();

/**
 * Every country and territory (ISO 3166-1 alpha-2) with its English name,
 * sorted by name, then "Other" (ZZ) at the end.
 *
 * Names come from Intl.DisplayNames, so they can differ slightly between
 * runtimes with different CLDR versions.
 */
export const COUNTRIES: { code: string; name: string }[] = [
  ...COUNTRY_CODES.map((code) => ({ code, name: NAMES.get(code) ?? code })).sort((a, b) =>
    collator ? collator.compare(a.name, b.name) : a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  ),
  { code: OTHER_COUNTRY_CODE, name: "Other" },
];

/** Every real country / territory code in COUNTRIES (everything except "Other"). */
export const SUPPORTED_COUNTRY_CODES: ReadonlySet<string> = new Set(COUNTRY_CODES);

/**
 * US territories and Freely Associated States that USPS serves with US ZIP
 * codes. People there may pick either "United States" or the territory itself.
 */
export const USPS_SERVED_COUNTRY_CODES: ReadonlySet<string> = new Set(["AS", "FM", "GU", "MH", "MP", "PR", "PW", "VI"]);

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

/** True for a code in COUNTRIES other than "Other" ("UK" and lowercase accepted). */
export function isCountryCode(input: string | null | undefined): boolean {
  const code = normalizeCountryCode(input);
  return code !== null && SUPPORTED_COUNTRY_CODES.has(code);
}

/**
 * English name for a country code, e.g. "de" -> "Germany", "ZZ" -> "Other".
 * Codes we don't list come back as the uppercase code itself (or the trimmed
 * input when it isn't a two-letter code), so this always returns something
 * printable.
 */
export function countryName(code: string): string {
  const normalized = normalizeCountryCode(code);
  if (normalized === OTHER_COUNTRY_CODE) return "Other";
  if (normalized && NAMES.has(normalized)) return NAMES.get(normalized) ?? normalized;
  return normalized ?? (typeof code === "string" ? code.trim() : "");
}

/**
 * The English name as it reads mid-sentence, with "the" where English uses it:
 * "the United States", "the Netherlands", "the Cayman Islands", but "Germany".
 */
export function countryNameInSentence(code: string): string {
  const name = countryName(code);
  return /^(?:United |Netherlands$|Philippines$|Bahamas$|Gambia$|Maldives$)|Republic$|Islands$/.test(name)
    ? `the ${name}`
    : name;
}
