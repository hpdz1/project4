/**
 * Shared domain types. Everything that crosses a module boundary
 * (address <-> tracking <-> providers <-> API <-> UI) is defined here.
 */

// ---------------------------------------------------------------------------
// Carriers & tracking numbers
// ---------------------------------------------------------------------------

export type CarrierId =
  | "usps"
  | "ups"
  | "fedex"
  | "dhl"
  | "amazon"
  | "ontrac"
  | "unknown";

export interface DetectedTrackingNumber {
  /** Uppercased, whitespace/dash-stripped tracking number. */
  trackingNumber: string;
  carrier: CarrierId;
  /** Human readable format name, e.g. "UPS 1Z", "USPS IMpb (22 digits)". */
  format: string;
  /**
   * true  = format has a check digit and it validates
   * false = format has a check digit and it does NOT validate (likely typo)
   * null  = format has no check digit (or carrier unknown)
   */
  checksumValid: boolean | null;
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

/** A US address normalized to USPS Publication 28 conventions (uppercase). */
export interface NormalizedAddress {
  /** e.g. "123" (may include fraction or hyphenated ranges such as "12-14"). */
  houseNumber: string | null;
  /** Pre-directional, e.g. "N". */
  preDirectional: string | null;
  /** Street name without suffix/directionals, e.g. "MAIN". */
  streetName: string | null;
  /** Standard suffix abbreviation, e.g. "ST". */
  suffix: string | null;
  /** Post-directional, e.g. "NW". */
  postDirectional: string | null;
  /** Secondary unit designator, e.g. "APT". */
  unitType: string | null;
  /** Secondary unit number, e.g. "4B". */
  unitNumber: string | null;
  /** True when the address is a PO Box ("PO BOX 123" lives in streetName). */
  isPoBox: boolean;
  city: string | null;
  /** Two-letter state/territory code. */
  state: string | null;
  /** 5-digit ZIP. */
  zip5: string | null;
  /** Optional ZIP+4 add-on. */
  zip4: string | null;
  /** Canonical single-line rendering, e.g. "123 N MAIN ST APT 4B, SPRINGFIELD, IL 62701". */
  oneLine: string;
}

/** Where a carrier says a shipment is going. Carriers often redact the street. */
export interface ShipmentDestination {
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}

export type MatchLevel =
  /** Street line and ZIP both match. */
  | "exact"
  /** ZIP5 matches (and nothing else conflicts). */
  | "zip"
  /** City + state match, carrier gave no ZIP. */
  | "city"
  /** Only the state matches; weak signal. */
  | "state"
  /** Carrier destination conflicts with the address (different ZIP/state/city). */
  | "mismatch"
  /** Carrier did not share any destination information. */
  | "unknown";

export interface AddressMatch {
  level: MatchLevel;
  /** Short human explanation, e.g. "Destination ZIP 62701 matches your address". */
  reason: string;
}

// ---------------------------------------------------------------------------
// Shipments
// ---------------------------------------------------------------------------

/** Normalized shipment status (mirrors EasyPost's status vocabulary). */
export type ShipmentStatus =
  | "pre_transit"
  | "in_transit"
  | "out_for_delivery"
  | "available_for_pickup"
  | "delivered"
  | "return_to_sender"
  | "failure"
  | "cancelled"
  | "unknown";

export interface TrackingEvent {
  /** ISO-8601 timestamp. */
  occurredAt: string;
  status: ShipmentStatus;
  message: string;
  location: string | null;
}

export interface Shipment {
  trackingNumber: string;
  carrier: CarrierId;
  status: ShipmentStatus;
  /** Carrier's own wording for the latest status, if any. */
  statusDetail: string | null;
  /** ISO-8601 estimated delivery date/time, if known. */
  estimatedDelivery: string | null;
  /** ISO-8601 actual delivery time, if delivered. */
  deliveredAt: string | null;
  destination: ShipmentDestination | null;
  /** Newest first. */
  events: TrackingEvent[];
  /** Public carrier tracking page. */
  trackingUrl: string | null;
  /** Which provider produced this data ("mock", "easypost", ...). */
  source: string;
}

// ---------------------------------------------------------------------------
// The "check my address" API contract (POST /api/check)
// ---------------------------------------------------------------------------

export interface CheckRequestItem {
  trackingNumber: string;
  /** Optional carrier override; otherwise auto-detected. */
  carrier?: CarrierId;
  /** Optional user label, e.g. "New running shoes". */
  label?: string;
}

export interface CheckRequest {
  /** Free-form single-line US address as typed by the user. */
  address: string;
  items: CheckRequestItem[];
}

/**
 * How a shipment relates to the user's address *right now*:
 *  - arriving_today:   out for delivery / estimated today, destination matches
 *  - on_the_way:       in transit or pre-transit, destination matches
 *  - delivered:        delivered recently, destination matches
 *  - possibly_yours:   active, but destination is unknown or only weakly matches (state)
 *  - elsewhere:        destination conflicts with the address
 *  - needs_attention:  failure / returned / cancelled / pickup needed (matching or unknown destination)
 *  - not_found:        provider could not find this tracking number
 */
export type ShipmentVerdict =
  | "arriving_today"
  | "on_the_way"
  | "delivered"
  | "possibly_yours"
  | "elsewhere"
  | "needs_attention"
  | "not_found";

export interface CheckResultItem {
  trackingNumber: string;
  carrier: CarrierId;
  label: string | null;
  verdict: ShipmentVerdict;
  match: AddressMatch;
  shipment: Shipment | null;
  /** Present when tracking failed (network, invalid number, provider error). */
  error: { code: string; message: string } | null;
}

export interface CheckSummary {
  arrivingToday: number;
  onTheWay: number;
  delivered: number;
  possiblyYours: number;
  elsewhere: number;
  needsAttention: number;
  notFound: number;
  /** One-sentence headline for the UI, e.g. "2 packages are on the way to you". */
  headline: string;
}

export interface CheckResponse {
  address: NormalizedAddress;
  /** How the address was standardized: "census" (validated online) or "local" (parsed offline). */
  addressSource: "census" | "local";
  /** Non-fatal notes about the address, e.g. "No ZIP code given; matching may be less precise". */
  addressWarnings: string[];
  /** "demo" when running on simulated data, "live" with a real provider. */
  mode: "demo" | "live";
  results: CheckResultItem[];
  summary: CheckSummary;
  /** ISO-8601 time the check was performed. */
  checkedAt: string;
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}
