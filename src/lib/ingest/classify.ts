import type { CarrierId, SourceKind } from "@/lib/types";
import { domainOf, isDomainOrSubdomain } from "./addresses";

/**
 * Which carrier email is this? Decided by the (recovered) original sender,
 * with a subject-only fallback for manual forwards whose original sender we
 * could not read. Sender lists from research/carrier-emails.md §7 (Home
 * Assistant Mail and Packages, MIT).
 *
 * Classification is not authentication: anyone can write a From header. The
 * inbound route decides how much to trust a message.
 */

/** Source kinds that have a dedicated parser. */
export type CarrierSourceKind = Exclude<SourceKind, "generic">;

const INFORMED_DELIVERY_RE =
  /^uspsinformeddelivery@(?:email\.)?informeddelivery\.usps\.com$|^uspsinformeddelivery@usps\.gov$/;

const AMAZON_DOMAIN_RE =
  /^(?:[a-z0-9-]+\.)*amazon\.(?:com|ca|co\.uk|de|it|com\.au|in|pl|es|fr|ae|nl|se|co\.jp|com\.mx|com\.br|com\.be|com\.tr|sa|sg|ie|eg)$/;

const DHL_DOMAINS = ["dhl.com", "dhl.de", "dhl.co.uk", "dhl.ca", "dhl.fr", "dhl.nl", "dhlecs.com", "dhlecommerce.com"];

/** Carrier that owns a sender address, by domain. */
export function classifySender(from: string): CarrierSourceKind | null {
  const address = from.trim().toLowerCase();
  if (!address.includes("@")) return null;
  const domain = domainOf(address);
  if (INFORMED_DELIVERY_RE.test(address) || isDomainOrSubdomain(domain, "informeddelivery.usps.com")) {
    return "usps_digest";
  }
  if (isDomainOrSubdomain(domain, "usps.com") || isDomainOrSubdomain(domain, "usps.gov")) return "usps_alert";
  if (isDomainOrSubdomain(domain, "ups.com")) return "ups";
  if (isDomainOrSubdomain(domain, "fedex.com")) return "fedex";
  if (AMAZON_DOMAIN_RE.test(domain)) return "amazon";
  if (DHL_DOMAINS.some((d) => isDomainOrSubdomain(domain, d))) return "dhl";
  return null;
}

/** Subjects distinctive enough to classify a message whose sender is unknown. */
const SUBJECT_RULES: readonly [RegExp, CarrierSourceKind][] = [
  [/^Your Daily Digest for\b/i, "usps_digest"],
  [/^USPS(?:®|\(R\)|&reg;)?\s+(?:Item Delivered|Expected Delivery|Delivery Exception|Available for Pickup|Out for Delivery)/i, "usps_alert"],
  [/^(?:UPS Update:|UPS Pre-Arrival:|Your UPS (?:Package|Parcel)s? (?:was|were) delivered)/i, "ups"],
  [/^(?:FedEx Shipment \d{10,}|FedEx Delivery Exception)/i, "fedex"],
  [/^(?:(?:Shipped|Delivered|Out for delivery|Ordered|Arriving today|Delivery update):\s*(?:["“”]|Your Amazon)|Your Amazon(?:\.[a-z.]+)? order\b)/i, "amazon"],
  [/^DHL On Demand Delivery\b/i, "dhl"],
];

/** Carrier kind for an email: by sender, else by a carrier-template subject, else null (generic). */
export function classifyEmail(from: string, subject: string): CarrierSourceKind | null {
  const bySender = classifySender(from);
  if (bySender) return bySender;
  for (const [re, kind] of SUBJECT_RULES) if (re.test(subject.trim())) return kind;
  return null;
}

/** The carrier behind a source kind (Amazon emails default to Amazon until a carrier number says otherwise). */
export function carrierOfKind(kind: CarrierSourceKind): CarrierId {
  switch (kind) {
    case "usps_digest":
    case "usps_alert":
      return "usps";
    default:
      return kind;
  }
}

/** Carrier hint for a sender domain that has no dedicated parser (OnTrac, LaserShip). */
export function carrierHintForSender(from: string): CarrierId | undefined {
  const domain = domainOf(from);
  if (isDomainOrSubdomain(domain, "ontrac.com") || isDomainOrSubdomain(domain, "lasership.com")) return "ontrac";
  return undefined;
}
