import { normalizeCountryCode, OTHER_COUNTRY_CODE, countryName } from "@/lib/location/countries";
import { US_MILITARY_CODES, US_TERRITORY_CODES, usRegionName } from "@/lib/location/regions";
import type { ProgramId } from "@/lib/types";
import { PROGRAMS_BY_ID, type Program } from "./programs";

/** Which programs cover an address, grouped by how much they can see, plus honest blind spots. */
export interface Coverage {
  country: string;
  region: string | null;
  /** Programs that show everything headed to your verified address. */
  addressPrograms: Program[];
  /** Programs tied to your own account / email (e.g. Amazon). */
  accountPrograms: Program[];
  /** Programs that only follow one shipment at a time. */
  perPackage: Program[];
  /** Plain-language blind spots, e.g. "Amazon packages someone else ordered for you won't appear anywhere". */
  gaps: string[];
  /** True when we can fully parse the main carriers' emails for this country (US only for now). */
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

const INTERNATIONAL_GAPS = [
  "UPS My Choice availability and features vary by country.",
  "Outside the US and Canada, FedEx Delivery Manager only covers shipments where the sender has switched it on.",
];

function basicParsingGap(carriers: string): string {
  return `We only pick up tracking numbers from ${carriers} emails for now, so those packages show fewer details (no delivery date or sender).`;
}

const PLANS: Readonly<Record<string, CountryPlan>> = {
  US: {
    address: ["usps_informed_delivery", "ups_my_choice", "fedex_delivery_manager"],
    account: ["amazon_orders"],
    perPackage: ["dhl_on_demand", "ontrac_notifyme"],
    gaps: [
      AMAZON_GAP,
      "DHL Express and OnTrac (formerly LaserShip) have no program that lists everything coming to your address, so their packages only show up when you get an alert or email about that specific package.",
      "Regional couriers and local delivery services aren't covered.",
      LATE_LISTING_GAP,
    ],
  },
  CA: {
    address: ["canada_post_auto_tracking", "ups_my_choice", "fedex_delivery_manager"],
    account: ["amazon_orders"],
    perPackage: ["dhl_on_demand"],
    gaps: [
      AMAZON_GAP,
      "Canada Post's automatic tracking doesn't cover business or PO Box addresses, and Canada Post says it may miss some parcels.",
      "Purolator, Intelcom/Dragonfly and other couriers aren't covered yet.",
      basicParsingGap("Canada Post"),
      "UPS My Choice availability and features vary by country.",
      LATE_LISTING_GAP,
    ],
  },
  GB: {
    address: ["ups_my_choice", "fedex_delivery_manager"],
    account: ["evri_app", "dpd_uk_app", "amazon_orders"],
    perPackage: ["royal_mail_app", "dhl_on_demand"],
    gaps: [
      "No UK carrier lists everything coming to your address: Evri and DPD match parcels to the email or phone number you gave the shop, and Royal Mail only emails you when the sender shares your email address.",
      AMAZON_GAP,
      basicParsingGap("Royal Mail, Evri and DPD"),
      "Parcels from other couriers aren't covered yet.",
      ...INTERNATIONAL_GAPS,
    ],
  },
  NL: {
    address: ["postnl_account", "ups_my_choice", "fedex_delivery_manager"],
    account: ["amazon_orders"],
    perPackage: ["dhl_on_demand"],
    gaps: [
      "PostNL only shows PostNL parcels; DHL Parcel, DPD, GLS and other couriers aren't covered yet.",
      AMAZON_GAP,
      basicParsingGap("PostNL"),
      ...INTERNATIONAL_GAPS,
    ],
  },
  DE: {
    address: ["dhl_paket_de", "ups_my_choice", "fedex_delivery_manager"],
    account: ["amazon_orders"],
    perPackage: ["dhl_on_demand"],
    gaps: [
      "DHL's parcel announcement skips parcels sent to a Packstation or branch, small parcels and returns.",
      "Hermes, DPD, GLS and other couriers aren't covered yet.",
      AMAZON_GAP,
      basicParsingGap("DHL Paket"),
      ...INTERNATIONAL_GAPS,
    ],
  },
  AU: {
    address: ["ups_my_choice", "fedex_delivery_manager"],
    account: ["australia_post_mypost", "amazon_orders"],
    perPackage: ["dhl_on_demand"],
    gaps: [
      "Australia Post matches parcels mainly by the email and mobile number you shop with, so parcels other people send you may not appear.",
      "Aramex, CouriersPlease, TNT and other couriers aren't covered yet.",
      AMAZON_GAP,
      basicParsingGap("Australia Post"),
      ...INTERNATIONAL_GAPS,
    ],
  },
};

function otherCountryPlan(code: string): CountryPlan {
  const name = code === OTHER_COUNTRY_CODE ? null : countryName(code);
  return {
    address: ["ups_my_choice", "fedex_delivery_manager"],
    account: ["amazon_orders"],
    perPackage: ["dhl_on_demand"],
    gaps: [
      `We don't have carrier program details for ${name ?? "your country"} yet. UPS, FedEx, DHL Express and Amazon operate in many countries, but check each one's site to see whether it covers your address.`,
      "Your national postal service and local couriers aren't covered yet.",
      "Outside the US, we only pick up tracking numbers from carrier emails for now, so packages show fewer details.",
      AMAZON_GAP,
    ],
  };
}

/** Adjust the US plan for military (APO/FPO/DPO) and territory addresses. */
function usPlanFor(region: string | null): CountryPlan {
  const base = PLANS.US;
  if (region && US_MILITARY_CODES.has(region)) {
    return {
      address: ["usps_informed_delivery"],
      account: base.account,
      perPackage: [],
      gaps: [
        "UPS and FedEx don't deliver to APO/FPO/DPO addresses, so UPS My Choice and FedEx Delivery Manager won't help here.",
        ...base.gaps,
      ],
    };
  }
  if (region && US_TERRITORY_CODES.has(region)) {
    const name = usRegionName(region) ?? region;
    return {
      ...base,
      gaps: [
        `We couldn't confirm which carrier programs accept addresses in ${name}; each one checks eligibility when you sign up.`,
        ...base.gaps,
      ],
    };
  }
  return base;
}

const toPrograms = (ids: ProgramId[]): Program[] => ids.map((id) => PROGRAMS_BY_ID[id]);

/**
 * Carrier programs that cover an address in `country` (ISO alpha-2, "UK"
 * accepted) and `region` (state / province code), with the blind spots we
 * should tell the user about. Unknown countries get the international
 * programs plus a note that we lack local details.
 */
export function getCoverage(country: string, region: string | null): Coverage {
  const code = normalizeCountryCode(country) ?? OTHER_COUNTRY_CODE;
  const regionCode = typeof region === "string" && region.trim() ? region.trim().toUpperCase() : null;
  const plan = code === "US" ? usPlanFor(regionCode) : (PLANS[code] ?? otherCountryPlan(code));
  return {
    country: code,
    region: regionCode,
    addressPrograms: toPrograms(plan.address),
    accountPrograms: toPrograms(plan.account),
    perPackage: toPrograms(plan.perPackage),
    gaps: [...plan.gaps],
    fullySupported: code === "US",
  };
}
