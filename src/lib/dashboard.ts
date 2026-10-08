/**
 * Pure dashboard logic: stored shipments, feed stats and forwarding
 * verifications in, the `DashboardResponse` the dashboard page renders out.
 * All "today" / "yesterday" decisions use the account's time zone.
 * See docs/ARCHITECTURE.md ("src/lib/dashboard.ts").
 */
import { CARRIER_NAMES, trackingUrl } from "@/lib/tracking";
import type {
  AccountView,
  DashboardGroup,
  DashboardResponse,
  DashboardShipment,
  FeedHealth,
  ForwardingVerification,
  ShipmentStatus,
  SourceKind,
  StoredShipment,
} from "@/lib/types";

export interface BuildDashboardInput {
  account: AccountView;
  shipments: StoredShipment[];
  /** Newest email per carrier feed (see `Store.getEmailStats`). */
  feeds: { source: SourceKind; lastSeenAt: string }[];
  verifications: ForwardingVerification[];
  emailsReceived: number;
  lastEmailAt: string | null;
  /** Must be a valid date. */
  now: Date;
  demoMode: boolean;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Delivered packages stay on the dashboard this long after delivery. */
const DELIVERED_RECENT_MS = 72 * HOUR_MS;
/** In-transit / exception packages with no news for longer than this are dropped as stale. */
const ACTIVE_MS = 21 * DAY_MS;
/**
 * A package up to this many calendar days past its expected (or out-for-delivery)
 * date needs attention; older ones are dropped.
 */
const OVERDUE_MAX_DAYS = 7;
/** The Informed Delivery digest is sent Mon–Sat; a gap longer than this means the forwarding probably broke. */
const DIGEST_QUIET_MS = 4 * DAY_MS;
/** Forwarding confirmation codes are only useful for a short while. */
const VERIFICATION_MS = 48 * HOUR_MS;

/** Feeds shown even before their first email. */
const ALWAYS_SHOWN_FEEDS: ReadonlySet<SourceKind> = new Set<SourceKind>(["usps_digest", "ups", "fedex", "amazon"]);
/** Display order of feeds. */
const FEED_ORDER: readonly SourceKind[] = ["usps_digest", "usps_alert", "ups", "fedex", "amazon", "dhl", "generic"];
/** Who sends each per-package feed, for "never seen" hints. */
const FEED_SENDERS: Record<Exclude<SourceKind, "usps_digest">, string> = {
  usps_alert: CARRIER_NAMES.usps,
  ups: CARRIER_NAMES.ups,
  fedex: CARRIER_NAMES.fedex,
  amazon: CARRIER_NAMES.amazon,
  dhl: CARRIER_NAMES.dhl,
  generic: "other carriers",
};

const GROUP_RANK: Record<DashboardGroup, number> = {
  arriving_today: 0,
  on_the_way: 1,
  needs_attention: 2,
  delivered_recently: 3,
};

const SIDE_STATE_HEADLINES: Partial<Record<ShipmentStatus, string>> = {
  exception: "Delivery exception — check the carrier",
  return_to_sender: "Returning to sender",
  available_for_pickup: "Ready for pickup",
};

/** Milliseconds since the epoch, or null when `iso` is missing or unparseable. */
function parseMs(iso: string | null): number | null {
  if (iso === null) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/** Days since 1970-01-01 for a real "YYYY-MM-DD" calendar date, else null. */
function ymdToDay(ymd: string | null): number | null {
  if (ymd === null) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(year, month - 1, day);
  const d = new Date(ms);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return ms / DAY_MS;
}

/** The IANA zone if the runtime knows it, else "UTC". */
function resolveTimeZone(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone }).resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/** Some ICU versions put narrow / no-break spaces in formatted dates ("2:14 PM" with U+202F). */
function plainSpaces(s: string): string {
  return s.replace(/[\u00a0\u202f]/g, " ");
}

/** Calendar helpers bound to one time zone and one "now". */
interface Clock {
  nowMs: number;
  /** Local calendar day (days since epoch) of now. */
  today: number;
  /** Local calendar day of an instant. */
  dayOf(ms: number): number;
  /** "Tue, Oct 13" for a calendar day. */
  formatDay(day: number): string;
  /** "2:14 PM" local time of an instant. */
  formatTime(ms: number): string;
}

function createClock(now: Date, timeZone: string): Clock {
  const tz = resolveTimeZone(timeZone);
  const ymd = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  // Calendar days are stored as UTC midnights, so they are formatted in UTC.
  const dayFormat = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeFormat = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });

  const dayOf = (ms: number): number => {
    const parts = ymd.formatToParts(ms);
    const get = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((p) => p.type === type)?.value);
    return Date.UTC(get("year"), get("month") - 1, get("day")) / DAY_MS;
  };

  const nowMs = now.getTime();
  return {
    nowMs,
    today: dayOf(nowMs),
    dayOf,
    formatDay: (day) => plainSpaces(dayFormat.format(day * DAY_MS)),
    formatTime: (ms) => plainSpaces(timeFormat.format(ms)),
  };
}

/** True when `ms` is at most `maxAgeMs` before now (future times count as recent). */
function isRecent(ms: number | null, maxAgeMs: number, clock: Clock): boolean {
  return ms !== null && clock.nowMs - ms <= maxAgeMs;
}

function withWindow(headline: string, window: string | null): string {
  const w = window?.trim();
  return w ? `${headline} · ${w}` : headline;
}

interface Placement {
  group: DashboardGroup;
  headline: string;
}

/** "today at 2:14 PM" / "yesterday" / "Mon, Oct 5" relative to today. */
function deliveredWhen(ms: number, withTime: boolean, clock: Clock): string {
  const day = clock.dayOf(ms);
  const ago = clock.today - day;
  if (ago <= 0) return withTime ? `today at ${clock.formatTime(ms)}` : "today";
  if (ago === 1) return "yesterday";
  return clock.formatDay(day);
}

function placeDelivered(s: StoredShipment, clock: Clock): Placement | null {
  const deliveredMs = parseMs(s.deliveredAt);
  const ms = deliveredMs ?? parseMs(s.lastEventAt);
  if (ms === null || !isRecent(ms, DELIVERED_RECENT_MS, clock)) return null;
  let headline: string;
  if (deliveredMs !== null) headline = `Delivered ${deliveredWhen(deliveredMs, true, clock)}`;
  // No delivery time: the newest email's date is only a stand-in, so it never gets a clock time.
  else if (s.status === "delivered") headline = `Delivered ${deliveredWhen(ms, false, clock)}`;
  else headline = "Marked as delivered";
  return { group: "delivered_recently", headline };
}

function placeOutForDelivery(s: StoredShipment, clock: Clock): Placement | null {
  const lastMs = parseMs(s.lastEventAt);
  if (lastMs === null) return null;
  const day = clock.dayOf(lastMs);
  const ago = clock.today - day;
  if (ago <= 0) return { group: "arriving_today", headline: withWindow("Out for delivery", s.expectedWindow) };
  if (ago > OVERDUE_MAX_DAYS) return null;
  return {
    group: "needs_attention",
    headline: `Was out for delivery on ${clock.formatDay(day)} — no delivery confirmation yet`,
  };
}

/** pre_transit / in_transit / unknown. */
function placeMoving(s: StoredShipment, clock: Clock): Placement | null {
  const lastMs = parseMs(s.lastEventAt);
  const expected = ymdToDay(s.expectedDelivery);
  let when: string | null = null;

  if (expected !== null) {
    const until = expected - clock.today;
    if (until === 0) return { group: "arriving_today", headline: withWindow("Arriving today", s.expectedWindow) };
    if (until < 0) {
      if (-until > OVERDUE_MAX_DAYS) return null;
      // An email after the expected date (that didn't move the date) means "late", not "silent".
      const heardSince = lastMs !== null && clock.dayOf(lastMs) > expected;
      const tail = heardSince ? "running late. Check with the carrier." : "no update since. Check with the carrier.";
      return { group: "needs_attention", headline: `Expected ${clock.formatDay(expected)} — ${tail}` };
    }
    when = until === 1 ? "tomorrow" : clock.formatDay(expected);
  }

  if (!isRecent(lastMs, ACTIVE_MS, clock)) return null;

  let headline: string;
  if (s.status === "pre_transit") {
    headline = when === null ? "Label created — not shipped yet" : `Label created — expected ${when}`;
  } else {
    headline = when === null ? "On the way" : `Expected ${when}`;
  }
  return { group: "on_the_way", headline };
}

/** Which dashboard group a shipment belongs in and its one-line headline, or null to leave it off. */
function place(s: StoredShipment, clock: Clock): Placement | null {
  if (s.hidden) return null;
  if (s.status === "delivered" || s.userMarkedDelivered) return placeDelivered(s, clock);
  const sideState = SIDE_STATE_HEADLINES[s.status];
  if (sideState !== undefined) {
    if (!isRecent(parseMs(s.lastEventAt), ACTIVE_MS, clock)) return null;
    return { group: "needs_attention", headline: sideState };
  }
  if (s.status === "out_for_delivery") return placeOutForDelivery(s, clock);
  return placeMoving(s, clock);
}

interface Entry {
  shipment: DashboardShipment;
  /** Unparseable times sort as the oldest. */
  lastMs: number;
  deliveredMs: number;
  expectedDay: number | null;
}

/**
 * Group order, then: arriving today = out for delivery first, newest news first;
 * on the way = expected date ascending (undated last); needs attention = newest
 * news first; delivered = most recent delivery first. Ties fall back to id.
 */
function compareEntries(a: Entry, b: Entry): number {
  const rank = GROUP_RANK[a.shipment.group] - GROUP_RANK[b.shipment.group];
  if (rank !== 0) return rank;
  let diff = 0;
  switch (a.shipment.group) {
    case "arriving_today": {
      const ofd = (e: Entry): number => (e.shipment.status === "out_for_delivery" ? 0 : 1);
      diff = ofd(a) - ofd(b) || b.lastMs - a.lastMs;
      break;
    }
    case "on_the_way": {
      const ad = a.expectedDay ?? Number.POSITIVE_INFINITY;
      const bd = b.expectedDay ?? Number.POSITIVE_INFINITY;
      diff = (ad === bd ? 0 : ad < bd ? -1 : 1) || b.lastMs - a.lastMs;
      break;
    }
    case "needs_attention":
      diff = b.lastMs - a.lastMs;
      break;
    case "delivered_recently":
      diff = b.deliveredMs - a.deliveredMs;
      break;
  }
  if (diff !== 0) return diff;
  return a.shipment.id < b.shipment.id ? -1 : a.shipment.id > b.shipment.id ? 1 : 0;
}

function packages(n: number): string {
  return n === 1 ? "1 package is" : `${n} packages are`;
}

/** The big answer line at the top of the dashboard. */
function answerHeadline(arrivingToday: number, onTheWay: number, emailsReceived: number): string {
  const coming = arrivingToday + onTheWay;
  if (coming === 0) {
    return emailsReceived === 0
      ? "Not connected yet — we haven't received any carrier emails."
      : "Nothing on the way right now.";
  }
  if (onTheWay === 0) return `Yes — ${packages(arrivingToday)} arriving today.`;
  if (arrivingToday === 0) return `Yes — ${packages(onTheWay)} on the way.`;
  return `Yes — ${packages(coming)} on the way, ${arrivingToday} arriving today.`;
}

const DIGEST_NEVER_HINT =
  "No Informed Delivery Daily Digest yet — turn on Daily Digest emails in Informed Delivery " +
  "and make sure your filter forwards them here.";

function digestQuietHint(days: number): string {
  const span = days === 1 ? "1 day" : `${days} days`;
  return `No Informed Delivery Daily Digest in ${span} — check that your forwarding filter is still on.`;
}

interface Seen {
  ms: number;
  iso: string;
}

function feedHealth(source: SourceKind, seen: Seen | undefined, clock: Clock): FeedHealth {
  if (source === "usps_digest") {
    if (!seen) return { source, lastSeenAt: null, state: "never", hint: DIGEST_NEVER_HINT };
    if (isRecent(seen.ms, DIGEST_QUIET_MS, clock)) return { source, lastSeenAt: seen.iso, state: "ok", hint: null };
    const days = Math.max(1, clock.today - clock.dayOf(seen.ms));
    return { source, lastSeenAt: seen.iso, state: "quiet", hint: digestQuietHint(days) };
  }
  // Per-package feeds only email when a package is coming, so silence is normal.
  if (seen) return { source, lastSeenAt: seen.iso, state: "ok", hint: null };
  return {
    source,
    lastSeenAt: null,
    state: "never",
    hint: `We'll hear from ${FEED_SENDERS[source]} when a package is headed your way.`,
  };
}

/**
 * One row per feed: the digest, UPS, FedEx and Amazon always, any other feed
 * once it has sent something. Duplicate or unparseable input rows are tolerated
 * (newest parseable time wins).
 */
function buildFeeds(feeds: BuildDashboardInput["feeds"], clock: Clock): FeedHealth[] {
  const newest = new Map<SourceKind, Seen>();
  for (const f of feeds) {
    const ms = parseMs(f.lastSeenAt);
    if (ms === null) continue;
    const seen = newest.get(f.source);
    if (!seen || ms > seen.ms) newest.set(f.source, { ms, iso: f.lastSeenAt });
  }
  return FEED_ORDER.filter((source) => ALWAYS_SHOWN_FEEDS.has(source) || newest.has(source)).map((source) =>
    feedHealth(source, newest.get(source), clock),
  );
}

/** Verifications received in the last 48 hours, newest first. */
function recentVerifications(verifications: ForwardingVerification[], clock: Clock): ForwardingVerification[] {
  return verifications
    .map((v) => ({ v, ms: parseMs(v.receivedAt) }))
    .filter((x): x is { v: ForwardingVerification; ms: number } => isRecent(x.ms, VERIFICATION_MS, clock))
    .sort((a, b) => b.ms - a.ms)
    .map((x) => ({ ...x.v }));
}

/**
 * Builds the dashboard: groups and orders the visible shipments, writes each
 * one's headline, counts the big answer, and reports feed health and recent
 * forwarding confirmations. Pure: all time math uses `now` and
 * `account.timezone` (UTC when the zone is unknown to the runtime).
 */
export function buildDashboard(input: BuildDashboardInput): DashboardResponse {
  const clock = createClock(input.now, input.account.timezone);

  const entries: Entry[] = [];
  for (const s of input.shipments) {
    const placement = place(s, clock);
    if (placement === null) continue;
    const lastMs = parseMs(s.lastEventAt) ?? 0;
    entries.push({
      shipment: {
        ...s,
        group: placement.group,
        trackingUrl: s.trackingNumber ? trackingUrl(s.carrier, s.trackingNumber) : null,
        headline: placement.headline,
      },
      lastMs,
      deliveredMs: parseMs(s.deliveredAt) ?? lastMs,
      expectedDay: ymdToDay(s.expectedDelivery),
    });
  }
  entries.sort(compareEntries);
  const shipments = entries.map((e) => e.shipment);

  const count = (group: DashboardGroup): number => shipments.filter((s) => s.group === group).length;
  const arrivingToday = count("arriving_today");
  const onTheWay = count("on_the_way");

  return {
    account: input.account,
    answer: {
      anythingComing: arrivingToday + onTheWay > 0,
      headline: answerHeadline(arrivingToday, onTheWay, input.emailsReceived),
      arrivingToday,
      onTheWay,
      needsAttention: count("needs_attention"),
      deliveredRecently: count("delivered_recently"),
    },
    shipments,
    feeds: buildFeeds(input.feeds, clock),
    verifications: recentVerifications(input.verifications, clock),
    emailsReceived: input.emailsReceived,
    lastEmailAt: input.lastEmailAt,
    generatedAt: input.now.toISOString(),
    demoMode: input.demoMode,
  };
}
