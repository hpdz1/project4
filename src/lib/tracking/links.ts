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
  "mailnolist",
  "listenumeroslt",
  "okurijono",
  "reqcodeno1",
  "consignmentnumber",
]);
const NUMBERED_TRACKING_PARAM_RE = /^(?:inquirynumber|qtc_tlabels|tracknums?)\d+$/;

/**
 * Generic names that mean "tracking number" only on a carrier's own host.
 * Elsewhere they are often click-tracking or analytics IDs (?trackingId=...).
 */
const CARRIER_HOST_PARAMS = new Set(["number", "tracking", "trackingid", "tracking_id"]);

/**
 * Parameter names that carry the number on one carrier's tracking pages only
 * (research/worldwide/tracking-formats-intl.md §7). Too generic ("id", "q",
 * "code", "item") to trust anywhere else, including the carrier's other pages.
 */
const HOST_PARAMS: readonly [domain: string, params: readonly string[]][] = [
  ["tracking.postnord.com", ["id"]],
  ["yuntrack.com", ["id"]],
  ["auspost.com.au", ["id"]],
  ["mydhl.express.dhl", ["id"]],
  ["sporing.posten.no", ["q"]],
  ["sporing.bring.no", ["q"]],
  ["bring.com", ["packagenumber"]],
  ["bring.se", ["packagenumber"]],
  ["bring.dk", ["packagenumber"]],
  ["postnl.nl", ["b"]],
  ["postnl.post", ["barcodes"]],
  ["laposte.fr", ["code", "idship"]],
  ["anpost.com", ["item"]],
  ["gls-group.eu", ["match", "parcelnumber", "matchparcelnumber"]],
  ["gls-group.com", ["match", "parcelnumber", "matchparcelnumber"]],
  ["gls-pakete.de", ["match", "trackingnumber"]],
  ["track.dpd.co.uk", ["reference", "parcelnumber"]],
  ["tracking.dpd.co.uk", ["reference", "parcelnumber"]],
  ["dpdgroup.com", ["parcelnumber"]],
  ["dpd.com", ["parcelnumber"]],
  ["my.dpd.de", ["parcelno"]],
  ["emonitoring.poczta-polska.pl", ["numer"]],
  ["purolator.com", ["pin", "pins", "searchvalue"]],
  ["canadapost-postescanada.ca", ["searchfor"]],
  ["canadapost.ca", ["searchfor"]],
  ["correos.com.br", ["objetos"]],
  ["ctt.pt", ["objects"]],
  ["track.yw56.com.cn", ["nums"]],
  ["member.kms.kuronekoyamato.co.jp", ["pno"]],
  ["kuronekoyamato.co.jp", ["number01", "no01"]],
  ["nzpost.co.nz", ["trackid"]],
  ["myhermes.de", ["trackid", "sendungsid"]],
  ["aramex.com", ["shipmentnumber"]],
  ["bluedart.com", ["trackno"]],
  ["chronopost.fr", ["listenumeros", "numerolt"]],
  ["cs.estafeta.com", ["waybill"]],
  ["trackings.post.japanpost.jp", ["requestno1"]],
  ["track.bpost.cloud", ["itemcode"]],
  ["trace.epost.go.kr", ["post_code"]],
  ["service.epost.go.kr", ["sid1"]],
  ["inpost.pl", ["number"]],
  ["packeta.com", ["id"]],
  ["mojdhl.pl", ["paczki"]],
  ["sprawdz.dhl.com.pl", ["sn"]],
  ["track.dhlecommerce.co.uk", ["con"]],
  ["track.dhlparcel.co.uk", ["con"]],
  // Legacy DHL Paket tracker (nolp.dhl.de/nextt-online-public/set_identcodes.do?idc=...).
  ["dhl.de", ["idc"]],
  // SMSA's templates disagree across sources (?tracknumbers=, ?trackno=, ?awb=).
  ["smsaexpress.com", ["tracknumbers", "trackno"]],
];

/** Parameters whose value names the carrier on branded tracking pages. */
const CARRIER_PARAMS = new Set(["carrier", "courier", "carrier_code", "slug"]);

/**
 * Path (or #fragment path) segments after which a carrier's tracking page puts
 * the number: /tracking/{n}, /sporing/{n}, DPD /parcel/{n}, Australia Post
 * /details/{n}, Royal Mail #/tracking-results/{n}, Poste Italiane
 * #/risultati-spedizioni/{n}, SF #search/bill-number/{n}, ... Only used on
 * carrier hosts.
 */
const TRACK_SEGMENT_RE =
  /^(?:track|tracking|trackings|tracker|trace|sporing|parcel|details?|tracktrace|trackandtrace|tracking-results|risultati-spedizioni|bill-number|waybill-detail|search|package|sendungsinformation|modificarenvio)$/i;

/** Tracking pages whose path segments are tracking numbers (e.g. {shop}.aftership.com/{n}, tracking.packeta.com/en/{n}). */
const TRACKING_ONLY_HOSTS = ["aftership.com", "tracking.packeta.com", "track.4px.com"];

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

/** Whether parameter `name` (lowercased) carries a tracking number on `host`. */
function isNamedParam(name: string, host: string, carrierHost: boolean): boolean {
  if (isTrackingParam(name)) return true;
  if (carrierHost && CARRIER_HOST_PARAMS.has(name)) return true;
  return HOST_PARAMS.some(([domain, params]) => hostIs(host, domain) && params.includes(name));
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
  // Single-page trackers keep their route in the #fragment: "#/search?itemCode={n}", "#/result/0/{n}".
  const hash = url.hash.replace(/^#/, "");
  const hashQueryAt = hash.indexOf("?");
  const hashPath = hashQueryAt >= 0 ? hash.slice(0, hashQueryAt) : hash;
  const params = [...url.searchParams];
  if (hashQueryAt >= 0) params.push(...new URLSearchParams(hash.slice(hashQueryAt + 1)));
  const segments = [...url.pathname.split("/"), ...hashPath.split(/[/&=]/)]
    .map(safeDecode)
    .filter((s) => s.length > 0);

  let urlCarrier = hostCarrier;
  if (!urlCarrier) {
    for (const seg of segments) urlCarrier ??= carrierFromWord(seg);
    for (const [key, value] of params) {
      if (CARRIER_PARAMS.has(key.toLowerCase())) urlCarrier ??= carrierFromWord(value);
    }
  }
  const trackingOnlyHost = TRACKING_ONLY_HOSTS.some((d) => hostIs(host, d));
  const trackingHost = hostCarrier !== null || trackingOnlyHost;

  for (const [key, value] of params) {
    if (depth < MAX_DEPTH && /^\s*(?:https?:\/\/|www\.)/i.test(value)) {
      out.push(...linkCandidates(value.trim(), depth + 1));
      continue;
    }
    const named = isNamedParam(key.toLowerCase(), host, hostCarrier !== null);
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
