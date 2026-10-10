import type { CarrierId } from "@/lib/types";
import { normalizeTrackingNumber } from "./normalize";
import { NATIONAL_POST, parseS10 } from "./s10";

/** Display names for carriers. */
export const CARRIER_NAMES: Record<CarrierId, string> = {
  // North America
  usps: "USPS",
  ups: "UPS",
  fedex: "FedEx",
  dhl: "DHL Express",
  dhl_ecommerce: "DHL eCommerce",
  amazon: "Amazon",
  ontrac: "OnTrac",
  canada_post: "Canada Post",
  purolator: "Purolator",
  estafeta: "Estafeta",
  // Europe
  dhl_paket: "DHL Paket",
  hermes: "Hermes",
  royal_mail: "Royal Mail",
  parcelforce: "Parcelforce",
  evri: "Evri",
  dpd: "DPD",
  gls: "GLS",
  an_post: "An Post",
  postnl: "PostNL",
  bpost: "bpost",
  la_poste: "La Poste / Colissimo",
  chronopost: "Chronopost",
  swiss_post: "Swiss Post",
  austrian_post: "Austrian Post",
  correos: "Correos",
  poste_italiane: "Poste Italiane",
  ctt: "CTT",
  inpost: "InPost",
  poczta_polska: "Poczta Polska",
  packeta: "Packeta",
  postnord: "PostNord",
  posten_bring: "Posten / Bring",
  posti: "Posti",
  ptt: "PTT",
  // Asia-Pacific
  australia_post: "Australia Post",
  nz_post: "NZ Post",
  japan_post: "Japan Post",
  yamato: "Yamato Transport",
  sagawa: "Sagawa Express",
  korea_post: "Korea Post",
  cj_logistics: "CJ Logistics",
  china_post: "China Post",
  cainiao: "Cainiao",
  sf_express: "SF Express",
  yunexpress: "YunExpress",
  yanwen: "Yanwen",
  fourpx: "4PX",
  hongkong_post: "Hongkong Post",
  singpost: "SingPost",
  india_post: "India Post",
  delhivery: "Delhivery",
  blue_dart: "Blue Dart",
  // Latin America, Middle East & Africa
  correios: "Correios",
  aramex: "Aramex",
  emirates_post: "Emirates Post",
  smsa: "SMSA Express",
  israel_post: "Israel Post",
  // Fallbacks
  intl_post: "International post",
  unknown: "Unknown carrier",
};

// ---------------------------------------------------------------------------
// Carrier groups
// ---------------------------------------------------------------------------

/**
 * Carriers that share hosts, emails and numbering with a sister company: a
 * dhl.com link or a "DHL" email can carry a DHL Express, DHL eCommerce or DHL
 * Paket number; royalmail.com tracks Parcelforce; Chronopost belongs to La Poste.
 */
const FAMILY: Partial<Record<CarrierId, string>> = {
  dhl: "dhl",
  dhl_ecommerce: "dhl",
  dhl_paket: "dhl",
  royal_mail: "royal_mail",
  parcelforce: "royal_mail",
  la_poste: "la_poste",
  chronopost: "la_poste",
};

/** True when `a` and `b` are the same carrier or sister companies (see FAMILY). */
export function sameFamily(a: CarrierId, b: CarrierId): boolean {
  if (a === b) return true;
  const fa = FAMILY[a];
  return fa !== undefined && fa === FAMILY[b];
}

// ---------------------------------------------------------------------------
// Tracking pages
// ---------------------------------------------------------------------------

interface PageDef {
  /** Deep link; `{n}` is the URI-encoded number, `{cc}` the destination country (template used only when known). */
  template?: string;
  /** The template is only right for parcels delivered in these countries. */
  templateCountries?: readonly string[];
  /** The carrier's tracking page without the number, for when no deep link is safe. */
  landing?: string;
}

/**
 * Where to send a user to track a number. Sources: research/programs.md Part B
 * and research/worldwide/tracking-formats-intl.md §4/§7.
 *
 * Deep links are used when the template is documented by the carrier or
 * search-indexed (USPS, UPS, Royal Mail's linking page, PostNL's step card,
 * DPD UK), or when the number only goes into the query string or #fragment of
 * a tracking page that the research sources agree on (a page that ignores the
 * parameter still opens on the carrier's tracker). Where an unverified
 * template would put the number in the URL path, we link to the tracking page
 * without the number instead (`landing`), and give nothing when the research
 * has no tracking page at all. The six US templates predate this rule and are
 * kept as they were.
 */
const PAGES: Record<Exclude<CarrierId, "unknown">, PageDef | null> = {
  usps: { template: "https://tools.usps.com/go/TrackConfirmAction?tLabels={n}" },
  ups: { template: "https://www.ups.com/track?loc=en_US&tracknum={n}&requester=ST/trackdetails" },
  fedex: { template: "https://www.fedex.com/fedextrack/?trknbr={n}" },
  dhl: { template: "https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id={n}" },
  dhl_ecommerce: { template: "https://www.dhl.com/global-en/home/tracking.html?tracking-id={n}&submit=1" },
  amazon: { template: "https://track.amazon.com/tracking/{n}" },
  ontrac: { template: "https://www.ontrac.com/tracking/?number={n}" },
  canada_post: {
    template: "https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor={n}",
    landing: "https://www.canadapost-postescanada.ca/track-reperage/en/",
  },
  purolator: { template: "https://www.purolator.com/en/shipping/tracker?pins={n}" },
  estafeta: { template: "https://cs.estafeta.com/es/Tracking/searchByGet?wayBill={n}&isShipmentDetail=True" },
  dhl_paket: { template: "https://www.dhl.de/en/privatkunden/dhl-sendungsverfolgung.html?piececode={n}" },
  hermes: { template: "https://www.myhermes.de/empfangen/sendungsverfolgung/sendungsinformation#{n}" },
  // Royal Mail's own "linking to our website" page; it also tracks Parcelforce numbers.
  royal_mail: { template: "https://www.royalmail.com/portal/rm/track?trackNumber={n}" },
  parcelforce: { template: "https://www.royalmail.com/portal/rm/track?trackNumber={n}" },
  evri: { landing: "https://www.evri.com/track-a-parcel" },
  dpd: { template: "https://track.dpd.co.uk/search?reference={n}", templateCountries: ["GB"] },
  gls: { template: "https://gls-group.eu/EU/en/parcel-tracking?match={n}" },
  an_post: { template: "https://www.anpost.com/Post-Parcels/Track/History?item={n}" },
  // PostNL's documented direct link needs the destination country (B = barcode, D = country).
  postnl: {
    template: "https://postnl.nl/tracktrace/?B={n}&D={cc}&T=C&L=EN",
    landing: "https://www.postnl.nl/en/receiving/parcels/track-and-trace/",
  },
  bpost: { template: "https://track.bpost.cloud/btr/web/#/search?itemCode={n}&lang=en" },
  la_poste: {
    template: "https://www.laposte.fr/outils/suivre-vos-envois?code={n}",
    landing: "https://www.laposte.fr/outils/track-a-parcel",
  },
  chronopost: { template: "https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT={n}" },
  swiss_post: { landing: "https://service.post.ch/ekp-web/ui/entry/search" },
  austrian_post: { landing: "https://www.post.at/en/s/track-and-trace-search" },
  correos: { template: "https://www.correos.es/es/es/herramientas/localizador/envios/detalle?tracking-number={n}" },
  poste_italiane: { template: "https://www.poste.it/cerca/index.html#/risultati-spedizioni/{n}" },
  ctt: { template: "https://www.ctt.pt/feapl_2/app/open/objectSearch/objectSearch.jspx?objects={n}" },
  inpost: { template: "https://inpost.pl/sledzenie-przesylek?number={n}" },
  poczta_polska: { template: "https://emonitoring.poczta-polska.pl/?lang=en&numer={n}" },
  packeta: { landing: "https://tracking.packeta.com/en/" },
  postnord: { template: "https://tracking.postnord.com/en/?id={n}" },
  posten_bring: { landing: "https://sporing.posten.no/" },
  posti: { landing: "https://www.posti.fi/en/tracking" },
  // e-Devlet's official PTT barcode lookup.
  ptt: { landing: "https://www.turkiye.gov.tr/ptt-gonderi-takip" },
  australia_post: { landing: "https://auspost.com.au/mypost/track/" },
  nz_post: { template: "https://www.nzpost.co.nz/tools/tracking?trackid={n}" },
  japan_post: { template: "https://trackings.post.japanpost.jp/services/srv/search/direct?reqCodeNo1={n}&locale=en" },
  yamato: { template: "https://member.kms.kuronekoyamato.co.jp/parcel/detail?pno={n}" },
  sagawa: { template: "https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo={n}" },
  korea_post: {
    template:
      "https://trace.epost.go.kr/xtts/servlet/kpl.tts.common.svl.SttSVL?target_command=kpl.tts.tt.epost.cmd.RetrieveEmsTraceEngCmd&JspURI=%2Fxtts%2Ftt%2Fepost%2Fems%2FEmsSearchResultEng.jsp&POST_CODE={n}",
  },
  cj_logistics: null,
  china_post: { landing: "https://www.ems.com.cn/mailtracking/you_jian_cha_xun.html" },
  cainiao: { template: "https://global.cainiao.com/detail.htm?mailNoList={n}" },
  sf_express: { template: "https://htm.sf-express.com/tw/en/dynamic_function/waybill/#search/bill-number/{n}" },
  yunexpress: { template: "https://www.yuntrack.com/parcelTracking?id={n}" },
  yanwen: { template: "https://track.yw56.com.cn/en/querydel?nums={n}" },
  fourpx: { template: "https://track.4px.com/#/result/0/{n}" },
  hongkong_post: { landing: "https://webapp.hongkongpost.hk/en/mail_tracking2/index.html" },
  singpost: { landing: "https://www.singpost.com/track-items" },
  india_post: null,
  delhivery: { landing: "https://www.delhivery.com/tracking" },
  blue_dart: { template: "https://www.bluedart.com/trackdartresultthirdparty?trackFor=0&trackNo={n}" },
  correios: { template: "https://rastreamento.correios.com.br/app/index.php?objetos={n}" },
  aramex: { template: "https://www.aramex.com/us/en/track/shipments?ShipmentNumber={n}" },
  emirates_post: null,
  smsa: null,
  israel_post: null,
  intl_post: null,
};

export interface TrackingOptions {
  /**
   * ISO 3166-1 alpha-2 country the parcel is delivered in (the account's
   * country). Picks country-specific pages, and sends UPU S10 items to that
   * country's national post, which tracks inbound international mail.
   */
  country?: string;
}

export interface TrackingPage {
  url: string;
  /** False when the page is the carrier's tracker without the number (the user pastes it). */
  includesNumber: boolean;
}

function deepLink(carrier: CarrierId, n: string, country: string | null): TrackingPage | null {
  if (carrier === "unknown") return null;
  const page = PAGES[carrier];
  if (!page?.template) return null;
  if (page.templateCountries && (!country || !page.templateCountries.includes(country))) return null;
  if (page.template.includes("{cc}") && !country) return null;
  const url = page.template.replace("{n}", encodeURIComponent(n)).replace("{cc}", country ?? "");
  return { url, includesNumber: true };
}

function landingPage(carrier: CarrierId): TrackingPage | null {
  if (carrier === "unknown") return null;
  const landing = PAGES[carrier]?.landing;
  return landing ? { url: landing, includesNumber: false } : null;
}

/**
 * The carrier's own public tracking page for `trackingNumber` (or its tracker
 * without the number when no deep link is safe), or null. With
 * `opts.country`, UPU S10 items link to the destination country's post.
 */
export function trackingPage(
  carrier: CarrierId,
  trackingNumber: string,
  opts: TrackingOptions = {},
): TrackingPage | null {
  const n = trackingNumber.trim();
  if (carrier === "unknown" || n === "") return null;
  const country = opts.country && /^[A-Za-z]{2}$/.test(opts.country) ? opts.country.toUpperCase() : null;
  const destPost = country && parseS10(normalizeTrackingNumber(n)) ? (NATIONAL_POST[country] ?? null) : null;
  return (
    (destPost && deepLink(destPost, n, country)) ||
    deepLink(carrier, n, country) ||
    (destPost && landingPage(destPost)) ||
    landingPage(carrier)
  );
}

/**
 * Link to the carrier's own public tracking page for `trackingNumber`, or
 * null for an unknown carrier, an empty number or a carrier without a known
 * tracking page. The number is used as given (callers pass a normalized
 * number) and URI-encoded. See {@link trackingPage} for `opts.country`.
 */
export function trackingUrl(carrier: CarrierId, trackingNumber: string, opts: TrackingOptions = {}): string | null {
  return trackingPage(carrier, trackingNumber, opts)?.url ?? null;
}

// ---------------------------------------------------------------------------
// Hosts
// ---------------------------------------------------------------------------

/** Registrable domains that belong to each carrier (matched on the host suffix). */
const CARRIER_DOMAINS: readonly [string, CarrierId][] = [
  ["usps.com", "usps"],
  ["usps.gov", "usps"],
  ["ups.com", "ups"],
  ["fedex.com", "fedex"],
  ["dhlecs.com", "dhl_ecommerce"],
  ["dhlglobalmail.com", "dhl_ecommerce"],
  ["dhlecommerce.nl", "dhl_ecommerce"],
  ["dhlecommerce.be", "dhl_ecommerce"],
  ["dhlecommerce.co.uk", "dhl_ecommerce"],
  ["dhlparcel.nl", "dhl_ecommerce"],
  ["dhlparcel.be", "dhl_ecommerce"],
  ["dhlparcel.co.uk", "dhl_ecommerce"],
  ["dhl.de", "dhl_paket"],
  ["deutschepost.de", "dhl_paket"],
  ["dhl.com", "dhl"],
  ["express.dhl", "dhl"],
  ["dhl.co.uk", "dhl"],
  ["dhl.fr", "dhl"],
  ["dhl.nl", "dhl"],
  ["dhl.es", "dhl"],
  ["dhl.it", "dhl"],
  ["dhl.com.pl", "dhl"],
  ["ontrac.com", "ontrac"],
  ["lasership.com", "ontrac"],
  ["canadapost-postescanada.ca", "canada_post"],
  ["canadapost.ca", "canada_post"],
  ["postescanada.ca", "canada_post"],
  ["purolator.com", "purolator"],
  ["estafeta.com", "estafeta"],
  ["myhermes.de", "hermes"],
  ["hermesworld.com", "hermes"],
  ["royalmail.com", "royal_mail"],
  ["parcelforce.com", "parcelforce"],
  ["evri.com", "evri"],
  ["dpd.com", "dpd"],
  ["dpdgroup.com", "dpd"],
  ["dpd.de", "dpd"],
  ["dpd.co.uk", "dpd"],
  ["dpdlocal.co.uk", "dpd"],
  ["dpd.fr", "dpd"],
  ["dpd.nl", "dpd"],
  ["dpd.be", "dpd"],
  ["dpd.at", "dpd"],
  ["dpd.ch", "dpd"],
  ["dpd.pl", "dpd"],
  ["dpd.ie", "dpd"],
  ["gls-group.eu", "gls"],
  ["gls-group.com", "gls"],
  ["gls-pakete.de", "gls"],
  ["gls-france.com", "gls"],
  ["gls-italy.com", "gls"],
  ["anpost.com", "an_post"],
  ["anpost.ie", "an_post"],
  ["postnl.nl", "postnl"],
  ["postnl.post", "postnl"],
  ["postnl.be", "postnl"],
  ["bpost.be", "bpost"],
  ["bpost.cloud", "bpost"],
  ["laposte.fr", "la_poste"],
  ["colissimo.fr", "la_poste"],
  ["chronopost.fr", "chronopost"],
  ["post.ch", "swiss_post"],
  ["swisspost.ch", "swiss_post"],
  ["post.at", "austrian_post"],
  ["correos.es", "correos"],
  ["poste.it", "poste_italiane"],
  ["posteitaliane.it", "poste_italiane"],
  ["ctt.pt", "ctt"],
  ["inpost.pl", "inpost"],
  ["inpost.eu", "inpost"],
  ["inpost.co.uk", "inpost"],
  ["inpost.it", "inpost"],
  ["inpost.es", "inpost"],
  ["inpost.fr", "inpost"],
  ["poczta-polska.pl", "poczta_polska"],
  ["pocztapolska.pl", "poczta_polska"],
  ["packeta.com", "packeta"],
  ["zasilkovna.cz", "packeta"],
  ["postnord.com", "postnord"],
  ["postnord.se", "postnord"],
  ["postnord.dk", "postnord"],
  ["postnord.no", "postnord"],
  ["postnord.fi", "postnord"],
  ["posten.no", "posten_bring"],
  ["bring.com", "posten_bring"],
  ["bring.no", "posten_bring"],
  ["bring.se", "posten_bring"],
  ["bring.dk", "posten_bring"],
  ["posti.fi", "posti"],
  ["ptt.gov.tr", "ptt"],
  ["auspost.com.au", "australia_post"],
  ["nzpost.co.nz", "nz_post"],
  ["japanpost.jp", "japan_post"],
  ["kuronekoyamato.co.jp", "yamato"],
  ["sagawa-exp.co.jp", "sagawa"],
  ["epost.go.kr", "korea_post"],
  ["koreapost.go.kr", "korea_post"],
  ["cjlogistics.com", "cj_logistics"],
  ["ems.com.cn", "china_post"],
  ["chinapost.com.cn", "china_post"],
  ["cainiao.com", "cainiao"],
  ["sf-express.com", "sf_express"],
  ["sf-international.com", "sf_express"],
  ["yuntrack.com", "yunexpress"],
  ["yunexpress.com", "yunexpress"],
  ["yw56.com.cn", "yanwen"],
  ["4px.com", "fourpx"],
  ["hongkongpost.hk", "hongkong_post"],
  ["singpost.com", "singpost"],
  ["indiapost.gov.in", "india_post"],
  ["delhivery.com", "delhivery"],
  ["bluedart.com", "blue_dart"],
  ["correios.com.br", "correios"],
  ["aramex.com", "aramex"],
  ["emiratespost.ae", "emirates_post"],
  ["smsaexpress.com", "smsa"],
  ["israelpost.co.il", "israel_post"],
];

/** Amazon's tracking hosts (track.amazon.com, track.amazon.co.uk, ...); retail pages don't count. */
const AMAZON_TRACK_HOST_RE = /^track\.amazon\.(?:com|ca|com\.mx|com\.br|co\.uk|de|fr|it|es|nl|se|pl|com\.be|com\.tr|in|co\.jp|com\.au|sg|ae|sa|eg)$/;

/**
 * Carrier that owns a URL host, or null. Amazon counts only for its tracking
 * hosts (track.amazon.*), not for retail pages such as amazon.com/gp/...
 */
export function carrierFromHost(host: string): CarrierId | null {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (AMAZON_TRACK_HOST_RE.test(h)) return "amazon";
  for (const [domain, carrier] of CARRIER_DOMAINS) {
    if (h === domain || h.endsWith(`.${domain}`)) return carrier;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Carrier names in text
// ---------------------------------------------------------------------------

/**
 * Names (regex sources) that identify a carrier in running text, matched
 * case-insensitively. Latin names must stand alone (no letter or digit on
 * either side); names in CJK, Hangul or Hebrew script match anywhere.
 */
const MENTIONS: readonly [CarrierId, readonly string[]][] = [
  ["usps", ["usps", "u\\.\\s?s\\.\\s?postal", "postal service", "informed delivery"]],
  ["fedex", ["fed\\s?ex"]],
  // Longer names before the names they start with ("DHL Paket" before "DHL", "La Poste Suisse" before "La Poste").
  ["dhl_paket", ["deutsche\\s?post", "dhl[\\s-]?paket", "dhl[\\s-]?päckchen"]],
  ["dhl_ecommerce", ["dhl\\s?e-?commerce", "dhl global mail"]],
  ["dhl", ["dhl"]],
  ["amazon", ["amazon"]],
  ["ontrac", ["on\\s?trac", "laser\\s?ship"]],
  ["canada_post", ["canada\\s?post", "postes[\\s-]canada"]],
  ["purolator", ["purolator"]],
  ["estafeta", ["estafeta"]],
  ["hermes", ["hermes", "myhermes"]],
  ["royal_mail", ["royal\\s?mail"]],
  ["parcelforce", ["parcelforce"]],
  ["evri", ["evri"]],
  ["dpd", ["dpd"]],
  ["gls", ["gls"]],
  ["an_post", ["an\\s?post"]],
  ["postnl", ["post\\s?nl"]],
  ["bpost", ["bpost"]],
  ["swiss_post", ["swiss\\s?post", "post\\.ch", "postlogistics", "schweizerische\\s?post", "la\\s?poste\\s?suisse", "posta\\s?svizzera"]],
  ["la_poste", ["la\\s?poste", "colissimo"]],
  ["chronopost", ["chronopost"]],
  ["austrian_post", ["[öo]sterreichische\\s?post", "austrian\\s?post", "post\\.at"]],
  ["poste_italiane", ["poste\\s?italiane", "poste\\.it"]],
  ["inpost", ["inpost", "paczkomat\\p{L}*"]],
  ["poczta_polska", ["poczta\\s?polska", "pocztex"]],
  ["packeta", ["packeta", "z[áa]silkovna"]],
  ["postnord", ["postnord"]],
  ["posten_bring", ["posten\\s?norge", "posten\\.no"]],
  ["ptt", ["ptt\\s?kargo"]],
  ["australia_post", ["australia\\s?post", "auspost"]],
  ["nz_post", ["nz\\s?post", "new\\s?zealand\\s?post"]],
  ["japan_post", ["japan\\s?post", "日本郵便", "ゆうパック", "ゆうパケット", "郵便局"]],
  ["yamato", ["yamato", "kuroneko", "ヤマト運輸", "クロネコ", "宅急便"]],
  ["sagawa", ["sagawa", "佐川"]],
  ["korea_post", ["korea\\s?post", "우체국", "우정사업본부"]],
  ["cj_logistics", ["cj\\s?logistics", "대한통운"]],
  ["china_post", ["china\\s?post", "中国邮政", "中國郵政"]],
  ["cainiao", ["cainiao", "菜鸟", "菜鳥"]],
  ["sf_express", ["sf[\\s-]?express", "顺丰", "順豐"]],
  ["yunexpress", ["yun\\s?express", "云途"]],
  ["yanwen", ["yanwen", "燕文"]],
  ["fourpx", ["4px"]],
  ["hongkong_post", ["hong\\s?kong\\s?post", "hongkongpost", "香港郵政"]],
  ["singpost", ["singpost", "singapore\\s?post"]],
  ["india_post", ["india\\s?post", "speed\\s?post"]],
  ["delhivery", ["delhivery"]],
  ["blue_dart", ["blue\\s?dart"]],
  ["aramex", ["aramex"]],
  ["emirates_post", ["emirates\\s?post"]],
  ["smsa", ["smsa"]],
  ["israel_post", ["israel\\s?post", "דואר ישראל"]],
];

/**
 * Names that are also ordinary words or abbreviations in some language, so
 * they count only as written by the carrier (case-sensitive): "UPS" vs
 * "follow-ups", "Bring" vs "bring", "Posti" (Finnish for "mail").
 */
const CASED_MENTIONS: readonly [CarrierId, readonly string[]][] = [
  ["ups", ["UPS"]],
  ["ctt", ["CTT"]],
  ["ptt", ["PTT"]],
  ["posti", ["Posti"]],
  ["posten_bring", ["Bring"]],
  ["correos", ["Correos"]],
  ["correios", ["Correios"]],
];

const NOT_WORD = "[\\p{L}\\p{N}]";
const LATIN_ONLY_RE = /^[\x20-\x7EÀ-ɏ\\]*$/;

function mentionRegex(list: readonly [CarrierId, readonly string[]][], flags: string): RegExp {
  const groups = list.map(([carrier, names], i) => {
    const alts = names.map((n) => (LATIN_ONLY_RE.test(n) ? `(?<!${NOT_WORD})(?:${n})(?!${NOT_WORD})` : n));
    return `(?<m${i}>${alts.join("|")})`;
  });
  return new RegExp(groups.join("|"), flags);
}

const MENTION_RE = mentionRegex(MENTIONS, "giu");
const CASED_MENTION_RE = mentionRegex(CASED_MENTIONS, "gu");

function collectMentions(
  re: RegExp,
  list: readonly [CarrierId, readonly string[]][],
  text: string,
  out: { carrier: CarrierId; end: number }[],
): void {
  for (const m of text.matchAll(re)) {
    const groups = m.groups ?? {};
    const i = list.findIndex((_, j) => groups[`m${j}`] !== undefined);
    if (i >= 0) out.push({ carrier: list[i][0], end: (m.index ?? 0) + m[0].length });
  }
}

/** Carriers named in `text`, the one named last (nearest the end) first. */
export function carrierMentions(text: string): CarrierId[] {
  const found: { carrier: CarrierId; end: number }[] = [];
  collectMentions(MENTION_RE, MENTIONS, text, found);
  collectMentions(CASED_MENTION_RE, CASED_MENTIONS, text, found);
  found.sort((a, b) => b.end - a.end);
  return [...new Set(found.map((f) => f.carrier))];
}

/** Carriers named anywhere in `text`. */
export function carriersMentioned(text: string): Set<CarrierId> {
  return new Set(carrierMentions(text));
}

/** End offset of the last carrier name in `text`, or -1. */
export function lastMentionEnd(text: string): number {
  let last = -1;
  for (const re of [MENTION_RE, CASED_MENTION_RE]) {
    for (const m of text.matchAll(re)) last = Math.max(last, (m.index ?? 0) + m[0].length);
  }
  return last;
}

// ---------------------------------------------------------------------------
// Carrier slugs (URL path segments, carrier= parameters)
// ---------------------------------------------------------------------------

const WORDS: Readonly<Record<string, CarrierId>> = {
  usps: "usps",
  ups: "ups",
  fedex: "fedex",
  dhl: "dhl",
  dhlexpress: "dhl",
  dhlecommerce: "dhl_ecommerce",
  dhlglobalmail: "dhl_ecommerce",
  dhlpaket: "dhl_paket",
  dhlde: "dhl_paket",
  dhlgermany: "dhl_paket",
  deutschepost: "dhl_paket",
  amazon: "amazon",
  amazonlogistics: "amazon",
  amazonshipping: "amazon",
  ontrac: "ontrac",
  lasership: "ontrac",
  canadapost: "canada_post",
  postescanada: "canada_post",
  purolator: "purolator",
  estafeta: "estafeta",
  hermes: "hermes",
  hermesde: "hermes",
  myhermes: "hermes",
  royalmail: "royal_mail",
  parcelforce: "parcelforce",
  evri: "evri",
  evriuk: "evri",
  dpd: "dpd",
  dpdde: "dpd",
  dpduk: "dpd",
  dpdfr: "dpd",
  dpdgroup: "dpd",
  gls: "gls",
  glsde: "gls",
  glsgroup: "gls",
  anpost: "an_post",
  postnl: "postnl",
  bpost: "bpost",
  laposte: "la_poste",
  colissimo: "la_poste",
  chronopost: "chronopost",
  swisspost: "swiss_post",
  austrianpost: "austrian_post",
  correos: "correos",
  correosspain: "correos",
  posteitaliane: "poste_italiane",
  ctt: "ctt",
  inpost: "inpost",
  pocztapolska: "poczta_polska",
  packeta: "packeta",
  zasilkovna: "packeta",
  postnord: "postnord",
  bring: "posten_bring",
  posten: "posten_bring",
  postenbring: "posten_bring",
  posti: "posti",
  ptt: "ptt",
  pttkargo: "ptt",
  australiapost: "australia_post",
  auspost: "australia_post",
  nzpost: "nz_post",
  japanpost: "japan_post",
  yamato: "yamato",
  kuroneko: "yamato",
  kuronekoyamato: "yamato",
  sagawa: "sagawa",
  koreapost: "korea_post",
  cjlogistics: "cj_logistics",
  chinapost: "china_post",
  chinaems: "china_post",
  cainiao: "cainiao",
  sfexpress: "sf_express",
  yunexpress: "yunexpress",
  yanwen: "yanwen",
  "4px": "fourpx",
  fourpx: "fourpx",
  hongkongpost: "hongkong_post",
  singpost: "singpost",
  singaporepost: "singpost",
  indiapost: "india_post",
  delhivery: "delhivery",
  bluedart: "blue_dart",
  correios: "correios",
  correiosbr: "correios",
  aramex: "aramex",
  emiratespost: "emirates_post",
  smsa: "smsa",
  smsaexpress: "smsa",
  israelpost: "israel_post",
};

/** Carrier named by a single word (URL path segment or `carrier=` value), e.g. "fedex", "royal-mail". */
export function carrierFromWord(word: string): CarrierId | null {
  const w = word.toLowerCase().replace(/[^a-z0-9]/g, "");
  return Object.prototype.hasOwnProperty.call(WORDS, w) ? WORDS[w] : null;
}
