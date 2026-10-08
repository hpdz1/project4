import type { DetectedTrackingNumber, ShipmentStatus } from "@/lib/types";
import { findTrackingNumbers } from "@/lib/tracking";
import { findExpectedDate, parseDateAt } from "../dates";
import { htmlToText, extractLinks } from "../html";
import { combineStatus, statusFromText } from "../status";
import {
  MAX_SCAN_CHARS,
  cleanShipper,
  draft,
  draftsFor,
  expectedFrom,
  lead,
  plausible,
  preferCarrier,
  trackingNumbersIn,
  type ParseContext,
  type ParserResult,
  type ShipmentDraft,
} from "./common";

/**
 * USPS: the Informed Delivery Daily Digest (many packages, one email a day)
 * and per-package tracking emails from auto-reply@usps.com.
 * See research/carrier-emails.md §1.
 */

// ---------------------------------------------------------------------------
// Daily Digest
// ---------------------------------------------------------------------------

type Section = "today" | "soon" | "outbound" | "awaiting";

interface DigestItem {
  number: DetectedTrackingNumber;
  shipper: string | null;
  section: Section | null;
  expected: string | null;
  outForDelivery: boolean;
}

/** Ids may carry Gmail's "m_<digits>" prefix after a manual forward. */
const SECTION_RE = /id\s*=\s*["']?(?:m_\d+)?(today|soon|outbound|awaiting-sender)-package-div/gi;
const SHIPPER_SPLIT_RE = /(?=<[a-z][a-z0-9]*\b[^<>]*\bid\s*=\s*["']?(?:m_\d+)?pra-shipper-name-td-id)/i;
/** Element content up to its closing tag; bounded so a missing close tag can't make the scan quadratic. */
const SHIPPER_RE = /\bid\s*=\s*["']?(?:m_\d+)?pra-shipper-name-td-id["']?[^<>]*>([\s\S]{0,400}?)<\/(?:p|td|span|div)>/i;
const ETA_RE = /\bid\s*=\s*["']?(?:m_\d+)?pra-expected-delivery-date["']?[^<>]*>([\s\S]{0,400}?)<\/(?:p|td|span|div)>/i;
const TODAY_SPAN_RE = /\bid\s*=\s*["']?(?:m_\d+)?today-date-span-id["']?[^<>]*>([\s\S]{0,400}?)<\/(?:span|p|td|div)>/i;
const SUBJECT_DATE_RE = /Daily Digest for\s+(.+?)(?:\s+is ready to view)?\s*$/i;

function sectionOf(raw: string): Section {
  return raw.toLowerCase() === "awaiting-sender" ? "awaiting" : (raw.toLowerCase() as Section);
}

function digestNumbers(fragment: string): DetectedTrackingNumber[] {
  const text = `${htmlToText(fragment).slice(0, 20_000)}\n${extractLinks(fragment).join("\n").slice(0, 20_000)}`;
  return plausible(findTrackingNumbers(text, { carrierHint: "usps" }));
}

/** 2022+ template: section containers and pra-* ids around each package. */
function itemsFromDigestHtml(html: string, ref: string | null): DigestItem[] {
  const marks = [...html.matchAll(SECTION_RE)].map((m) => ({ at: m.index ?? 0, section: sectionOf(m[1]) }));
  const items: DigestItem[] = [];
  marks.forEach((mark, i) => {
    const sectionHtml = html.slice(mark.at, i + 1 < marks.length ? marks[i + 1].at : html.length);
    for (const chunk of sectionHtml.split(SHIPPER_SPLIT_RE)) {
      const numbers = digestNumbers(chunk);
      if (numbers.length === 0) continue;
      const shipperHtml = SHIPPER_RE.exec(chunk)?.[1];
      if (!shipperHtml) {
        // Section container without per-package ids (unverified 2025 markup): read its lines instead.
        items.push(...itemsFromDigestLines(htmlToText(chunk), ref, mark.section));
        continue;
      }
      const etaHtml = ETA_RE.exec(chunk)?.[1];
      const etaText = etaHtml ? htmlToText(etaHtml) : "";
      const expected = etaText ? findExpectedDate(etaText, ref)?.date ?? parseDateAt(etaText, ref)?.date ?? null : null;
      for (const number of numbers) {
        items.push({
          number,
          shipper: cleanShipper(htmlToText(shipperHtml)),
          section: mark.section,
          expected,
          outForDelivery: /out\s+for\s+delivery/i.test(htmlToText(chunk)),
        });
      }
    }
  });
  return items;
}

const HEADINGS: readonly [RegExp, Section][] = [
  [/^(?:arriving|expected)\s+today\b/i, "today"],
  [/^(?:arriving|expected)\s+soon\b/i, "soon"],
  [/^outbound\b/i, "outbound"],
  [/^(?:packages\s+)?awaiting\s+sender\b/i, "awaiting"],
];
const NOT_SHIPPER_RE =
  /^(?:tracking|estimated|expected|delivery|you have|hi\b|hello\b|mail\b|packages?\b|view\b|no packages|coming to you|\d+ item|from:)/i;

/** Older templates and plain text: walk the lines, tracking headings, "From:" lines and the line before each number. */
function itemsFromDigestLines(text: string, ref: string | null, initialSection: Section | null = null): DigestItem[] {
  const items: DigestItem[] = [];
  let section: Section | null = initialSection;
  let fromLine: string | null = null;
  let previous: string | null = null;
  let last: DigestItem[] = [];
  for (const raw of text.slice(0, MAX_SCAN_CHARS).split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const heading = HEADINGS.find(([re]) => re.test(line));
    if (heading) {
      section = heading[1];
      fromLine = null;
      previous = null;
      last = [];
      continue;
    }
    const from = /^(?:from|shipper|sender)\s*:\s*(.+)$/i.exec(line);
    if (from) {
      fromLine = cleanShipper(from[1]);
      continue;
    }
    const numbers = plausible(findTrackingNumbers(line.slice(0, 2_000), { carrierHint: "usps" }));
    if (numbers.length > 0) {
      last = numbers.map((number) => ({
        number,
        shipper: fromLine ?? previous,
        section,
        expected: null,
        outForDelivery: false,
      }));
      items.push(...last);
      fromLine = null;
      previous = null;
      continue;
    }
    if (last.length > 0) {
      const eta = findExpectedDate(line, ref);
      if (eta) for (const item of last) item.expected ??= eta.date;
      if (/out\s+for\s+delivery/i.test(line)) for (const item of last) item.outForDelivery = true;
    }
    previous = NOT_SHIPPER_RE.test(line) || line.length > 80 ? null : cleanShipper(line);
  }
  return items;
}

/** The digest's own date: the "Arriving Today" date span, else the subject, else the email date. */
function digestDate(ctx: ParseContext): string | null {
  const span = TODAY_SPAN_RE.exec(ctx.html)?.[1];
  if (span) {
    const d = parseDateAt(htmlToText(span), ctx.refDate);
    if (d) return d.date;
  }
  const subject = SUBJECT_DATE_RE.exec(ctx.subject)?.[1];
  if (subject) {
    const d = parseDateAt(subject, ctx.refDate);
    if (d) return d.date;
  }
  return ctx.refDate;
}

/**
 * Informed Delivery Daily Digest: one update per incoming package (outbound
 * ones are skipped). Shipper from the digest's shipper line or "From:" line;
 * "Arriving/Expected Today" packages are expected on the digest date, others
 * on their "Estimated Delivery" date; packages awaiting the sender are
 * pre-transit.
 */
export function parseUspsDigest(ctx: ParseContext): ParserResult {
  let items = ctx.html ? itemsFromDigestHtml(ctx.html, ctx.refDate) : [];
  if (items.length === 0 && ctx.htmlText) items = itemsFromDigestLines(ctx.htmlText, ctx.refDate);
  if (items.length === 0 && ctx.text) items = itemsFromDigestLines(ctx.text, ctx.refDate);
  if (items.length === 0) return { updates: [], note: "no packages in digest" };

  const today = digestDate(ctx);
  const updates: ShipmentDraft[] = [];
  for (const item of items) {
    if (item.section === "outbound") continue;
    let status: ShipmentStatus = "in_transit";
    if (item.section === "awaiting") status = "pre_transit";
    if (item.outForDelivery) status = "out_for_delivery";
    updates.push(
      draft(item.number.carrier, {
        trackingNumber: item.number.trackingNumber,
        shipper: item.shipper,
        status,
        expectedDelivery: item.section === "today" ? today : item.expected,
      }),
    );
  }
  return updates.length > 0 ? { updates } : { updates, note: "only outbound packages in digest" };
}

// ---------------------------------------------------------------------------
// Per-package tracking emails
// ---------------------------------------------------------------------------

/**
 * USPS tracking emails ("USPS® Expected Delivery on …", "USPS® Item Delivered, …",
 * "USPS® Delivery Exception …"): one update per tracking number. A number whose
 * check digit fails is ignored (anonymized subjects), the valid one in the body wins.
 */
export function parseUspsAlert(ctx: ParseContext): ParserResult {
  const numbers = preferCarrier(trackingNumbersIn(ctx, "usps"), "usps");
  if (numbers.length === 0) return { updates: [], note: "no tracking numbers found" };
  const status = combineStatus(statusFromText(ctx.subject), statusFromText(lead(ctx)));
  const { expectedDelivery, expectedWindow } = expectedFrom(ctx);
  return {
    updates: draftsFor(numbers, {
      status,
      expectedDelivery: status === "delivered" ? null : expectedDelivery,
      expectedWindow: status === "delivered" ? null : expectedWindow,
    }),
  };
}
