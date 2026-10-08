/**
 * Dates in carrier emails.
 *
 * Calendar dates are plain "YYYY-MM-DD" strings (the calendar date at the
 * delivery address); no time zone math happens on them. Phrases without a
 * year ("Tue, Oct 13", "10/13", "Friday") and relative words ("today") are
 * resolved against a reference date: the email's own date at the delivery
 * address.
 */

const DAY_MS = 86_400_000;

const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;
const WEEKDAY_PREFIXES = ["su", "mo", "tu", "we", "th", "fr", "sa"] as const;
const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** Month names and abbreviations ("Sept." included). */
const MONTH = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?`;
/** Weekday names and abbreviations. */
const WEEKDAY = String.raw`(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|weds|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\.?`;
/** An optional leading weekday: "Tuesday, " / "Thu " / "Sat. ". */
const LEAD_WEEKDAY = String.raw`(?:(${WEEKDAY})(?![a-z])[,\s]+)?`;

const ISO_AT_RE = /^\s*(\d{4})-(\d{2})-(\d{2})(?!\d)/;
const NUMERIC_AT_RE = new RegExp(String.raw`^\s*${LEAD_WEEKDAY}(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?(?![\d/])`, "i");
const MONTH_DAY_AT_RE = new RegExp(
  String.raw`^\s*${LEAD_WEEKDAY}(${MONTH})\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?(?![\d:])`,
  "i",
);
const DAY_MONTH_AT_RE = new RegExp(
  String.raw`^\s*${LEAD_WEEKDAY}(\d{1,2})(?:st|nd|rd|th)?\s+(${MONTH})(?![a-z])(?:,?\s+(\d{4}))?(?![\d:])`,
  "i",
);
const RELATIVE_AT_RE = /^\s*(today|tonight|tomorrow)(?![a-z])/i;
const WEEKDAY_AT_RE = new RegExp(String.raw`^\s*(${WEEKDAY})(?![a-z])`, "i");

// ---------------------------------------------------------------------------
// Calendar helpers
// ---------------------------------------------------------------------------

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

function ymd(y: number, m: number, d: number): string {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

function splitYmd(s: string): [number, number, number] {
  return [Number(s.slice(0, 4)), Number(s.slice(5, 7)), Number(s.slice(8, 10))];
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function isValidYmd(y: number, m: number, d: number): boolean {
  return Number.isInteger(y) && y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

function dayNumber(s: string): number {
  const [y, m, d] = splitYmd(s);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** The UTC calendar date of an instant. */
export function utcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `ymd` plus `days` calendar days. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = splitYmd(date);
  return utcDate(new Date(Date.UTC(y, m - 1, d + days)));
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(date: string): number {
  const [y, m, d] = splitYmd(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** True for a well-formed, existing calendar date "YYYY-MM-DD". */
export function isCalendarDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = splitYmd(s);
  return isValidYmd(y, m, d);
}

function weekdayIndex(name: string): number {
  return WEEKDAY_PREFIXES.indexOf(name.slice(0, 2).toLowerCase() as (typeof WEEKDAY_PREFIXES)[number]);
}

function monthIndex(name: string): number {
  return MONTH_NAMES.indexOf(name.slice(0, 3).toLowerCase() as (typeof MONTH_NAMES)[number]) + 1;
}

/**
 * The year for a month/day printed without one: the year that puts the date
 * within [ref - 30 days, ref + 330 days]. A weekday printed next to the date
 * ("Monday, January 4") breaks ties. Null when the day doesn't exist.
 */
export function inferYear(month: number, day: number, ref: string, weekday?: number): string | null {
  const refYear = Number(ref.slice(0, 4));
  const refDay = dayNumber(ref);
  const candidates = [refYear - 1, refYear, refYear + 1]
    .filter((y) => isValidYmd(y, month, day))
    .map((y) => ymd(y, month, day));
  if (candidates.length === 0) return null;
  const pick = (list: string[]) =>
    list.find((c) => dayNumber(c) >= refDay - 30 && dayNumber(c) <= refDay + 330) ??
    list.reduce((best, c) => (Math.abs(dayNumber(c) - refDay) < Math.abs(dayNumber(best) - refDay) ? c : best));
  if (weekday !== undefined && weekday >= 0) {
    const matching = candidates.filter((c) => weekdayOf(c) === weekday);
    if (matching.length > 0) return pick(matching);
  }
  return pick(candidates);
}

function fullYear(raw: string): number {
  const n = Number(raw);
  return raw.length === 2 ? 2000 + n : n;
}

function resolve(month: number, day: number, year: string | undefined, ref: string | null, weekdayName?: string): string | null {
  if (year) {
    const y = fullYear(year);
    return isValidYmd(y, month, day) ? ymd(y, month, day) : null;
  }
  if (!ref) return null;
  return inferYear(month, day, ref, weekdayName ? weekdayIndex(weekdayName) : undefined);
}

// ---------------------------------------------------------------------------
// Phrases
// ---------------------------------------------------------------------------

export interface DateMatch {
  /** YYYY-MM-DD */
  date: string;
  /** Offset just past the matched phrase in the input. */
  end: number;
}

/**
 * Parses a date phrase at the start of `text` (leading whitespace allowed):
 * "Tuesday, October 13", "Tue, Oct 13", "10/13/2026", "10/13", "October 13, 2026",
 * "13 October 2026", "2026-10-13", "Today", "Tomorrow", or a bare weekday
 * (next occurrence, today included). `ref` is the email's local date; without
 * it only phrases that carry a year can be resolved.
 */
export function parseDateAt(text: string, ref: string | null): DateMatch | null {
  let m = ISO_AT_RE.exec(text);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return isValidYmd(y, mo, d) ? { date: ymd(y, mo, d), end: m[0].length } : null;
  }
  m = NUMERIC_AT_RE.exec(text);
  if (m) {
    const date = resolve(Number(m[2]), Number(m[3]), m[4], ref, m[1]);
    return date ? { date, end: m[0].length } : null;
  }
  m = MONTH_DAY_AT_RE.exec(text);
  if (m) {
    const date = resolve(monthIndex(m[2]), Number(m[3]), m[4], ref, m[1]);
    return date ? { date, end: m[0].length } : null;
  }
  m = DAY_MONTH_AT_RE.exec(text);
  if (m) {
    const date = resolve(monthIndex(m[3]), Number(m[2]), m[4], ref, m[1]);
    return date ? { date, end: m[0].length } : null;
  }
  if (!ref) return null;
  m = RELATIVE_AT_RE.exec(text);
  if (m) {
    const date = m[1].toLowerCase() === "tomorrow" ? addDays(ref, 1) : ref;
    return { date, end: m[0].length };
  }
  m = WEEKDAY_AT_RE.exec(text);
  if (m) {
    const diff = (weekdayIndex(m[1]) - weekdayOf(ref) + 7) % 7;
    return { date: addDays(ref, diff), end: m[0].length };
  }
  return null;
}

/** `parseDateAt` without the offset. */
export function parseDatePhrase(text: string, ref: string | null): string | null {
  return parseDateAt(text, ref)?.date ?? null;
}

/**
 * Labels that introduce an expected delivery date. "Previously expected" is
 * excluded so a rescheduled date wins over the old one.
 */
const EXPECTED_LABEL_RE = new RegExp(
  String.raw`(?<!previously\s)\b(?:` +
    [
      String.raw`estimated\s+delivery(?:\s+date)?(?:\s+is)?(?:\s+on)?`,
      String.raw`expected\s+delivery(?:\s+date)?(?:\s+is)?(?:\s+(?:on|by))?`,
      String.raw`scheduled\s+delivery(?:\s+date)?(?:\s+(?:on|by))?`,
      String.raw`scheduled\s+for\s+delivery(?:\s+on)?`,
      String.raw`delivery\s+(?:date|estimate|scheduled\s+for)`,
      String.raw`guaranteed\s+delivery(?:\s+date)?`,
      String.raw`standard\s+transit`,
      String.raw`(?:now\s+)?arriving(?:\s+(?:on|by))?`,
      String.raw`arrives(?:\s+(?:on|by))?`,
      String.raw`will\s+arrive(?:\s+(?:on|by))?`,
      String.raw`should\s+arrive(?:\s+(?:on|by))?`,
      String.raw`expected\s+(?:to\s+arrive|to\s+be\s+delivered|arrival)(?:\s+(?:on|by))?`,
      String.raw`now\s+expected(?:\s+(?:on|by))?`,
      String.raw`will\s+be\s+delivered(?:\s+(?:on|by))?`,
      String.raw`out\s+for\s+delivery\s+on`,
      String.raw`expects\s+to\s+deliver(?:\s+your\s+(?:package|item))?(?:\s+(?:on|by))?`,
      String.raw`get\s+it\s+by`,
    ].join("|") +
    String.raw`)(?![a-z])`,
  "gi",
);

/** Separators and filler between a label and its date. */
const AFTER_LABEL_RE = /^[\s:：\-–—]*(?:(?:updated|on|by|is)(?![a-z])[\s:]*)*/i;
const RANGE_SEP_RE = /^\s*(?:-|–|—|to|through|until)\s*/i;
const DAY_RANGE_RE = /^\s*[-–—]\s*(\d{1,2})(?![\d:]|\s*[ap]\.?m)/i;

export interface ExpectedDateMatch extends DateMatch {
  /** Offset of the label that introduced the date. */
  index: number;
}

/**
 * Finds the first labeled expected-delivery date in `text`
 * ("Scheduled Delivery: Thursday 10/08/2026", "Arriving Monday",
 * "Now expected October 9 - October 10"). For a range the later date is
 * returned (the latest the package should arrive). "Pending" is skipped.
 */
export function findExpectedDate(text: string, ref: string | null): ExpectedDateMatch | null {
  for (const label of text.matchAll(EXPECTED_LABEL_RE)) {
    const labelEnd = (label.index ?? 0) + label[0].length;
    const filler = AFTER_LABEL_RE.exec(text.slice(labelEnd))?.[0].length ?? 0;
    const start = labelEnd + filler;
    const first = parseDateAt(text.slice(start, start + 80), ref);
    if (!first) continue;
    let date = first.date;
    let end = start + first.end;
    const rest = text.slice(end, end + 60);
    const dayRange = DAY_RANGE_RE.exec(rest);
    const sep = RANGE_SEP_RE.exec(rest);
    if (dayRange) {
      const [y, m] = splitYmd(date);
      const d2 = Number(dayRange[1]);
      if (isValidYmd(y, m, d2) && d2 > splitYmd(date)[2]) {
        date = ymd(y, m, d2);
        end += dayRange[0].length;
      }
    } else if (sep) {
      const second = parseDateAt(rest.slice(sep[0].length), ref);
      if (second && second.date >= date) {
        date = second.date;
        end += sep[0].length + second.end;
      }
    }
    return { date, end, index: label.index ?? 0 };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Time windows
// ---------------------------------------------------------------------------

const AMPM = String.raw`([ap])\.?\s?m\b\.?`;
const WINDOW_RE = new RegExp(
  String.raw`(?<![\d:/.])(\d{1,2})(?::(\d{2}))?\s*(?:${AMPM})?\s*(?:-|–|—|to|and)\s*(\d{1,2})(?::(\d{2}))?\s*${AMPM}`,
  "gi",
);
const BY_TIME_RE = new RegExp(String.raw`\b(?:by|before)\s+(\d{1,2})(?::(\d{2}))?\s*${AMPM}`, "i");
const END_OF_DAY_RE = /\bby\s+(?:the\s+)?end\s+of\s+(?:the\s+)?day\b/i;
const WINDOW_CONTEXT_RE = /deliver|arriv|expect|schedul|estimat|window|today|tomorrow/i;

function formatTime(h: string, m: string | undefined, ap: string): string | null {
  const hour = Number(h);
  const minute = m === undefined ? 0 : Number(m);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  return `${hour}:${pad(minute)} ${ap.toUpperCase()}M`;
}

/** First delivery time window in `text`, normalized ("2:15 PM - 6:15 PM", "by 9:00 PM", "by end of day"). */
export function parseTimeWindow(text: string): string | null {
  for (const m of text.matchAll(WINDOW_RE)) {
    if (m[2] === undefined && m[3] === undefined) continue; // "10 - 6 PM" is too vague
    const toAp = m[6].toLowerCase();
    // "10:30 - 2:30 PM" starts in the morning; "2:30 - 6:30 PM" doesn't.
    const fromAp = m[3] ?? (Number(m[1]) % 12 > Number(m[4]) % 12 ? (toAp === "p" ? "a" : "p") : toAp);
    const from = formatTime(m[1], m[2], fromAp);
    const to = formatTime(m[4], m[5], toAp);
    if (from && to) return `${from} - ${to}`;
  }
  const by = BY_TIME_RE.exec(text);
  if (by) {
    const t = formatTime(by[1], by[2], by[3]);
    if (t) return `by ${t}`;
  }
  if (END_OF_DAY_RE.test(text)) return "by end of day";
  return null;
}

/**
 * Delivery window near an expected-date match (`anchor` = offset just past
 * it), else the first window in `text` that follows delivery wording.
 */
export function findDeliveryWindow(text: string, anchor?: number): string | null {
  if (anchor !== undefined) {
    const near = parseTimeWindow(text.slice(anchor, anchor + 120));
    if (near) return near;
  }
  for (const re of [WINDOW_RE, new RegExp(BY_TIME_RE.source, "gi"), new RegExp(END_OF_DAY_RE.source, "gi")]) {
    for (const m of text.matchAll(re)) {
      const at = m.index ?? 0;
      if (!WINDOW_CONTEXT_RE.test(text.slice(Math.max(0, at - 100), at))) continue;
      const window = parseTimeWindow(m[0]);
      if (window) return window;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Email Date headers and time zones
// ---------------------------------------------------------------------------

const RFC2822_RE =
  /^\s*(?:[a-z]{3,9},?\s+)?(\d{1,2})\s+([a-z]{3,9})\.?\s+(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{2}:?\d{2}|[a-z]{1,5})?/i;
const ISO_DATETIME_RE =
  /^\s*(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?\s*$/i;

const NAMED_ZONES: Record<string, number> = {
  UT: 0, UTC: 0, GMT: 0, Z: 0,
  EST: -300, EDT: -240, CST: -360, CDT: -300, MST: -420, MDT: -360, PST: -480, PDT: -420,
};

function zoneOffset(zone: string | undefined): number | null {
  if (!zone) return null;
  const numeric = /^([+-])(\d{2}):?(\d{2})$/.exec(zone);
  if (numeric) {
    const minutes = Number(numeric[2]) * 60 + Number(numeric[3]);
    if (minutes > 14 * 60) return null;
    return numeric[1] === "-" ? -minutes : minutes;
  }
  return NAMED_ZONES[zone.toUpperCase()] ?? null;
}

export interface MailDate {
  date: Date;
  /** Offset of the sender's clock from UTC, in minutes, when the header says. */
  offsetMinutes: number | null;
}

/**
 * Parses an email Date header (RFC 2822, e.g. "Thu, 8 Oct 2026 09:14:02 -0700 (PDT)")
 * or an ISO-8601 timestamp. Times without a zone are read as UTC. Null for
 * anything else or for years outside 1990-2200.
 */
export function parseMailDate(raw: string): MailDate | null {
  let m = RFC2822_RE.exec(raw);
  if (m) {
    const month = monthIndex(m[2]);
    if (month < 1) return null;
    const year = m[3].length === 2 ? (Number(m[3]) < 50 ? 2000 : 1900) + Number(m[3]) : Number(m[3]);
    return build(year, month, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0), zoneOffset(m[7]));
  }
  m = ISO_DATETIME_RE.exec(raw);
  if (m) {
    return build(
      Number(m[1]), Number(m[2]), Number(m[3]),
      Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0),
      zoneOffset(m[7]),
    );
  }
  return null;
}

function build(y: number, mo: number, d: number, h: number, mi: number, s: number, offset: number | null): MailDate | null {
  if (!isValidYmd(y, mo, d) || y < 1990 || h > 23 || mi > 59 || s > 60) return null;
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, s) - (offset ?? 0) * 60_000);
  return { date, offsetMinutes: offset };
}

/** True when `timeZone` is an IANA zone this runtime knows. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

/** Offset of `timeZone` from UTC at `date`, in minutes. */
export function zoneOffsetMinutes(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60_000);
}

/** Calendar date of `date` in `timeZone`. */
export function localDateIn(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return ymd(p.year, p.month, p.day);
}

/** Calendar date of `date` on a clock `offsetMinutes` from UTC. */
export function localDateAtOffset(date: Date, offsetMinutes: number): string {
  return utcDate(new Date(date.getTime() + offsetMinutes * 60_000));
}

/** The instant when the wall clock in `timeZone` shows `date` at hour:minute. */
export function zonedTime(date: string, hour: number, minute: number, timeZone: string): Date {
  const [y, m, d] = splitYmd(date);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  let instant = guess - zoneOffsetMinutes(new Date(guess), timeZone) * 60_000;
  // Re-check once: the offset can differ on the other side of a DST change.
  instant = guess - zoneOffsetMinutes(new Date(instant), timeZone) * 60_000;
  return new Date(instant);
}

/** RFC 2822 Date header for `date` as seen in `timeZone`, e.g. "Thu, 08 Oct 2026 07:05:00 -0500". */
export function formatMailDate(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  const offset = zoneOffsetMinutes(date, timeZone);
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  const weekday = SHORT_WEEKDAYS[weekdayOf(ymd(p.year, p.month, p.day))];
  return (
    `${weekday}, ${pad(p.day)} ${SHORT_MONTHS[p.month - 1]} ${p.year} ` +
    `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)} ${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`
  );
}
