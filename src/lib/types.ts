/**
 * Shared domain types. Everything that crosses a module boundary
 * (tracking <-> ingest <-> store <-> API <-> UI) is defined here.
 *
 * See docs/ARCHITECTURE.md for how the pieces fit together.
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
   * false = format has a check digit and it does NOT validate (likely typo / not a tracking number)
   * null  = format has no check digit
   */
  checksumValid: boolean | null;
}

// ---------------------------------------------------------------------------
// Shipment status vocabulary
// ---------------------------------------------------------------------------

export type ShipmentStatus =
  /** Label created / shipper has told the carrier it is coming. */
  | "pre_transit"
  | "in_transit"
  | "out_for_delivery"
  | "available_for_pickup"
  | "delivered"
  /** Delay, exception, failed attempt. */
  | "exception"
  | "return_to_sender"
  | "unknown";

// ---------------------------------------------------------------------------
// Email ingest
// ---------------------------------------------------------------------------

/** Which kind of email a shipment update was read from. */
export type SourceKind =
  | "usps_digest" // USPS Informed Delivery Daily Digest
  | "usps_alert" // USPS per-package email (Informed Delivery / USPS tracking notification)
  | "ups" // UPS My Choice / UPS Update emails
  | "fedex" // FedEx Delivery Manager / FedEx tracking emails
  | "amazon" // Amazon shipment notifications
  | "dhl" // DHL Express / On Demand Delivery
  | "generic"; // any other email that contained a recognizable tracking number

/** A provider-neutral inbound email, after webhook payload normalization. */
export interface InboundEmail {
  /** All envelope / header recipients we know of (To, Cc, Delivered-To, X-Forwarded-To, OriginalRecipient...). Lowercased addresses. */
  recipients: string[];
  /** Lowercased address of the From header as received (for auto-forwarded mail this is usually the original sender). */
  from: string;
  /** Display name of the From header, if any. */
  fromName: string | null;
  subject: string;
  /** Plain-text body (may be empty if only HTML was sent). */
  text: string;
  /** HTML body (may be empty). */
  html: string;
  /** Header name (lowercased) -> value. Repeated headers joined with "\n". */
  headers: Record<string, string>;
  /** ISO-8601 time the email was sent (Date header) or received. */
  date: string;
}

/** One fact about one shipment, as read from one email. */
export interface ShipmentUpdate {
  carrier: CarrierId;
  /** Carrier tracking number, normalized (uppercase, no spaces). */
  trackingNumber: string | null;
  /** Retailer order reference when there is no tracking number (e.g. Amazon order 113-1234567-1234567). */
  orderRef: string | null;
  /** Who sent the package, e.g. "ACME OUTDOOR CO" (USPS digest "From:" line, UPS "Shipper"). */
  shipper: string | null;
  /** Item description when known (e.g. Amazon item title). */
  description: string | null;
  /** null = this email didn't say. */
  status: ShipmentStatus | null;
  /** Expected delivery date as YYYY-MM-DD (calendar date at the delivery address). */
  expectedDelivery: string | null;
  /** Free-text delivery window, e.g. "2:15 PM - 6:15 PM". */
  expectedWindow: string | null;
  /** ISO-8601 delivery time when the email reports a delivery. */
  deliveredAt: string | null;
  /** ISO-8601 time of this fact (the email's date). */
  eventAt: string;
  source: SourceKind;
}

/**
 * Email providers make you confirm a forwarding address by sending a code
 * to it. We surface that code to the user in the setup wizard.
 */
export interface ForwardingVerification {
  provider: "gmail" | "yahoo" | "icloud" | "outlook" | "other";
  /** The mailbox that asked to forward to us, if we could read it. */
  requestedBy: string | null;
  code: string | null;
  /** Confirmation link, only if it points at the provider's own domain. */
  link: string | null;
  /** ISO-8601. */
  receivedAt: string;
}

export interface ParsedEmail {
  /** What we recognized the email as. */
  kind: SourceKind | "forwarding_verification" | "ignored";
  updates: ShipmentUpdate[];
  verification: ForwardingVerification | null;
  /** Short machine-friendly note, e.g. "no tracking numbers found". */
  note: string | null;
}

// ---------------------------------------------------------------------------
// Carrier programs ("turn these on once")
// ---------------------------------------------------------------------------

export type ProgramId =
  | "usps_informed_delivery"
  | "ups_my_choice"
  | "fedex_delivery_manager"
  | "amazon_orders"
  | "dhl_on_demand"
  | "ontrac_notifyme"
  | "canada_post_auto_tracking"
  | "royal_mail_app"
  | "evri_app"
  | "dpd_uk_app"
  | "postnl_account"
  | "dhl_paket_de"
  | "australia_post_mypost";

export type ProgramState = "done" | "skipped";

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

/** Public view of an account (never includes the secret key or its hash). */
export interface AccountView {
  id: string;
  /** Full inbound address users forward carrier emails to, e.g. "r-k3j9x2m4q8w1@in.example.com". */
  inboundAddress: string;
  /** ISO 3166-1 alpha-2, e.g. "US". */
  country: string;
  /** ZIP / postcode, if the user gave one. We never store the street address. */
  postalCode: string | null;
  /** State / province code, e.g. "CA". */
  region: string | null;
  /** IANA time zone used to decide what "today" means, e.g. "America/Chicago". */
  timezone: string;
  programs: Partial<Record<ProgramId, ProgramState>>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Stored shipments & the dashboard
// ---------------------------------------------------------------------------

export interface StoredShipment {
  id: string;
  carrier: CarrierId;
  trackingNumber: string | null;
  orderRef: string | null;
  shipper: string | null;
  description: string | null;
  status: ShipmentStatus;
  expectedDelivery: string | null;
  expectedWindow: string | null;
  deliveredAt: string | null;
  /** ISO-8601. */
  firstSeenAt: string;
  /** ISO-8601 time of the newest fact we have. */
  lastEventAt: string;
  /** Source of the newest fact. */
  source: SourceKind;
  /** User said "not mine / hide". */
  hidden: boolean;
  /** User marked it as received. */
  userMarkedDelivered: boolean;
}

export type DashboardGroup =
  | "arriving_today"
  | "on_the_way"
  | "needs_attention"
  | "delivered_recently";

export interface DashboardShipment extends StoredShipment {
  group: DashboardGroup;
  /** Official carrier tracking page, if we can build one. */
  trackingUrl: string | null;
  /** One short human line, e.g. "Expected Tue, Oct 13" or "Delivered yesterday". */
  headline: string;
}

export interface FeedHealth {
  source: SourceKind;
  /** ISO-8601, null if we've never received this kind of email. */
  lastSeenAt: string | null;
  state: "ok" | "quiet" | "never";
  /** Human hint, e.g. "No Informed Delivery digest in 5 days — is your forwarding filter on?" */
  hint: string | null;
}

export interface DashboardResponse {
  account: AccountView;
  /** Big answer for the top of the page. */
  answer: {
    anythingComing: boolean;
    /** e.g. "Yes — 3 packages are on the way (1 arriving today)." */
    headline: string;
    arrivingToday: number;
    onTheWay: number;
    needsAttention: number;
    deliveredRecently: number;
  };
  shipments: DashboardShipment[];
  feeds: FeedHealth[];
  /** Pending forwarding confirmations (Gmail codes etc.) received in the last 48h. */
  verifications: ForwardingVerification[];
  /** Number of carrier emails received so far. */
  emailsReceived: number;
  /** ISO-8601 time of the newest email received, if any. */
  lastEmailAt: string | null;
  /** ISO-8601 server time the response was built. */
  generatedAt: string;
  /** True when DEMO_MODE is on (sample-email seeding is available). */
  demoMode: boolean;
}

// ---------------------------------------------------------------------------
// HTTP API payloads (see docs/ARCHITECTURE.md "HTTP API")
// ---------------------------------------------------------------------------

/** GET/PATCH /api/account, POST /api/session */
export interface AccountResponse {
  account: AccountView;
  demoMode: boolean;
}

/** POST /api/account (201) and POST /api/account/key */
export interface AccountCreatedResponse extends AccountResponse {
  /** The secret sign-in key. Shown once; the server only keeps a hash. */
  accountKey: string;
}

/** POST /api/account */
export interface CreateAccountRequest {
  country: string;
  postalCode?: string | null;
  region?: string | null;
  /** IANA time zone from the browser (Intl.DateTimeFormat().resolvedOptions().timeZone). */
  timezone?: string;
}

/** PATCH /api/account. `null` for a program clears its state. */
export interface UpdateAccountRequest {
  country?: string;
  postalCode?: string | null;
  region?: string | null;
  timezone?: string;
  programs?: Partial<Record<ProgramId, ProgramState | null>>;
}

/** PATCH /api/shipments/[id] */
export interface UpdateShipmentRequest {
  hidden?: boolean;
  delivered?: boolean;
}

export interface ApiError {
  error: { code: string; message: string };
}
