import type { CarrierId, DetectedTrackingNumber } from "@/lib/types";
import { carriersMentioned } from "./carriers";
import { detectAllNormalized, toPublic, type FormatMatch } from "./formats";
import { findLinks, type LinkCandidate } from "./links";
import { normalizeTrackingNumber } from "./normalize";

/**
 * Finding tracking numbers in whole emails (text or HTML) without drowning in
 * order numbers, phone numbers, ZIP codes and prices.
 *
 * - Links are parsed first: named tracking parameters and tracking-page paths
 *   are trusted; anything else in a link must be a distinctive format.
 * - In free text, distinctive formats (1Z, IMpb, TBA, S10, OnTrac C/D, ...)
 *   need only a passing check digit. Short or all-digit formats need a carrier
 *   hint, the carrier's name or a tracking keyword in the 60 characters before
 *   them, and are rejected next to order/phone/price labels or in phone shapes.
 */

export interface FindOptions {
  /** Carrier the email is known to come from (e.g. from the sender address). */
  carrierHint?: CarrierId;
}

/** Characters templates insert to break auto-linking; removed before scanning. */
const INVISIBLE_RE = /[​-‍⁠﻿­]/g;
const NBSP_ENTITY_RE = /&(?:nbsp|#160|#xa0);/gi;

const CONTEXT_CHARS = 60;
const MAX_CANDIDATE_LENGTH = 40;

/** Labels that introduce a tracking number. */
const POSITIVE_RE = /\b(?:track|tracking|tracked|waybill|awb|shipment|shipments|consignment)\b/gi;
/** Labels that introduce something that is *not* a tracking number. */
const NEGATIVE_RE =
  /\b(?:order|orders|invoice|phone|call|tel|telephone|fax|mobile|sku|item|zip|zipcode|card|account|acct|ref|reference|receipt|customer|member|rewards|gift|model|serial|isbn|upc|qty|quantity|price|total|subtotal|amount|transaction|pin)\b/gi;

/** Words that mean a nearby 10/11-digit number is a phone number. */
const PHONE_WORD_RE = /\b(?:call|phone|tel|telephone|fax|mobile|cell|sms|dial|hotline|toll[\s-]?free)\b/i;

/** Carrier names also count as labels ("FedEx: 1234…"). "UPS" is case-sensitive ("follow-ups"). */
const CARRIER_LABEL_RE = /\b(?:usps|postal service|fed\s?ex|dhl|amazon|on\s?trac|laser\s?ship)\b/gi;
const UPS_LABEL_RE = /\bUPS\b/g;

interface Found {
  pos: number;
  seq: number;
  result: DetectedTrackingNumber;
}

interface Context {
  /** A tracking keyword appears before the candidate. */
  keyword: boolean;
  /** Carriers named before the candidate. */
  carriers: Set<CarrierId>;
  /** The label nearest the candidate is a negative one (order #, phone, ...). */
  negative: boolean;
}

function lastIndex(re: RegExp, text: string): number {
  let last = -1;
  for (const m of text.matchAll(re)) last = (m.index ?? 0) + m[0].length;
  return last;
}

function readContext(before: string): Context {
  const carriers = carriersMentioned(before);
  const lastPositive = Math.max(
    lastIndex(POSITIVE_RE, before),
    lastIndex(CARRIER_LABEL_RE, before),
    lastIndex(UPS_LABEL_RE, before),
  );
  const lastNegative = lastIndex(NEGATIVE_RE, before);
  return {
    keyword: lastIndex(POSITIVE_RE, before) >= 0,
    carriers,
    negative: lastNegative > lastPositive,
  };
}

/** Puts matches for the preferred carriers first, keeping detection order otherwise. */
function preferCarriers(matches: FormatMatch[], preferred: (CarrierId | null)[]): FormatMatch[] {
  const order = (m: FormatMatch) => {
    const i = preferred.indexOf(m.carrier);
    return i === -1 ? preferred.length : i;
  };
  return matches
    .map((m, i) => ({ m, i }))
    .sort((a, b) => order(a.m) - order(b.m) || a.i - b.i)
    .map((x) => x.m);
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

/** Shape we accept as "some tracking number" from a named tracking parameter we can't classify. */
const UNRECOGNIZED_RE = /^(?=(?:[A-Z]*[0-9]){4})[A-Z0-9]{8,40}$/;

function classifyLinkValue(
  s: string,
  cand: LinkCandidate,
  hint: CarrierId | null,
): DetectedTrackingNumber | null | "drop" {
  const all = detectAllNormalized(s);
  const usable = preferCarriers(
    all.filter((m) => m.checksumValid !== false),
    [cand.urlCarrier, hint],
  );
  for (const m of usable) {
    if (m.evidence === "distinctive") return toPublic(m);
    if (cand.source === "other") continue;
    if (m.evidence === "context") return toPublic(m);
    if (m.carrier === cand.urlCarrier || m.carrier === hint) return toPublic(m);
  }
  if (all.some((m) => m.checksumValid === false)) return "drop";
  if (cand.source === "param" && UNRECOGNIZED_RE.test(s)) {
    const carrier = cand.urlCarrier ?? "unknown";
    return {
      trackingNumber: s,
      carrier,
      format: "Unrecognized format (from a tracking link)",
      checksumValid: null,
    };
  }
  return null;
}

function fromLinkCandidate(cand: LinkCandidate, hint: CarrierId | null): DetectedTrackingNumber | null {
  const whole = normalizeTrackingNumber(cand.value);
  if (/^[A-Z0-9]+$/.test(whole)) {
    const r = classifyLinkValue(whole, cand, hint);
    if (r === "drop") return null;
    if (r) return r;
  }
  // "1Z... extra words" or several space-separated numbers in one value.
  const parts = cand.value.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  for (const part of parts) {
    const s = normalizeTrackingNumber(part);
    if (!/^[A-Z0-9]+$/.test(s)) continue;
    const r = classifyLinkValue(s, cand, hint);
    if (r && r !== "drop") return r;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Free text
// ---------------------------------------------------------------------------

interface Token {
  text: string;
  start: number;
  end: number;
  hasDigit: boolean;
  /** Can be part of a grouped number: has a digit, or is 1–4 uppercase letters ("TBA", "US", "YW"). */
  groupable: boolean;
}

type Joint = "space" | "dash" | null;

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const m of text.matchAll(/[A-Za-z0-9]+/g)) {
    const start = m.index ?? 0;
    const hasDigit = /[0-9]/.test(m[0]);
    tokens.push({
      text: m[0],
      start,
      end: start + m[0].length,
      hasDigit,
      groupable: hasDigit || /^[A-Z]{1,4}$/.test(m[0]),
    });
  }
  return tokens;
}

/** How token i joins token i+1: a single space/NBSP (or two spaces) or a single dash. */
function jointAfter(text: string, tokens: Token[], i: number): Joint {
  const next = tokens[i + 1];
  if (!next || !tokens[i].groupable || !next.groupable) return null;
  const sep = text.slice(tokens[i].end, next.start);
  if (sep === "-") return "dash";
  if (/^(?:[ \t    ]|  )$/.test(sep)) return "space";
  return null;
}

/** All-digit candidates that look like phone numbers: 3-3-4 / 1-3-3-4 groups, or "+"/"(" in front. */
function looksLikePhone(text: string, raw: string, start: number): boolean {
  if (/[A-Za-z]/.test(raw)) return false;
  const groups = raw
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((g) => g.length)
    .join(",");
  if (groups === "3,3,4" || groups === "1,3,3,4") return true;
  const prefix = text.slice(Math.max(0, start - 3), start).trimEnd();
  return /[+(]$/.test(prefix);
}

/** 10 digits, or 11 starting with the US country code 1. */
function isPhoneLength(n: string): boolean {
  return /^(?:1?[0-9]{10})$/.test(n);
}

interface TextHit {
  first: number;
  last: number;
  length: number;
  result: DetectedTrackingNumber;
}

function acceptFromText(
  matches: FormatMatch[],
  text: string,
  tokens: Token[],
  first: number,
  last: number,
  joints: Joint[],
  hint: CarrierId | null,
): DetectedTrackingNumber | null {
  const start = tokens[first].start;
  const raw = text.slice(start, tokens[last].end);
  let context: Context | null = null;
  const standalone =
    !(first > 0 && joints[first - 1] && tokens[first - 1].hasDigit) &&
    !(joints[last] && tokens[last + 1].hasDigit);

  for (const m of preferCarriers(
    matches.filter((x) => x.checksumValid !== false),
    [hint],
  )) {
    // Printed tracking numbers are uppercase; lowercase prose ("in 1234567890") is not one.
    if (m.checksumValid === null && /[a-z]/.test(raw)) continue;
    if (m.evidence === "distinctive") return toPublic(m);
    if (!standalone || looksLikePhone(text, raw, start)) continue;
    const before = text.slice(Math.max(0, start - CONTEXT_CHARS), start);
    if (isPhoneLength(m.trackingNumber) && PHONE_WORD_RE.test(before)) continue;
    context ??= readContext(before);
    if (context.negative) continue;
    const named = context.carriers.has(m.carrier);
    const hinted = hint === m.carrier;
    if (m.evidence === "context") {
      if (named || hinted || (context.keyword && (hint === null || hinted))) return toPublic(m);
    } else if ((named || hinted) && context.keyword) {
      return toPublic(m);
    }
  }
  return null;
}

function findInText(text: string, hint: CarrierId | null): { pos: number; result: DetectedTrackingNumber }[] {
  const tokens = tokenize(text);
  const joints = tokens.map((_, i) => jointAfter(text, tokens, i));
  const hits: TextHit[] = [];

  for (let first = 0; first < tokens.length; first++) {
    if (!tokens[first].groupable) continue;
    // Never start inside a dash-joined compound (e.g. order 113-1234567-1234567).
    if (first > 0 && joints[first - 1] === "dash") continue;
    let s = "";
    for (let last = first; last < tokens.length; last++) {
      if (last > first && !joints[last - 1]) break;
      s += tokens[last].text.toUpperCase();
      if (s.length > MAX_CANDIDATE_LENGTH) break;
      if (joints[last] === "dash") continue; // never end inside a dash compound either
      if (s.length < 10) continue;
      const matches = detectAllNormalized(s);
      if (matches.length === 0) continue;
      const result = acceptFromText(matches, text, tokens, first, last, joints, hint);
      if (result) hits.push({ first, last, length: s.length, result });
    }
  }

  // Longest accepted reading wins; overlapping shorter readings are dropped.
  hits.sort((a, b) => b.length - a.length || a.first - b.first);
  const taken: TextHit[] = [];
  for (const hit of hits) {
    if (taken.some((t) => hit.first <= t.last && t.first <= hit.last)) continue;
    taken.push(hit);
  }
  return taken.map((t) => ({ pos: tokens[t.first].start, result: t.result }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Find tracking numbers in free text and in tracking links (carrier URLs,
 * branded tracking pages, redirect wrappers). Results are deduped by
 * normalized number, in order of first appearance; candidates whose check
 * digit fails are dropped. `carrierHint` (the carrier the email is from)
 * lets that carrier's short formats through without a nearby keyword and wins
 * when a number fits several carriers.
 */
export function findTrackingNumbers(text: string, opts: FindOptions = {}): DetectedTrackingNumber[] {
  const hint = opts.carrierHint && opts.carrierHint !== "unknown" ? opts.carrierHint : null;
  const clean = text.replace(INVISIBLE_RE, "").replace(NBSP_ENTITY_RE, " ");
  const found: Found[] = [];
  let seq = 0;

  const links = findLinks(clean);
  for (const link of links) {
    for (const cand of link.candidates) {
      const result = fromLinkCandidate(cand, hint);
      if (result) found.push({ pos: link.start, seq: seq++, result });
    }
  }

  // Scan the text with links blanked out (same length, so offsets still line up).
  let blanked = clean;
  for (const link of links) {
    blanked = blanked.slice(0, link.start) + " ".repeat(link.end - link.start) + blanked.slice(link.end);
  }
  for (const { pos, result } of findInText(blanked, hint)) {
    found.push({ pos, seq: seq++, result });
  }

  found.sort((a, b) => a.pos - b.pos || a.seq - b.seq);
  const byNumber = new Map<string, DetectedTrackingNumber>();
  for (const { result } of found) {
    const existing = byNumber.get(result.trackingNumber);
    if (!existing) byNumber.set(result.trackingNumber, result);
    else if (existing.carrier === "unknown" && result.carrier !== "unknown") {
      byNumber.set(result.trackingNumber, result); // Map keeps the first insertion position.
    }
  }
  return [...byNumber.values()];
}
