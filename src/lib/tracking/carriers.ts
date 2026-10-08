import type { CarrierId } from "@/lib/types";

/** Display names for carriers. */
export const CARRIER_NAMES: Record<CarrierId, string> = {
  usps: "USPS",
  ups: "UPS",
  fedex: "FedEx",
  dhl: "DHL",
  amazon: "Amazon",
  ontrac: "OnTrac",
  unknown: "Unknown carrier",
};

/**
 * Official public tracking page per carrier; `{n}` is replaced by the
 * URI-encoded tracking number. Templates from research/programs.md Part B.
 */
const TRACKING_URL_TEMPLATES: Record<Exclude<CarrierId, "unknown">, string> = {
  usps: "https://tools.usps.com/go/TrackConfirmAction?tLabels={n}",
  ups: "https://www.ups.com/track?loc=en_US&tracknum={n}&requester=ST/trackdetails",
  fedex: "https://www.fedex.com/fedextrack/?trknbr={n}",
  dhl: "https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id={n}",
  amazon: "https://track.amazon.com/tracking/{n}",
  ontrac: "https://www.ontrac.com/tracking/?number={n}",
};

/**
 * Link to the carrier's own public tracking page for `trackingNumber`, or
 * null for an unknown carrier or an empty number. The number is used as given
 * (callers pass a normalized number) and URI-encoded.
 */
export function trackingUrl(carrier: CarrierId, trackingNumber: string): string | null {
  if (carrier === "unknown") return null;
  const template = TRACKING_URL_TEMPLATES[carrier];
  if (!template || trackingNumber.trim() === "") return null;
  return template.replace("{n}", encodeURIComponent(trackingNumber.trim()));
}

/** Registrable domains that belong to each carrier (matched on the host suffix). */
const CARRIER_DOMAINS: readonly [string, CarrierId][] = [
  ["usps.com", "usps"],
  ["usps.gov", "usps"],
  ["ups.com", "ups"],
  ["fedex.com", "fedex"],
  ["dhl.com", "dhl"],
  ["dhl.de", "dhl"],
  ["dhlecs.com", "dhl"],
  ["dhlglobalmail.com", "dhl"],
  ["ontrac.com", "ontrac"],
  ["lasership.com", "ontrac"],
];

/**
 * Carrier that owns a URL host, or null. Amazon counts only for its tracking
 * host (track.amazon.com), not for retail pages such as amazon.com/gp/...
 */
export function carrierFromHost(host: string): CarrierId | null {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (h === "track.amazon.com") return "amazon";
  for (const [domain, carrier] of CARRIER_DOMAINS) {
    if (h === domain || h.endsWith(`.${domain}`)) return carrier;
  }
  return null;
}

/** Words that name a carrier in running text. "UPS" is case-sensitive to avoid "follow-ups". */
const CARRIER_MENTIONS: readonly [RegExp, CarrierId][] = [
  [/\b(?:usps|u\.\s?s\.\s?postal|postal service|informed delivery)\b/i, "usps"],
  [/\bUPS\b/, "ups"],
  [/\bfed\s?ex\b/i, "fedex"],
  [/\bdhl\b/i, "dhl"],
  [/\bamazon\b/i, "amazon"],
  [/\b(?:on\s?trac|laser\s?ship)\b/i, "ontrac"],
];

/** Carriers named anywhere in `text`. */
export function carriersMentioned(text: string): Set<CarrierId> {
  const found = new Set<CarrierId>();
  for (const [re, carrier] of CARRIER_MENTIONS) {
    if (re.test(text)) found.add(carrier);
  }
  return found;
}

/** Carrier named by a single word (URL path segment or `carrier=` value), e.g. "fedex". */
export function carrierFromWord(word: string): CarrierId | null {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  switch (w) {
    case "usps":
      return "usps";
    case "ups":
      return "ups";
    case "fedex":
      return "fedex";
    case "dhl":
    case "dhlexpress":
    case "dhlecommerce":
      return "dhl";
    case "amazon":
    case "amazonlogistics":
      return "amazon";
    case "ontrac":
    case "lasership":
      return "ontrac";
    default:
      return null;
  }
}
