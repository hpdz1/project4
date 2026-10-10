import {
  OTHER_COUNTRY_CODE,
  USPS_SERVED_COUNTRY_CODES,
  countryName,
  isCountryCode,
  normalizeCountryCode,
} from "@/lib/location/countries";
import { US_MILITARY_CODES, US_TERRITORY_CODES, usRegionName } from "@/lib/location/regions";
import type { ProgramId } from "@/lib/types";
import {
  AMAZON_COUNTRIES,
  PROGRAMS,
  PROGRAMS_BY_ID,
  UPS_MY_CHOICE_COUNTRIES,
  localizeProgram,
  programSenders,
  type Program,
} from "./programs";

/** Which programs cover an address, grouped by how much they can see, plus honest blind spots. */
export interface Coverage {
  country: string;
  region: string | null;
  /** Programs that show everything headed to your verified address. */
  addressPrograms: Program[];
  /** Programs tied to your own account, email address or phone number (e.g. Amazon, PostNord). */
  accountPrograms: Program[];
  /** Programs that only follow one shipment at a time. */
  perPackage: Program[];
  /** Plain-language blind spots, e.g. "Amazon packages someone else ordered for you won't appear anywhere". */
  gaps: string[];
  /**
   * Operators whose emails we read in basic mode here (tracking numbers and
   * common status words, not always dates or the sender), e.g. ["Swiss Post"].
   * Empty in the US, where we fully parse the main carriers' emails.
   */
  basicParsing: string[];
  /** True when we can fully parse the main carriers' emails for this country (the US and the territories USPS serves). */
  fullySupported: boolean;
}

interface CountryPlan {
  address: ProgramId[];
  account: ProgramId[];
  perPackage: ProgramId[];
  gaps: string[];
}

const AMAZON_GAP =
  "Amazon packages someone else ordered for you (a gift, or a housemate's order) won't appear anywhere: Amazon only emails the account that placed the order, and no carrier program covers Amazon's own drivers.";

const LATE_LISTING_GAP =
  "A package can take a while to appear: carriers usually list it only once they have its label data or first scan.";

const UPS_VARIES_GAP = "UPS My Choice availability and features vary by country.";

/** Programs offered in many countries; everything else is a national program. */
const INTERNATIONAL_IDS: ReadonlySet<ProgramId> = new Set([
  "ups_my_choice",
  "fedex_delivery_manager",
  "fedex_delivery_manager_intl",
  "amazon_orders",
  "dhl_on_demand",
]);

/** Shops' own order emails: they don't make up for a missing postal program. */
const RETAILER_IDS: ReadonlySet<ProgramId> = new Set(["amazon_orders", "allegro_orders", "noon_orders"]);

/** Postal operators named in "we don't know of a service from …" where the research names them. */
const POSTAL_OPERATORS: Readonly<Record<string, string>> = {
  AR: "Correo Argentino",
  CL: "Correos de Chile",
  CO: "4-72",
  EG: "Egypt Post",
  HK: "Hongkong Post",
  HU: "Magyar Posta",
  ID: "Pos Indonesia",
  IN: "India Post",
  KR: "Korea Post",
  MX: "Correos de México",
  MY: "Pos Malaysia",
  NG: "NIPOST",
  PE: "Serpost",
  PH: "PHLPost",
  SG: "SingPost",
  TH: "Thailand Post",
  TR: "PTT",
  TW: "Chunghwa Post",
  VN: "Vietnam Post",
  ZA: "the South African Post Office",
};

const NORDIC_GAP =
  "Nordic carriers match parcels to your phone number or email address and mostly notify in their apps, so turn on email notifications where you can.";

/** Country-specific blind spots, shown first. Everything here comes from the country research. */
const COUNTRY_GAPS: Readonly<Record<string, string[]>> = {
  CA: [
    "Canada Post's automatic tracking doesn't cover business or PO Box addresses, and Canada Post says it may miss some parcels.",
    "Purolator and Intelcom only email you when the shipper or shop shares your email address; Canpar and other couriers aren't covered yet.",
  ],
  GB: [
    "No UK carrier lists everything coming to your address: Evri and DPD match parcels to the email or phone number you gave the shop, and Royal Mail only emails you when the sender shares your email address.",
    "Parcels from other couriers aren't covered yet.",
  ],
  NL: [
    "PostNL only shows PostNL parcels; DHL and DPD match parcels to your email address, and GLS and other couriers aren't covered yet.",
  ],
  DE: [
    "DHL's parcel announcement skips parcels sent to a Packstation or branch, small parcels and returns.",
    "DPD and GLS match parcels to your email address, and Hermes only emails you when the shop shares your email address; other couriers aren't covered yet.",
  ],
  AU: [
    "Australia Post matches parcels mainly by the email and mobile number you shop with, so parcels other people send you may not appear.",
    "Aramex matches parcels to the email address on the label; CouriersPlease, Sendle and other couriers only contact you when the sender shares your details.",
  ],
  CH: ["My consignments only covers Swiss Post; other couriers only contact you when the shop shares your details."],
  LI: ["My consignments only covers Swiss Post; other couriers only contact you when the shop shares your details."],
  AT: [
    "Austrian Post only lists parcels whose shipping data matches your name and address exactly.",
    "GLS matches parcels to your email address; DPD and other couriers only contact you when the shop shares your details.",
  ],
  FR: [
    "No French carrier lists everything coming to your address: Colissimo, Chronopost, Mondial Relay and DPD only contact you when the shop shares your email address or phone number.",
  ],
  ES: [
    "No Spanish carrier lists everything coming to your address: Correos and SEUR match shipments to your account details, and other couriers such as MRW only contact you when the shop shares your details.",
  ],
  IT: ["PostePlus only covers shops that switched it on; BRT and other couriers only contact you when the shop shares your details."],
  IE: [
    "An Post matches parcels by email address and phone number, not by address; other couriers only contact you when the shop shares your details.",
  ],
  BE: [
    "bpost matches parcels by email address, and DPD by email address or phone number plus your postcode, not by your full address; PostNL and other couriers only contact you when the shop shares your details.",
  ],
  PL: [
    "Polish carriers match parcels to your phone number or email address, not your address.",
    "For Allegro orders, carrier emails arrive through Allegro rather than from the carrier.",
  ],
  CZ: [
    "Czech carriers match parcels to the phone number or email address the sender entered; PPL, GLS and other couriers aren't covered yet.",
  ],
  SE: [NORDIC_GAP],
  DK: [NORDIC_GAP],
  NO: [NORDIC_GAP],
  FI: [NORDIC_GAP],
  JP: [
    "Japan Post and Yamato only cover parcels the sender registered electronically, and LINE notifications can't be forwarded to Package Radar.",
  ],
  KR: [
    "Korean carriers notify by app, KakaoTalk or text message rather than email. Korea Post lets members look up parcels by phone number, but doesn't email about them.",
  ],
  CN: [
    "Chinese carriers notify by app, text message or WeChat rather than email, so Package Radar mostly sees parcels that a shop or marketplace emails you about.",
  ],
  NZ: ["NZ Post and Aramex match parcels to your account details, and NZ Post only emails you when the sender shares your email address."],
  BR: [
    "Correios lists items linked to your CPF only when the CPF was recorded at posting, and its alerts come in the app.",
  ],
  IN: [
    "India Post texts you when your mobile number was captured at booking, and Delhivery lets you look up shipments by mobile number; we found no email alerts from either.",
  ],
  SG: ["SingPost sends notifications in its app rather than by text message or email."],
};

function noNationalProgramGap(code: string): string {
  const post = POSTAL_OPERATORS[code] ?? "your national postal service";
  return `We don't know of a service from ${post} that lists parcels heading to you automatically. Forward your shipping and carrier emails anyway — Package Radar picks up tracking numbers from them.`;
}

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function hasForwardableEmail(program: Program, country: string): boolean {
  return programSenders(program, country).length > 0;
}

function basicParsingGap(operators: readonly string[]): string {
  return operators.length
    ? `We read emails from ${listNames(operators)} in basic mode: we pick up tracking numbers and common status words, but may miss delivery dates and who sent the parcel.`
    : "Outside the US we read carrier emails in basic mode: we pick up tracking numbers and common status words, but may miss delivery dates and who sent the parcel.";
}

const US_PLAN: CountryPlan = {
  address: ["usps_informed_delivery", "ups_my_choice", "fedex_delivery_manager"],
  account: ["amazon_orders"],
  perPackage: ["dhl_on_demand", "ontrac_notifyme"],
  gaps: [
    AMAZON_GAP,
    "DHL Express and OnTrac (formerly LaserShip) have no program that lists everything coming to your address, so their packages only show up when you get an alert or email about that specific package.",
    "Regional couriers and local delivery services aren't covered.",
    LATE_LISTING_GAP,
  ],
};

/** Adjust the US plan for military (APO/FPO/DPO) and territory addresses. */
function usPlanFor(region: string | null): CountryPlan {
  if (region && US_MILITARY_CODES.has(region)) {
    return {
      address: ["usps_informed_delivery"],
      account: US_PLAN.account,
      perPackage: [],
      gaps: [
        "UPS and FedEx don't deliver to APO/FPO/DPO addresses, so UPS My Choice and FedEx Delivery Manager won't help here.",
        ...US_PLAN.gaps,
      ],
    };
  }
  if (region && US_TERRITORY_CODES.has(region)) {
    const name = usRegionName(region) ?? region;
    return {
      ...US_PLAN,
      gaps: [
        `We couldn't confirm which carrier programs accept addresses in ${name}; each one checks eligibility when you sign up.`,
        ...US_PLAN.gaps,
      ],
    };
  }
  return US_PLAN;
}

/** "Other": the international programs, with a note to pick a country. */
function otherCountryPlan(): CountryPlan {
  return {
    address: ["ups_my_choice"],
    account: ["amazon_orders"],
    perPackage: ["dhl_on_demand", "fedex_delivery_manager_intl"],
    gaps: [
      "Choose your country to see the carrier programs available there. Wherever you live, forward your shipping and carrier emails — Package Radar picks up tracking numbers from them.",
      "We don't know your country, so check whether UPS My Choice and Amazon operate there before signing up.",
      AMAZON_GAP,
    ],
  };
}

/** National programs from the program data, plus the international ones that operate in `code`. */
function countryPlan(code: string): CountryPlan {
  const national = PROGRAMS.filter((p) => !INTERNATIONAL_IDS.has(p.id) && p.countries.includes(code));
  const ids = (kind: Program["kind"]) => national.filter((p) => p.kind === kind).map((p) => p.id);
  const hasUps = UPS_MY_CHOICE_COUNTRIES.includes(code);
  const hasAmazon = AMAZON_COUNTRIES.includes(code);
  const address = [...ids("address"), ...(hasUps ? ["ups_my_choice"] : []), ...(code === "CA" ? ["fedex_delivery_manager"] : [])];
  const account = [...ids("account"), ...(hasAmazon ? ["amazon_orders"] : [])];
  const perPackage = [...ids("per_package"), "dhl_on_demand", ...(code === "CA" ? [] : ["fedex_delivery_manager_intl"])];

  const name = countryName(code);
  const carriers = national.filter((p) => !RETAILER_IDS.has(p.id));
  const silent = carriers.filter((p) => !hasForwardableEmail(p, code)).map((p) => p.name);
  const gaps = [
    ...(COUNTRY_GAPS[code] ?? []),
    ...(carriers.length === 0 ? [noNationalProgramGap(code)] : []),
    ...(silent.length
      ? [
          `We couldn't find email alerts we can forward automatically from ${listNames(silent)}, so those parcels only show up here if you forward an email about them yourself.`,
        ]
      : []),
    ...(hasAmazon ? [AMAZON_GAP] : []),
    hasUps
      ? UPS_VARIES_GAP
      : `UPS My Choice is offered in many countries, but we couldn't confirm it's available in ${name}. If UPS delivers to you, check ups.com.`,
    ...(ids("address").length ? [LATE_LISTING_GAP] : []),
  ];
  return { address, account, perPackage, gaps };
}

/**
 * Carrier programs that cover an address in `country` (ISO alpha-2, "UK"
 * accepted) and `region` (state / province code), with the blind spots we
 * should tell the user about. Unknown codes are treated as "Other" (ZZ). The
 * US territories USPS serves (PR, GU, VI…) get the US programs.
 *
 * Programs come back as they apply in that country: the country's sign-up
 * page and sender addresses replace the defaults.
 */
export function getCoverage(country: string, region: string | null): Coverage {
  const normalized = normalizeCountryCode(country);
  const code = normalized && isCountryCode(normalized) ? normalized : OTHER_COUNTRY_CODE;
  const regionCode = typeof region === "string" && region.trim() ? region.trim().toUpperCase() : null;
  const usServed = code === "US" || USPS_SERVED_COUNTRY_CODES.has(code);

  const plan = usServed
    ? usPlanFor(code === "US" ? regionCode : (regionCode ?? code))
    : code === OTHER_COUNTRY_CODE
      ? otherCountryPlan()
      : countryPlan(code);

  const localeCountry = usServed ? "US" : code;
  const toPrograms = (ids: ProgramId[]): Program[] =>
    ids.map((id) => PROGRAMS_BY_ID[id]).map((p) => localizeProgram(p, localeCountry));
  const addressPrograms = toPrograms(plan.address);
  const accountPrograms = toPrograms(plan.account);
  const perPackage = toPrograms(plan.perPackage);

  const basicParsing = usServed
    ? []
    : [
        ...new Set(
          [...addressPrograms, ...accountPrograms, ...perPackage]
            .filter((p) => p.parserSupport === "basic" && p.emailAlerts.senders.length > 0)
            .map((p) => p.operator),
        ),
      ];

  return {
    country: code,
    region: regionCode,
    addressPrograms,
    accountPrograms,
    perPackage,
    gaps: usServed ? [...plan.gaps] : [...plan.gaps, basicParsingGap(basicParsing)],
    basicParsing,
    fullySupported: usServed,
  };
}
