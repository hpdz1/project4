import { SUPPORTED_COUNTRY_CODES, normalizeCountryCode } from "./countries";

/**
 * IANA time zone -> the country it belongs to, from tzdata's zone.tab. Covers
 * every zone ID that Intl reports (CLDR canonical IDs such as "Asia/Calcutta",
 * as Chrome and Node return them) plus the current IANA spellings Firefox and
 * operating systems report ("Asia/Kolkata"). Europe/Simferopol is left out on
 * purpose: zone.tab lists it under two countries.
 */
const ZONES_BY_COUNTRY: Readonly<Record<string, string>> = {
  AD: "Europe/Andorra",
  AE: "Asia/Dubai",
  AF: "Asia/Kabul",
  AG: "America/Antigua",
  AI: "America/Anguilla",
  AL: "Europe/Tirane",
  AM: "Asia/Yerevan",
  AO: "Africa/Luanda",
  AQ: "Antarctica/Casey Antarctica/Davis Antarctica/DumontDUrville Antarctica/Mawson Antarctica/McMurdo Antarctica/Palmer Antarctica/Rothera Antarctica/Syowa Antarctica/Troll Antarctica/Vostok",
  AR: "America/Buenos_Aires America/Argentina/Buenos_Aires America/Cordoba America/Argentina/Cordoba America/Catamarca America/Argentina/Catamarca America/Jujuy America/Argentina/Jujuy America/Mendoza America/Argentina/Mendoza America/Argentina/La_Rioja America/Argentina/Rio_Gallegos America/Argentina/Salta America/Argentina/San_Juan America/Argentina/San_Luis America/Argentina/Tucuman America/Argentina/Ushuaia",
  AS: "Pacific/Pago_Pago",
  AT: "Europe/Vienna",
  AU: "Australia/Sydney Australia/Melbourne Australia/Brisbane Australia/Perth Australia/Adelaide Australia/Hobart Australia/Darwin Australia/Broken_Hill Australia/Eucla Australia/Lindeman Australia/Lord_Howe Antarctica/Macquarie Australia/Canberra Australia/ACT Australia/NSW Australia/Victoria Australia/Queensland Australia/West Australia/South Australia/Tasmania Australia/North",
  AW: "America/Aruba",
  AX: "Europe/Mariehamn",
  AZ: "Asia/Baku",
  BA: "Europe/Sarajevo",
  BB: "America/Barbados",
  BD: "Asia/Dhaka Asia/Dacca",
  BE: "Europe/Brussels",
  BF: "Africa/Ouagadougou",
  BG: "Europe/Sofia",
  BH: "Asia/Bahrain",
  BI: "Africa/Bujumbura",
  BJ: "Africa/Porto-Novo",
  BL: "America/St_Barthelemy",
  BM: "Atlantic/Bermuda",
  BN: "Asia/Brunei",
  BO: "America/La_Paz",
  BQ: "America/Kralendijk",
  BR: "America/Sao_Paulo America/Araguaina America/Bahia America/Belem America/Boa_Vista America/Campo_Grande America/Cuiaba America/Eirunepe America/Fortaleza America/Maceio America/Manaus America/Noronha America/Porto_Velho America/Recife America/Rio_Branco America/Santarem Brazil/East",
  BS: "America/Nassau",
  BT: "Asia/Thimphu Asia/Thimbu",
  BW: "Africa/Gaborone",
  BY: "Europe/Minsk",
  BZ: "America/Belize",
  CA: "America/Toronto America/Vancouver America/Edmonton America/Winnipeg America/Halifax America/St_Johns America/Regina America/Montreal America/Blanc-Sablon America/Cambridge_Bay America/Coral_Harbour America/Atikokan America/Creston America/Dawson America/Dawson_Creek America/Fort_Nelson America/Glace_Bay America/Goose_Bay America/Inuvik America/Iqaluit America/Moncton America/Rankin_Inlet America/Resolute America/Swift_Current America/Whitehorse",
  CC: "Indian/Cocos",
  CD: "Africa/Kinshasa Africa/Lubumbashi",
  CF: "Africa/Bangui",
  CG: "Africa/Brazzaville",
  CH: "Europe/Zurich",
  CI: "Africa/Abidjan",
  CK: "Pacific/Rarotonga",
  CL: "America/Santiago America/Punta_Arenas America/Coyhaique Pacific/Easter",
  CM: "Africa/Douala",
  CN: "Asia/Shanghai Asia/Urumqi Asia/Chongqing Asia/Chungking Asia/Harbin PRC",
  CO: "America/Bogota",
  CR: "America/Costa_Rica",
  CU: "America/Havana",
  CV: "Atlantic/Cape_Verde",
  CW: "America/Curacao",
  CX: "Indian/Christmas",
  CY: "Asia/Nicosia Asia/Famagusta Europe/Nicosia",
  CZ: "Europe/Prague",
  DE: "Europe/Berlin Europe/Busingen",
  DJ: "Africa/Djibouti",
  DK: "Europe/Copenhagen",
  DM: "America/Dominica",
  DO: "America/Santo_Domingo",
  DZ: "Africa/Algiers",
  EC: "America/Guayaquil Pacific/Galapagos",
  EE: "Europe/Tallinn",
  EG: "Africa/Cairo Egypt",
  EH: "Africa/El_Aaiun",
  ER: "Africa/Asmera Africa/Asmara",
  ES: "Europe/Madrid Africa/Ceuta Atlantic/Canary",
  ET: "Africa/Addis_Ababa",
  FI: "Europe/Helsinki",
  FJ: "Pacific/Fiji",
  FK: "Atlantic/Stanley",
  FM: "Pacific/Ponape Pacific/Pohnpei Pacific/Truk Pacific/Chuuk Pacific/Kosrae",
  FO: "Atlantic/Faeroe Atlantic/Faroe",
  FR: "Europe/Paris",
  GA: "Africa/Libreville",
  GB: "Europe/London Europe/Belfast GB",
  GD: "America/Grenada",
  GE: "Asia/Tbilisi",
  GF: "America/Cayenne",
  GG: "Europe/Guernsey",
  GH: "Africa/Accra",
  GI: "Europe/Gibraltar",
  GL: "America/Godthab America/Nuuk America/Danmarkshavn America/Scoresbysund America/Thule",
  GM: "Africa/Banjul",
  GN: "Africa/Conakry",
  GP: "America/Guadeloupe",
  GQ: "Africa/Malabo",
  GR: "Europe/Athens",
  GS: "Atlantic/South_Georgia",
  GT: "America/Guatemala",
  GU: "Pacific/Guam",
  GW: "Africa/Bissau",
  GY: "America/Guyana",
  HK: "Asia/Hong_Kong Hongkong",
  HN: "America/Tegucigalpa",
  HR: "Europe/Zagreb",
  HT: "America/Port-au-Prince",
  HU: "Europe/Budapest",
  ID: "Asia/Jakarta Asia/Jayapura Asia/Makassar Asia/Pontianak",
  IE: "Europe/Dublin Eire",
  IL: "Asia/Jerusalem Asia/Tel_Aviv Israel",
  IM: "Europe/Isle_of_Man",
  IN: "Asia/Calcutta Asia/Kolkata",
  IO: "Indian/Chagos",
  IQ: "Asia/Baghdad",
  IR: "Asia/Tehran Iran",
  IS: "Atlantic/Reykjavik Iceland",
  IT: "Europe/Rome",
  JE: "Europe/Jersey",
  JM: "America/Jamaica Jamaica",
  JO: "Asia/Amman",
  JP: "Asia/Tokyo Japan",
  KE: "Africa/Nairobi",
  KG: "Asia/Bishkek",
  KH: "Asia/Phnom_Penh",
  KI: "Pacific/Tarawa Pacific/Enderbury Pacific/Kanton Pacific/Kiritimati",
  KM: "Indian/Comoro",
  KN: "America/St_Kitts",
  KP: "Asia/Pyongyang",
  KR: "Asia/Seoul ROK",
  KW: "Asia/Kuwait",
  KY: "America/Cayman",
  KZ: "Asia/Almaty Asia/Aqtau Asia/Aqtobe Asia/Atyrau Asia/Oral Asia/Qostanay Asia/Qyzylorda",
  LA: "Asia/Vientiane",
  LB: "Asia/Beirut",
  LC: "America/St_Lucia",
  LI: "Europe/Vaduz",
  LK: "Asia/Colombo",
  LR: "Africa/Monrovia",
  LS: "Africa/Maseru",
  LT: "Europe/Vilnius",
  LU: "Europe/Luxembourg",
  LV: "Europe/Riga",
  LY: "Africa/Tripoli Libya",
  MA: "Africa/Casablanca",
  MC: "Europe/Monaco",
  MD: "Europe/Chisinau Europe/Tiraspol",
  ME: "Europe/Podgorica",
  MF: "America/Marigot",
  MG: "Indian/Antananarivo",
  MH: "Pacific/Majuro Pacific/Kwajalein Kwajalein",
  MK: "Europe/Skopje",
  ML: "Africa/Bamako",
  MM: "Asia/Rangoon Asia/Yangon",
  MN: "Asia/Ulaanbaatar Asia/Ulan_Bator Asia/Hovd Asia/Choibalsan",
  MO: "Asia/Macau Asia/Macao",
  MP: "Pacific/Saipan",
  MQ: "America/Martinique",
  MR: "Africa/Nouakchott",
  MS: "America/Montserrat",
  MT: "Europe/Malta",
  MU: "Indian/Mauritius",
  MV: "Indian/Maldives",
  MW: "Africa/Blantyre",
  MX: "America/Mexico_City America/Bahia_Banderas America/Cancun America/Chihuahua America/Ciudad_Juarez America/Hermosillo America/Matamoros America/Mazatlan America/Merida America/Monterrey America/Ojinaga America/Tijuana America/Ensenada Mexico/General",
  MY: "Asia/Kuala_Lumpur Asia/Kuching",
  MZ: "Africa/Maputo",
  NA: "Africa/Windhoek",
  NC: "Pacific/Noumea",
  NE: "Africa/Niamey",
  NF: "Pacific/Norfolk",
  NG: "Africa/Lagos",
  NI: "America/Managua",
  NL: "Europe/Amsterdam",
  NO: "Europe/Oslo",
  NP: "Asia/Katmandu Asia/Kathmandu",
  NR: "Pacific/Nauru",
  NU: "Pacific/Niue",
  NZ: "Pacific/Auckland Pacific/Chatham NZ Antarctica/South_Pole",
  OM: "Asia/Muscat",
  PA: "America/Panama",
  PE: "America/Lima",
  PF: "Pacific/Tahiti Pacific/Gambier Pacific/Marquesas",
  PG: "Pacific/Port_Moresby Pacific/Bougainville",
  PH: "Asia/Manila",
  PK: "Asia/Karachi",
  PL: "Europe/Warsaw Poland",
  PM: "America/Miquelon",
  PN: "Pacific/Pitcairn",
  PR: "America/Puerto_Rico",
  PS: "Asia/Gaza Asia/Hebron",
  PT: "Europe/Lisbon Atlantic/Azores Atlantic/Madeira Portugal",
  PW: "Pacific/Palau",
  PY: "America/Asuncion",
  QA: "Asia/Qatar",
  RE: "Indian/Reunion",
  RO: "Europe/Bucharest",
  RS: "Europe/Belgrade",
  RU: "Europe/Moscow Europe/Kaliningrad Europe/Samara Europe/Volgograd Europe/Astrakhan Europe/Kirov Europe/Saratov Europe/Ulyanovsk Asia/Yekaterinburg Asia/Omsk Asia/Novosibirsk Asia/Barnaul Asia/Tomsk Asia/Novokuznetsk Asia/Krasnoyarsk Asia/Irkutsk Asia/Chita Asia/Yakutsk Asia/Khandyga Asia/Vladivostok Asia/Ust-Nera Asia/Magadan Asia/Sakhalin Asia/Srednekolymsk Asia/Kamchatka Asia/Anadyr W-SU",
  RW: "Africa/Kigali",
  SA: "Asia/Riyadh",
  SB: "Pacific/Guadalcanal",
  SC: "Indian/Mahe",
  SD: "Africa/Khartoum",
  SE: "Europe/Stockholm",
  SG: "Asia/Singapore Singapore",
  SH: "Atlantic/St_Helena",
  SI: "Europe/Ljubljana",
  SJ: "Arctic/Longyearbyen Atlantic/Jan_Mayen",
  SK: "Europe/Bratislava",
  SL: "Africa/Freetown",
  SM: "Europe/San_Marino",
  SN: "Africa/Dakar",
  SO: "Africa/Mogadishu",
  SR: "America/Paramaribo",
  SS: "Africa/Juba",
  ST: "Africa/Sao_Tome",
  SV: "America/El_Salvador",
  SX: "America/Lower_Princes",
  SY: "Asia/Damascus",
  SZ: "Africa/Mbabane",
  TC: "America/Grand_Turk",
  TD: "Africa/Ndjamena",
  TF: "Indian/Kerguelen",
  TG: "Africa/Lome",
  TH: "Asia/Bangkok",
  TJ: "Asia/Dushanbe",
  TK: "Pacific/Fakaofo",
  TL: "Asia/Dili",
  TM: "Asia/Ashgabat Asia/Ashkhabad",
  TN: "Africa/Tunis",
  TO: "Pacific/Tongatapu",
  TR: "Europe/Istanbul Asia/Istanbul Turkey",
  TT: "America/Port_of_Spain",
  TV: "Pacific/Funafuti",
  TW: "Asia/Taipei ROC",
  TZ: "Africa/Dar_es_Salaam",
  UA: "Europe/Kiev Europe/Kyiv Europe/Uzhgorod Europe/Zaporozhye",
  UG: "Africa/Kampala",
  UM: "Pacific/Midway Pacific/Wake",
  US: "America/New_York America/Chicago America/Denver America/Phoenix America/Los_Angeles America/Anchorage Pacific/Honolulu America/Adak America/Boise America/Detroit America/Indianapolis America/Indiana/Indianapolis America/Indiana/Knox America/Indiana/Marengo America/Indiana/Petersburg America/Indiana/Tell_City America/Indiana/Vevay America/Indiana/Vincennes America/Indiana/Winamac America/Juneau America/Kentucky/Louisville America/Louisville America/Kentucky/Monticello America/Menominee America/Metlakatla America/Nome America/North_Dakota/Beulah America/North_Dakota/Center America/North_Dakota/New_Salem America/Sitka America/Yakutat America/Fort_Wayne US/Eastern US/Central US/Mountain US/Pacific US/Alaska US/Hawaii US/Arizona US/Michigan",
  UY: "America/Montevideo",
  UZ: "Asia/Tashkent Asia/Samarkand",
  VA: "Europe/Vatican",
  VC: "America/St_Vincent",
  VE: "America/Caracas",
  VG: "America/Tortola",
  VI: "America/St_Thomas America/Virgin",
  VN: "Asia/Saigon Asia/Ho_Chi_Minh",
  VU: "Pacific/Efate",
  WF: "Pacific/Wallis",
  WS: "Pacific/Apia",
  YE: "Asia/Aden",
  YT: "Indian/Mayotte",
  ZA: "Africa/Johannesburg",
  ZM: "Africa/Lusaka",
  ZW: "Africa/Harare",
};

/** Zones also used by countries with no zone ID of their own; a matching language region picks them. */
const ALSO_USED_BY: ReadonlyMap<string, readonly string[]> = new Map([["europe/belgrade", ["XK"]]]);

const COUNTRY_BY_ZONE: ReadonlyMap<string, string> = new Map(
  Object.entries(ZONES_BY_COUNTRY).flatMap(([country, zones]) =>
    zones.split(" ").map((zone) => [zone.toLowerCase(), country] as const),
  ),
);

/**
 * Languages spoken mainly in one country, for a bare language tag with no
 * region ("de", "ja"). Languages spread across many countries (en, es, pt,
 * ar, zh, fr, ru...) are left out on purpose: "es" alone says nothing about
 * where someone lives.
 */
const COUNTRY_BY_LANGUAGE: ReadonlyMap<string, string> = new Map([
  ["bg", "BG"],
  ["cs", "CZ"],
  ["da", "DK"],
  ["de", "DE"],
  ["el", "GR"],
  ["et", "EE"],
  ["fi", "FI"],
  ["he", "IL"],
  ["hu", "HU"],
  ["hy", "AM"],
  ["id", "ID"],
  ["is", "IS"],
  ["it", "IT"],
  ["iw", "IL"],
  ["ja", "JP"],
  ["ka", "GE"],
  ["ko", "KR"],
  ["lt", "LT"],
  ["lv", "LV"],
  ["nb", "NO"],
  ["nl", "NL"],
  ["nn", "NO"],
  ["no", "NO"],
  ["pl", "PL"],
  ["sk", "SK"],
  ["sl", "SI"],
  ["sv", "SE"],
  ["th", "TH"],
  ["tr", "TR"],
  ["uk", "UA"],
  ["vi", "VN"],
]);

/** The country a time zone belongs to, or null for unknown or country-less zones ("UTC", "Etc/GMT+5"). */
export function countryFromTimeZone(timeZone: string | null | undefined): string | null {
  if (typeof timeZone !== "string") return null;
  return COUNTRY_BY_ZONE.get(timeZone.trim().toLowerCase()) ?? null;
}

/** Region subtag of a BCP 47 language tag ("pt-BR" -> "BR", "zh-Hant-TW" -> "TW"), if it is a country we list. */
function regionOf(tag: string): string | null {
  const subtags = tag.trim().split(/[-_]/);
  // Region comes after the language and an optional 4-letter script, before any variants or extensions.
  for (const subtag of subtags.slice(1)) {
    if (subtag.length === 1) break; // extension singleton such as "-u-": everything after is not a region
    if (/^[A-Za-z]{2}$/.test(subtag)) {
      const code = normalizeCountryCode(subtag);
      return code && SUPPORTED_COUNTRY_CODES.has(code) ? code : null;
    }
  }
  return null;
}

/**
 * A sensible default country for the country picker, from what the browser
 * tells us: `navigator.languages` and the IANA time zone from
 * `Intl.DateTimeFormat().resolvedOptions().timeZone`.
 *
 * The time zone wins when we know it, because it says where the device is,
 * while languages often say only how the browser was set up ("en-US" is the
 * default in many countries). Otherwise the first language with a region
 * ("en-GB" -> GB, "pt-BR" -> BR) decides, then a language spoken mainly in
 * one country ("ja" -> JP). Returns null when nothing is telling.
 * Pure: pass the values in.
 *
 * @example guessCountry({ languages: ["en-US", "en"], timeZone: "Europe/Berlin" }) // "DE"
 */
export function guessCountry(input: { languages?: readonly string[]; timeZone?: string }): string | null {
  const languages = Array.isArray(input?.languages) ? input.languages.filter((l) => typeof l === "string") : [];
  const fromZone = countryFromTimeZone(input?.timeZone);
  if (fromZone) {
    const sharing = ALSO_USED_BY.get(String(input.timeZone).trim().toLowerCase()) ?? [];
    const preferred = languages.map(regionOf).find((region) => region !== null && sharing.includes(region));
    return preferred ?? fromZone;
  }
  for (const tag of languages) {
    const region = regionOf(tag);
    if (region) return region;
  }
  for (const tag of languages) {
    const language = tag.trim().split(/[-_]/)[0]?.toLowerCase() ?? "";
    const country = COUNTRY_BY_LANGUAGE.get(language);
    if (country) return country;
  }
  return null;
}
