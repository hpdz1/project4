import type { CarrierId } from "@/lib/types";
import { carrierFromHost, carrierFromWord } from "./carriers";

/**
 * Pulling candidate tracking numbers out of links (carrier tracking pages,
 * branded tracking pages, redirect wrappers). Pure string work: links are
 * never fetched.
 */

/** Where in a link a candidate value came from. */
export type LinkSource =
  /** A query parameter whose name says "tracking number" (tLabels, tracknum, trknbr, AWB, ...). */
  | "param"
  /** A path segment that a tracking page uses for the number (track.amazon.com/tracking/{n}). */
  | "path"
  /** Any other query value or path segment. */
  | "other";

export interface LinkCandidate {
  /** Raw value (URL-decoded, not normalized). May contain spaces. */
  value: string;
  source: LinkSource;
  /** Carrier implied by the host, a carrier word in the path, or a carrier= parameter. */
  urlCarrier: CarrierId | null;
}

export interface FoundLink {
  /** Offsets of the link in the scanned text. */
  start: number;
  end: number;
  candidates: LinkCandidate[];
}

/** http(s) URLs and bare www. links in running text or raw HTML. */
const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const TRAILING_PUNCT_RE = /[.,;:!?)\]}>*'"]+$/;

/** Query parameters that carry a tracking number on any host (lowercased). */
const TRACKING_PARAMS = new Set([
  "tlabels",
  "tlabel",
  "origtracknum",
  "tracknum",
  "tracknums",
  "tracknumber",
  "tracknumbers",
  "trknbr",
  "trackingnumber",
  "trackingnumbers",
  "tracking_number",
  "tracking_numbers",
  "tracking-number",
  "tracking-numbers",
  "tracking-id",
  "awb",
  "piececode",
]);
const NUMBERED_TRACKING_PARAM_RE = /^(?:inquirynumber|qtc_tlabels|tracknums?)\d+$/;

/**
 * Generic names that mean "tracking number" only on a carrier's own host.
 * Elsewhere they are often click-tracking or analytics IDs (?trackingId=...).
 */
const CARRIER_HOST_PARAMS = new Set(["number", "tracking", "trackingid", "tracking_id"]);

/** Parameters whose value names the carrier on branded tracking pages. */
const CARRIER_PARAMS = new Set(["carrier", "courier", "carrier_code", "slug"]);

/** Path segments after which a tracking page puts the number. */
const TRACK_SEGMENT_RE = /^(?:track|tracking|trackings|tracker|trace)$/i;

/** Branded tracking pages whose path segments are tracking numbers (e.g. {shop}.aftership.com/{n}). */
const TRACKING_ONLY_HOSTS = ["aftership.com"];

const MAX_DEPTH = 3;

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function hostIs(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function isTrackingParam(name: string): boolean {
  return TRACKING_PARAMS.has(name) || NUMBERED_TRACKING_PARAM_RE.test(name);
}

/**
 * Splits a parameter value or path segment into candidate pieces. Commas,
 * slashes, pipes, etc. separate numbers ("tLabels=A,B", UPS's "{n}/trackdetails");
 * spaces, dashes and dots stay inside a piece so grouped numbers survive.
 */
function splitValue(value: string): string[] {
  return value
    .split(/[^A-Za-z0-9 \u00A0.-]+/)
    .map((p) => p.trim())
    .filter((p) => /[0-9]/.test(p));
}

function parseUrl(raw: string): URL | null {
  let s = raw.replace(/&amp;/gi, "&").replace(/&#0*38;/g, "&");
  if (/^www\./i.test(s)) s = `https://${s}`;
  try {
    return new URL(s);
  } catch {
    return null;
  }
}

/**
 * Candidate tracking-number values in one URL. Redirect wrappers are unwrapped:
 * a parameter value that is itself a URL (google.com/url?q=, Outlook Safe Links
 * ?url=, Amazon ?U=) and URLs embedded in the path (Proofpoint `__https://…__`,
 * click trackers with an encoded target) are parsed too, up to 3 levels deep.
 */
export function linkCandidates(rawUrl: string, depth = 0): LinkCandidate[] {
  const url = parseUrl(rawUrl);
  if (!url) return [];
  const out: LinkCandidate[] = [];
  const host = url.hostname.toLowerCase();
  const hostCarrier = carrierFromHost(host);
  const segments = [...url.pathname.split("/"), ...url.hash.replace(/^#/, "").split(/[/?&=]/)]
    .map(safeDecode)
    .filter((s) => s.length > 0);

  let urlCarrier = hostCarrier;
  if (!urlCarrier) {
    for (const seg of segments) urlCarrier ??= carrierFromWord(seg);
    for (const [key, value] of url.searchParams) {
      if (CARRIER_PARAMS.has(key.toLowerCase())) urlCarrier ??= carrierFromWord(value);
    }
  }
  const trackingOnlyHost = TRACKING_ONLY_HOSTS.some((d) => hostIs(host, d));
  const trackingHost = hostCarrier !== null || trackingOnlyHost;

  for (const [key, value] of url.searchParams) {
    if (depth < MAX_DEPTH && /^\s*(?:https?:\/\/|www\.)/i.test(value)) {
      out.push(...linkCandidates(value.trim(), depth + 1));
      continue;
    }
    const k = key.toLowerCase();
    const named = isTrackingParam(k) || (hostCarrier !== null && CARRIER_HOST_PARAMS.has(k));
    for (const piece of splitValue(value)) {
      out.push({ value: piece, source: named ? "param" : "other", urlCarrier });
    }
  }

  segments.forEach((seg, i) => {
    const afterTrack = i > 0 && TRACK_SEGMENT_RE.test(segments[i - 1]);
    const source: LinkSource = trackingHost && (afterTrack || trackingOnlyHost) ? "path" : "other";
    for (const piece of splitValue(seg)) out.push({ value: piece, source, urlCarrier });
  });

  if (depth < MAX_DEPTH) {
    // The first embedded URL after the scheme; the recursive call handles deeper nesting.
    const decoded = safeDecode(rawUrl);
    const at = decoded.slice(1).search(/https?:\/\//i);
    if (at >= 0) out.push(...linkCandidates(decoded.slice(at + 1), depth + 1));
  }
  return out;
}

/** Every link in `text` with its offsets and candidate values. */
export function findLinks(text: string): FoundLink[] {
  const links: FoundLink[] = [];
  for (const m of text.matchAll(URL_RE)) {
    const raw = m[0].replace(TRAILING_PUNCT_RE, "");
    const start = m.index ?? 0;
    links.push({ start, end: start + raw.length, candidates: linkCandidates(raw) });
  }
  return links;
}
