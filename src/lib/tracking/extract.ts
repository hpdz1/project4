import type { CarrierId, DetectedTrackingNumber } from "@/lib/types";
import { carrierMentions, lastMentionEnd, sameFamily } from "./carriers";
import {
  CANDIDATE_LENGTHS,
  MAX_CANDIDATE_LENGTH,
  detectAllNormalized,
  isRepeatedChar,
  toPublic,
  type FormatMatch,
} from "./formats";
import { NEGATIVE_RE, PHONE_WORD_RE, POSITIVE_RE, lastMatchEnd } from "./labels";
import { findLinks, type LinkCandidate } from "./links";
import { normalizeTrackingNumber } from "./normalize";

/**
 * Finding tracking numbers in whole emails (text or HTML), in any language,
 * without drowning in order numbers, phone numbers, postcodes and prices.
 *
 * - Links are parsed first: named tracking parameters and tracking-page paths
 *   are trusted; anything else in a link must be a distinctive format. On a
 *   carrier's own host only that carrier's (or a sister company's) formats count.
 * - In free text, distinctive formats (1Z, IMpb, TBA, S10, JJD, 3S, SF, ...)
 *   need only a passing check digit. Short or all-digit formats need a carrier
 *   hint, the carrier's name or (for some) a tracking keyword in the 60
 *   characters before them, and are rejected next to order/phone/price labels
 *   or in phone shapes. See `Evidence` in formats.ts.
 */

export interface FindOptions {
  /** Carrier the email is known to come from (e.g. from the sender address). */
  carrierHint?: CarrierId;
}

/** Characters templates insert to break auto-linking; removed before scanning. */
const INVISIBLE_RE = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;
const NBSP_ENTITY_RE = /&(?:nbsp|#160|#xa0);/gi;

const CONTEXT_CHARS = 60;
/**
 * Most printed groups one number spans ("4201 0282 0000 9261 2901 1318 5417 4685 10"
 * is 9). Bounds the work per token so digit-dense text stays linear.
 */
const MAX_TOKENS_PER_WINDOW = 12;

interface Found {
  pos: number;
  seq: number;
  result: DetectedTrackingNumber;
}

interface Context {
  /** A tracking keyword appears before the candidate. */
  keyword: boolean;
  /** Carriers named before the candidate, nearest first. */
  carriers: CarrierId[];
  /** The label nearest the candidate is a negative one (order #, phone, VAT, ...). */
  negative: boolean;
  /** A phone word ("call", "Tel.", "電話") comes after the last tracking keyword. */
  phoneWord: boolean;
}

function readContext(before: string): Context {
  const lastKeyword = lastMatchEnd(POSITIVE_RE, before);
  const lastLabel = Math.max(lastKeyword, lastMentionEnd(before));
  return {
    keyword: lastKeyword >= 0,
    carriers: carrierMentions(before),
    negative: lastMatchEnd(NEGATIVE_RE, before) > lastLabel,
    phoneWord: lastMatchEnd(PHONE_WORD_RE, before) > lastKeyword,
  };
}

/** True when `carrier` is `c` or a sister company of one of `cs`. */
function inFamily(carrier: CarrierId, cs: readonly (CarrierId | null)[]): boolean {
  return cs.some((c) => c !== null && sameFamily(c, carrier));
}

/**
 * Puts matches for the preferred carriers first (exact carrier before sister
 * company, earlier preference first), keeping detection order otherwise.
 */
function preferCarriers(matches: FormatMatch[], preferred: readonly (CarrierId | null)[]): FormatMatch[] {
  const order = (m: FormatMatch) => {
    for (let i = 0; i < preferred.length; i++) {
      const c = preferred[i];
      if (c === m.carrier) return 2 * i;
      if (c !== null && sameFamily(c, m.carrier)) return 2 * i + 1;
    }
    return 2 * preferred.length;
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
  let all = detectAllNormalized(s);
  // On a carrier's own pages a number is that carrier's (or a sister company's), unless its format is distinctive.
  if (cand.urlCarrier) {
    const own = cand.urlCarrier;
    all = all.filter((m) => m.evidence === "distinctive" || sameFamily(m.carrier, own));
  }
  const usable = preferCarriers(
    all.filter((m) => m.checksumValid !== false),
    [cand.urlCarrier, hint],
  );
  for (const m of usable) {
    if (m.evidence === "distinctive") return toPublic(m);
    if (cand.source === "other") continue;
    if (m.evidence === "context") return toPublic(m);
    if (inFamily(m.carrier, [cand.urlCarrier, hint])) return toPublic(m);
  }
  if (all.some((m) => m.checksumValid === false)) return "drop";
  if (cand.source === "param" && UNRECOGNIZED_RE.test(s) && !isRepeatedChar(s)) {
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
  /** Can be part of a grouped number: has a digit, or is 1-4 uppercase letters ("TBA", "US", "YW"). */
  groupable: boolean;
}

/**
 * "space": a single space/NBSP (or two spaces). "dash": a single dash, or a
 * dot between digit groups (Swiss Post "99.60.132730.02019507"); a number
 * is never cut out of a dash compound (order 113-1234567-1234567, dates).
 */
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

const DIGITS_RE = /^[0-9]+$/;

/** How token i joins token i+1. */
function jointAfter(text: string, tokens: Token[], i: number): Joint {
  const next = tokens[i + 1];
  if (!next || !tokens[i].groupable || !next.groupable) return null;
  const sep = text.slice(tokens[i].end, next.start);
  if (sep === "-") return "dash";
  if (sep === "." && DIGITS_RE.test(tokens[i].text) && DIGITS_RE.test(next.text)) return "dash";
  if (/^(?:[ \t\u00A0\u2007\u2009\u202F]|  )$/.test(sep)) return "space";
  return null;
}

/**
 * All-digit candidates printed like phone numbers: North American 3-3-4 /
 * 1-3-3-4; a "+", "(" or "(0)" in front; an international "00" prefix; a trunk "0"
 * plus area code followed by subscriber groups (030 12345678, 020 7946 0018,
 * 01 23 45 67 89, 03-1234-5678, 0412 345 678); Chinese mobiles 1xx xxxx xxxx;
 * Indian mobiles xxxxx xxxxx.
 */
function looksLikePhone(text: string, raw: string, start: number): boolean {
  if (/[A-Za-z]/.test(raw)) return false;
  const groups = raw.split(/[^0-9]+/).filter(Boolean);
  const shape = groups.map((g) => g.length).join(",");
  if (shape === "3,3,4" || shape === "1,3,3,4") return true;
  if (groups.length >= 2) {
    const digits = groups.join("").length;
    const first = groups[0];
    const lastGroupOk = groups[groups.length - 1].length >= 2;
    // "00" + country code + up to 15 digits (E.164).
    if (/^00[1-9]/.test(first) && digits >= 9 && digits <= 17 && lastGroupOk) return true;
    if (/^0[1-9]/.test(first) && first.length <= 5 && digits >= 9 && digits <= 13 && lastGroupOk) {
      if (!groups.every((g) => g.length === 4)) return true;
    }
    if (shape === "3,4,4" && first.startsWith("1")) return true; // Chinese mobile 1xx xxxx xxxx
    if (shape === "5,5" && /^[6-9]/.test(first)) return true; // Indian mobile 98xxx xxxxx
  }
  const before = text.slice(Math.max(0, start - 6), start);
  // "+1 312...", "(312) ...", and the "(0)" of "+44 (0)20 7946 0018" / "+49 (0)30 12345678".
  return /[+(]\s{0,2}$/.test(before) || /\(0\)\s{0,2}$/.test(before);
}

/** Lengths phone numbers have once their punctuation is gone (national and international forms). */
function isPhoneLength(n: string): boolean {
  return /^[0-9]{8,14}$/.test(n);
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
  start: number,
  end: number,
  standalone: boolean,
  hint: CarrierId | null,
  context: () => Context,
): DetectedTrackingNumber | null {
  const valid = matches.filter((x) => x.checksumValid !== false);
  if (valid.length === 0) return null;
  const raw = text.slice(start, end);
  // When carriers disagree, the ones named nearby go first (the number's own label beats the sender), then the hint.
  const contested = valid.some((m) => !sameFamily(m.carrier, valid[0].carrier));
  const preferred: (CarrierId | null)[] = contested ? [...context().carriers, hint] : [hint];

  for (const m of preferCarriers(valid, preferred)) {
    // Printed tracking numbers are uppercase; lowercase prose ("in 1234567890") is not one.
    if (m.checksumValid === null && /[a-z]/.test(raw)) continue;
    if (m.evidence === "distinctive") return toPublic(m);
    if (!standalone || looksLikePhone(text, raw, start)) continue;
    const ctx = context();
    if (ctx.negative) continue;
    if (isPhoneLength(m.trackingNumber) && ctx.phoneWord) continue;
    const named = inFamily(m.carrier, ctx.carriers);
    const hinted = hint !== null && sameFamily(hint, m.carrier);
    if (m.evidence === "context") {
      if (named || hinted || (ctx.keyword && hint === null)) return toPublic(m);
    } else if (m.evidence === "named") {
      if (named || hinted) return toPublic(m);
    } else if ((named || hinted) && ctx.keyword) {
      return toPublic(m);
    }
  }
  return null;
}

/**
 * True when token `first` continues a printed group run: the token before it
 * is joined to it and has a digit, or it follows an IBAN's country, check
 * digits and bank code ("GB29 NWBK 6016 1331 9268 19").
 */
function gluedToPrevious(tokens: Token[], joints: Joint[], first: number): boolean {
  if (first === 0 || joints[first - 1] === null) return false;
  if (tokens[first - 1].hasDigit) return true;
  return (
    first >= 2 &&
    joints[first - 2] === "space" &&
    /^[A-Z]{4}$/.test(tokens[first - 1].text) &&
    /^[A-Z]{2}[0-9]{2}$/.test(tokens[first - 2].text)
  );
}

function findInText(text: string, hint: CarrierId | null): { pos: number; result: DetectedTrackingNumber }[] {
  const tokens = tokenize(text);
  const joints = tokens.map((_, i) => jointAfter(text, tokens, i));
  const hits: TextHit[] = [];

  for (let first = 0; first < tokens.length; first++) {
    if (!tokens[first].groupable) continue;
    // Never start inside a dash-joined compound (e.g. order 113-1234567-1234567).
    if (first > 0 && joints[first - 1] === "dash") continue;
    const start = tokens[first].start;
    const joinedBefore = gluedToPrevious(tokens, joints, first);
    let context: Context | null = null;
    const readOnce = () => (context ??= readContext(text.slice(Math.max(0, start - CONTEXT_CHARS), start)));
    let s = "";
    for (let last = first; last < tokens.length && last - first < MAX_TOKENS_PER_WINDOW; last++) {
      if (last > first && !joints[last - 1]) break;
      s += tokens[last].text.toUpperCase();
      if (s.length > MAX_CANDIDATE_LENGTH) break;
      if (joints[last] === "dash") continue; // never end inside a dash compound either
      if (!CANDIDATE_LENGTHS.has(s.length) || isRepeatedChar(s)) continue;
      // A window glued to more digits can only be a distinctive number ("Qty 2 9400 1118 ...").
      const standalone = !joinedBefore && !(joints[last] && tokens[last + 1].hasDigit);
      const matches = detectAllNormalized(s, { distinctiveOnly: !standalone });
      if (matches.length === 0) continue;
      const result = acceptFromText(matches, text, start, tokens[last].end, standalone, hint, readOnce);
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

/** `text` with every link replaced by spaces of the same length, so offsets still line up. */
function blankLinks(text: string, links: { start: number; end: number }[]): string {
  const parts: string[] = [];
  let at = 0;
  for (const link of links) {
    parts.push(text.slice(at, link.start), " ".repeat(link.end - link.start));
    at = link.end;
  }
  parts.push(text.slice(at));
  return parts.join("");
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
  // NFKC turns full-width digits and letters (common in Japanese and Chinese emails) into ASCII.
  const clean = text.replace(INVISIBLE_RE, "").replace(NBSP_ENTITY_RE, " ").normalize("NFKC");
  const found: Found[] = [];
  let seq = 0;

  const links = findLinks(clean);
  for (const link of links) {
    for (const cand of link.candidates) {
      const result = fromLinkCandidate(cand, hint);
      if (result) found.push({ pos: link.start, seq: seq++, result });
    }
  }

  for (const { pos, result } of findInText(blankLinks(clean, links), hint)) {
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
