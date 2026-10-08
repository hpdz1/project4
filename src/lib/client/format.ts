/**
 * Pure display helpers for the radar UI: relative times, clock times,
 * sign-in links, tracking-number truncation and labels. No Date.now(): the
 * caller passes `now` (the dashboard uses the server's `generatedAt`).
 */
import type {
  DashboardGroup,
  DashboardShipment,
  FeedHealth,
  ForwardingVerification,
  ShipmentStatus,
  SourceKind,
} from "@/lib/types";
import type { Tone } from "@/components/ui/Badge";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function toMs(value: Date | string | number): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return Date.parse(value);
}

/** "1 email", "3 emails". */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/** Browsers' ICU puts narrow/thin no-break spaces before AM/PM; use plain spaces. */
function plainSpaces(text: string): string {
  return text.replace(/[   ]/g, " ");
}

/**
 * "just now", "5 minutes ago", "2 hours ago", "yesterday", "3 days ago",
 * then a date ("Sep 3" this year, "Sep 3, 2025" otherwise). Times slightly in
 * the future (clock skew) read as "just now". Null for an unparseable time.
 */
export function formatRelativeTime(
  iso: string,
  now: Date | string | number,
  timeZone?: string,
): string | null {
  const then = Date.parse(iso);
  const nowMs = toMs(now);
  if (Number.isNaN(then) || Number.isNaN(nowMs)) return null;
  const diff = nowMs - then;
  if (diff < MINUTE_MS) return "just now";
  if (diff < HOUR_MS) return `${plural(Math.floor(diff / MINUTE_MS), "minute")} ago`;
  if (diff < DAY_MS) return `${plural(Math.floor(diff / HOUR_MS), "hour")} ago`;
  if (diff < 2 * DAY_MS) return "yesterday";
  if (diff < 30 * DAY_MS) return `${Math.floor(diff / DAY_MS)} days ago`;
  const sameYear =
    yearIn(then, timeZone) === yearIn(nowMs, timeZone);
  return `on ${plainSpaces(
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
      ...(timeZone ? { timeZone } : {}),
    }).format(new Date(then)),
  )}`;
}

function yearIn(ms: number, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(ms));
}

/** "2:14 PM" in `timeZone` (default: the viewer's). Null for an unparseable time. */
export function formatClockTime(iso: string, timeZone?: string): string | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return plainSpaces(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      ...(timeZone ? { timeZone } : {}),
    }).format(new Date(ms)),
  );
}

// ---------------------------------------------------------------------------
// Sign-in keys
// ---------------------------------------------------------------------------

/**
 * Keys are opaque tokens (base64url, hex or similar); this only rejects
 * obvious junk before asking the server, which does the real check.
 */
const KEY_RE = /^[A-Za-z0-9._~+/=-]{16,512}$/;

export function isPlausibleAccountKey(key: string): boolean {
  return KEY_RE.test(key);
}

/** The personal sign-in link. The key travels in the fragment, which browsers never send to servers. */
export function signInLink(origin: string, accountKey: string): string {
  return `${origin.replace(/\/+$/, "")}/signin#key=${encodeURIComponent(accountKey)}`;
}

/** The key from a "#key=…" fragment (with or without the "#"), or null. */
export function keyFromHash(hash: string): string | null {
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  for (const part of fragment.split("&")) {
    const eq = part.indexOf("=");
    if (eq < 0 || part.slice(0, eq) !== "key") continue;
    let value: string;
    try {
      value = decodeURIComponent(part.slice(eq + 1)).trim();
    } catch {
      return null;
    }
    return isPlausibleAccountKey(value) ? value : null;
  }
  return null;
}

/**
 * Accepts what people paste: the whole sign-in link, just the "#key=…" part,
 * or the bare key (surrounding spaces and quotes ignored). Null if no
 * plausible key is found.
 */
export function accountKeyFromInput(input: string): string | null {
  const text = input.trim().replace(/^["'<]+|[">']+$/g, "");
  if (!text) return null;
  const hashAt = text.indexOf("#");
  if (hashAt >= 0) return keyFromHash(text.slice(hashAt));
  if (text.startsWith("key=")) return keyFromHash(text);
  return isPlausibleAccountKey(text) ? text : null;
}

// ---------------------------------------------------------------------------
// Shipments
// ---------------------------------------------------------------------------

/** Shorten long tracking numbers in the middle: "9400111899…28497". */
export function truncateMiddle(text: string, max = 20): string {
  if (text.length <= max) return text;
  const keep = Math.max(2, max - 1);
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  return `${text.slice(0, head)}…${text.slice(text.length - tail)}`;
}

export const GROUP_ORDER: readonly DashboardGroup[] = [
  "arriving_today",
  "on_the_way",
  "needs_attention",
  "delivered_recently",
];

export const GROUP_LABELS: Readonly<Record<DashboardGroup, string>> = {
  arriving_today: "Arriving today",
  on_the_way: "On the way",
  needs_attention: "Needs attention",
  delivered_recently: "Delivered recently",
};

export interface ShipmentGroup {
  group: DashboardGroup;
  label: string;
  shipments: DashboardShipment[];
}

/** Non-empty groups in display order; shipments keep the server's order within a group. */
export function groupShipments(shipments: readonly DashboardShipment[]): ShipmentGroup[] {
  return GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    shipments: shipments.filter((s) => s.group === group),
  })).filter((g) => g.shipments.length > 0);
}

export const STATUS_DISPLAY: Readonly<Record<ShipmentStatus, { label: string; tone: Tone }>> = {
  pre_transit: { label: "Label created", tone: "neutral" },
  in_transit: { label: "In transit", tone: "info" },
  out_for_delivery: { label: "Out for delivery", tone: "info" },
  available_for_pickup: { label: "Ready for pickup", tone: "warning" },
  delivered: { label: "Delivered", tone: "success" },
  exception: { label: "Exception", tone: "danger" },
  return_to_sender: { label: "Returning", tone: "danger" },
  unknown: { label: "Status unknown", tone: "neutral" },
};

/** Status badge for a shipment; a user's "Got it" reads as delivered. */
export function shipmentStatusDisplay(
  shipment: Pick<DashboardShipment, "status" | "userMarkedDelivered">,
): { label: string; tone: Tone } {
  if (shipment.userMarkedDelivered && shipment.status !== "delivered") {
    return { label: "Marked received", tone: "success" };
  }
  return STATUS_DISPLAY[shipment.status] ?? STATUS_DISPLAY.unknown;
}

/** The line under the carrier name: who sent it, what it is, or the order number. */
export function shipmentTitle(
  shipment: Pick<DashboardShipment, "shipper" | "description" | "orderRef">,
): string {
  const shipper = shipment.shipper?.trim();
  const description = shipment.description?.trim();
  if (shipper && description) return `${description} — from ${shipper}`;
  if (description) return description;
  if (shipper) return `From ${shipper}`;
  if (shipment.orderRef) return `Order ${shipment.orderRef}`;
  return "Package";
}

/** The delivery window, unless the headline already mentions it. */
export function extraWindow(
  shipment: Pick<DashboardShipment, "expectedWindow" | "headline">,
): string | null {
  const w = shipment.expectedWindow?.trim();
  if (!w) return null;
  return shipment.headline.includes(w) ? null : w;
}

export const SOURCE_LABELS: Readonly<Record<SourceKind, string>> = {
  usps_digest: "USPS Informed Delivery Daily Digest",
  usps_alert: "USPS package alerts",
  ups: "UPS",
  fedex: "FedEx",
  amazon: "Amazon",
  dhl: "DHL",
  generic: "Other shipping emails",
};

/**
 * Feed rows worth showing for an account: USPS feeds we've never heard from
 * are hidden outside the US, where Informed Delivery doesn't exist.
 */
export function visibleFeeds<T extends Pick<FeedHealth, "source" | "state">>(feeds: readonly T[], country: string): T[] {
  if (country === "US") return [...feeds];
  return feeds.filter((f) => !(f.state === "never" && (f.source === "usps_digest" || f.source === "usps_alert")));
}

// ---------------------------------------------------------------------------
// Forwarding confirmations
// ---------------------------------------------------------------------------

const PROVIDER_NAMES: Readonly<Record<ForwardingVerification["provider"], string>> = {
  gmail: "Gmail",
  yahoo: "Yahoo Mail",
  icloud: "iCloud Mail",
  outlook: "Outlook",
  other: "Your email provider",
};

export function providerName(provider: ForwardingVerification["provider"]): string {
  return PROVIDER_NAMES[provider] ?? PROVIDER_NAMES.other;
}

/** One sentence telling the user what to do with a forwarding confirmation. */
export function describeVerification(v: ForwardingVerification): string {
  const who = providerName(v.provider);
  const known = v.provider !== "other";
  const where = known ? who : "your email settings";
  if (v.code && v.link) {
    return `${who} sent a confirmation code: ${v.code} — paste it in ${where}, or open the confirmation link.`;
  }
  if (v.code) {
    return `${who} sent a confirmation code: ${v.code} — paste it where ${known ? `${who} asks` : "your email settings ask"} for it.`;
  }
  if (v.link) {
    const page = known ? `${who}'s` : "your provider's";
    return `${who} sent a confirmation link. Open it and confirm on ${page} page to turn forwarding on.`;
  }
  return `${who} sent a forwarding confirmation, but we couldn't read a code or link from it. Check your email settings.`;
}

/** Only https links are ever rendered (ingest already restricts them to the provider's domain). */
export function safeExternalUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
