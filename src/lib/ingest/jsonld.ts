import type { CarrierId } from "@/lib/types";
import { detectTrackingNumber, normalizeTrackingNumber } from "@/lib/tracking";
import { isCalendarDate } from "./dates";
import { decodeEntities } from "./html";
import { statusFromSchema } from "./status";
import type { ShipmentDraft } from "./parsers/common";

/**
 * schema.org ParcelDelivery markup (JSON-LD and microdata), the most reliable
 * source when a sender includes it. See research/email.md §1. Markup usually
 * survives auto-forwarding (the original MIME is relayed) but not manual
 * forwards, so text parsing must work without it.
 */

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

/** What one ParcelDelivery node says, flattened. */
export interface ParcelInfo {
  trackingNumber: string | null;
  /** provider (current) or carrier (superseded) name. */
  carrierName: string | null;
  /** hasDeliveryMethod, e.g. "http://purl.org/goodrelations/v1#UPS". */
  deliveryMethod: string | null;
  trackingUrl: string | null;
  expectedArrivalFrom: string | null;
  expectedArrivalUntil: string | null;
  /** deliveryStatus as text, if any. */
  deliveryStatus: string | null;
  orderNumber: string | null;
  orderStatus: string | null;
  itemNames: string[];
  /** partOfOrder.seller (current) or .merchant (superseded). */
  sellerName: string | null;
}

const MAX_DEPTH = 12;
const MAX_NODES = 5_000;
const MAX_SCRIPT_CHARS = 200_000;

const SCRIPT_OPEN_RE = /<script\b([^<>]*)>/gi;
const SCRIPT_CLOSE_RE = /<\/script\s*>/gi;
const LD_TYPE_RE = /\btype\s*=\s*["']?application\/ld\+json\b/i;

/** Bodies of the <script type="application/ld+json"> elements, scanned in one linear pass. */
function ldScripts(html: string): string[] {
  const open = new RegExp(SCRIPT_OPEN_RE.source, "gi");
  const close = new RegExp(SCRIPT_CLOSE_RE.source, "gi");
  const out: string[] = [];
  for (let m = open.exec(html); m; m = open.exec(html)) {
    close.lastIndex = m.index + m[0].length;
    const end = close.exec(html);
    if (!end) break;
    if (LD_TYPE_RE.test(m[1])) out.push(html.slice(m.index + m[0].length, end.index));
    open.lastIndex = end.index + end[0].length;
  }
  return out;
}

function isObject(v: JsonValue | undefined): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function typesOf(node: JsonObject): string[] {
  const t = node["@type"];
  const list = Array.isArray(t) ? t : [t];
  return list
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.replace(/^https?:\/\/schema\.org\//i, "").trim());
}

function first(v: JsonValue | undefined): JsonValue | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Text of a value: a string or number, or the name / @id / url of an object. */
function textOf(v: JsonValue | undefined): string | null {
  const x = first(v);
  if (typeof x === "string") return x.trim() || null;
  if (typeof x === "number") return String(x);
  if (isObject(x)) return textOf(x.name) ?? textOf(x.url) ?? textOf(x["@id"]);
  return null;
}

function urlOf(v: JsonValue | undefined): string | null {
  const x = first(v);
  if (typeof x === "string") return x.trim() || null;
  if (isObject(x)) return urlOf(x.urlTemplate) ?? urlOf(x.url) ?? urlOf(x.target);
  return null;
}

function namesOf(v: JsonValue | undefined): string[] {
  const list = Array.isArray(v) ? v : v === undefined ? [] : [v];
  return list
    .map((x) => (isObject(x) ? textOf(x.name) ?? textOf(x.itemOffered) ?? textOf(x.orderedItem) : textOf(x)))
    .filter((x): x is string => !!x);
}

function parcelFrom(node: JsonObject, order: JsonObject | null): ParcelInfo {
  const ownOrder = first(node.partOfOrder);
  const o = isObject(ownOrder) ? ownOrder : order;
  const status = first(node.deliveryStatus);
  return {
    trackingNumber: textOf(node.trackingNumber),
    carrierName: textOf(node.provider) ?? textOf(node.carrier),
    deliveryMethod: textOf(node.hasDeliveryMethod),
    trackingUrl: urlOf(node.trackingUrl) ?? urlOf(node.potentialAction),
    expectedArrivalFrom: textOf(node.expectedArrivalFrom),
    expectedArrivalUntil: textOf(node.expectedArrivalUntil),
    deliveryStatus: isObject(status) ? textOf(status.name) ?? textOf(status.description) : textOf(status),
    orderNumber: o ? textOf(o.orderNumber) : null,
    orderStatus: o ? textOf(o.orderStatus) : null,
    itemNames: namesOf(node.itemShipped),
    sellerName: o ? textOf(o.seller) ?? textOf(o.merchant) : null,
  };
}

function walk(node: JsonValue | undefined, order: JsonObject | null, out: ParcelInfo[], depth: number, budget: { n: number }) {
  if (depth > MAX_DEPTH || budget.n-- <= 0 || node === undefined) return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, order, out, depth + 1, budget);
    return;
  }
  if (!isObject(node)) return;
  const types = typesOf(node);
  if (types.includes("ParcelDelivery")) out.push(parcelFrom(node, order));
  const nextOrder = types.includes("Order") ? node : order;
  for (const [key, value] of Object.entries(node)) {
    if (key === "@context") continue;
    walk(value, nextOrder, out, depth + 1, budget);
  }
}

/** ParcelDelivery nodes in every `<script type="application/ld+json">` (objects, arrays, @graph, nested under Order). */
export function parcelsFromJsonLd(html: string): ParcelInfo[] {
  if (!/application\/ld\+json/i.test(html)) return [];
  const out: ParcelInfo[] = [];
  const budget = { n: MAX_NODES };
  for (const script of ldScripts(html)) {
    const raw = script.trim().replace(/^<!--|-->$/g, "").replace(/^<!\[CDATA\[|\]\]>$/g, "");
    if (!raw || raw.length > MAX_SCRIPT_CHARS) continue;
    let data: JsonValue;
    try {
      data = JSON.parse(raw) as JsonValue;
    } catch {
      try {
        data = JSON.parse(decodeEntities(raw)) as JsonValue;
      } catch {
        continue;
      }
    }
    walk(data, null, out, 0, budget);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Microdata
// ---------------------------------------------------------------------------

interface MicroItem {
  types: string[];
  props: Map<string, (string | MicroItem)[]>;
}

interface Frame {
  tag: string;
  item: MicroItem | null;
  /** Nearest enclosing item (excluding this element's own). */
  parentItem: MicroItem | null;
  /** itemprop names this element contributes to its parent item. */
  props: string[] | null;
  /** Text collected for an itemprop whose value is its text content. */
  text: string | null;
}

const TOKEN_RE = /<!--[\s\S]*?(?:-->|$)|<(\/?)([A-Za-z][A-Za-z0-9:-]*)((?:[^<>"']|"[^"<]*"|'[^'<]*')*)>|([^<]+)|</g;
/** Deeper nesting is flattened; real markup is a few levels deep. */
const MAX_STACK = 200;
const MAX_TEXT_VALUE = 500;
const ATTR_RE = /([^\s"'=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const VOID_TAGS = new Set(["meta", "link", "br", "img", "hr", "input", "area", "base", "col", "source", "wbr", "embed", "param", "track"]);

function parseAttrs(s: string): Map<string, string> {
  const attrs = new Map<string, string>();
  for (const m of s.matchAll(ATTR_RE)) {
    const name = m[1].toLowerCase();
    if (!attrs.has(name)) attrs.set(name, decodeEntities(m[2] ?? m[3] ?? m[4] ?? ""));
  }
  return attrs;
}

function attrValue(tag: string, attrs: Map<string, string>): string | null {
  if (attrs.has("content")) return attrs.get("content") ?? null;
  switch (tag) {
    case "a":
    case "area":
    case "link":
      return attrs.get("href") ?? null;
    case "time":
      return attrs.get("datetime") ?? null;
    case "img":
    case "audio":
    case "video":
    case "source":
    case "iframe":
    case "embed":
      return attrs.get("src") ?? null;
    case "data":
    case "meter":
      return attrs.get("value") ?? null;
    case "object":
      return attrs.get("data") ?? null;
    default:
      return null;
  }
}

function addProp(item: MicroItem, names: string[], value: string | MicroItem) {
  for (const name of names) {
    const list = item.props.get(name) ?? [];
    list.push(value);
    item.props.set(name, list);
  }
}

function nearestItem(stack: Frame[]): MicroItem | null {
  const last = stack[stack.length - 1];
  return last ? last.item ?? last.parentItem : null;
}

function closeFrame(frame: Frame, top: MicroItem[]) {
  const parent = frame.parentItem;
  if (frame.item) {
    if (frame.props && parent) addProp(parent, frame.props, frame.item);
    else top.push(frame.item);
  } else if (frame.props && frame.text !== null && parent) {
    addProp(parent, frame.props, decodeEntities(frame.text).replace(/\s+/g, " ").trim());
  }
}

function toJson(item: MicroItem, depth = 0): JsonObject {
  const obj: JsonObject = { "@type": item.types };
  if (depth > MAX_DEPTH) return obj;
  for (const [name, values] of item.props) {
    const converted = values.map((v) => (typeof v === "string" ? v : toJson(v, depth + 1)));
    obj[name] = converted.length === 1 ? converted[0] : converted;
  }
  return obj;
}

/** Top-level microdata items (itemscope/itemtype/itemprop) as JSON-LD-like objects. */
function microdataItems(html: string): JsonObject[] {
  const stack: Frame[] = [];
  const collecting = new Set<Frame>();
  const top: MicroItem[] = [];
  let tokens = 0;
  for (const m of html.matchAll(TOKEN_RE)) {
    if (++tokens > 200_000) break;
    const [whole, slash, rawTag, rawAttrs, text] = m;
    if (text !== undefined) {
      for (const f of collecting) if (f.text !== null && f.text.length < MAX_TEXT_VALUE) f.text += text;
      continue;
    }
    if (rawTag === undefined || whole.startsWith("<!--")) continue;
    const tag = rawTag.toLowerCase();
    if (slash) {
      const at = stack.map((f) => f.tag).lastIndexOf(tag);
      if (at < 0) continue;
      while (stack.length > at) {
        const frame = stack.pop() as Frame;
        if (frame.text !== null) collecting.delete(frame);
        closeFrame(frame, top);
      }
      continue;
    }
    const attrs = parseAttrs(rawAttrs ?? "");
    const props = attrs.get("itemprop")?.split(/\s+/).filter(Boolean) ?? null;
    const scoped = attrs.has("itemscope");
    const frame: Frame = {
      tag,
      item: scoped
        ? {
            types: (attrs.get("itemtype") ?? "")
              .split(/\s+/)
              .filter(Boolean)
              .map((t) => t.replace(/^https?:\/\/schema\.org\//i, "")),
            props: new Map(),
          }
        : null,
      parentItem: nearestItem(stack),
      props: props && props.length ? props : null,
      text: null,
    };
    if (frame.props && !scoped) {
      const value = attrValue(tag, attrs);
      if (value !== null) {
        if (frame.parentItem) addProp(frame.parentItem, frame.props, value.trim());
        frame.props = null;
      } else {
        frame.text = "";
      }
    }
    if (VOID_TAGS.has(tag) || /\/\s*$/.test(rawAttrs ?? "") || stack.length >= MAX_STACK) {
      if (frame.item || frame.text !== null) closeFrame(frame, top);
      continue;
    }
    stack.push(frame);
    if (frame.text !== null) collecting.add(frame);
  }
  while (stack.length) closeFrame(stack.pop() as Frame, top);
  return top.map((item) => toJson(item));
}

/** ParcelDelivery nodes in microdata markup. */
export function parcelsFromMicrodata(html: string): ParcelInfo[] {
  if (!/itemscope/i.test(html) || !/ParcelDelivery/i.test(html)) return [];
  const out: ParcelInfo[] = [];
  walk(microdataItems(html), null, out, 0, { n: MAX_NODES });
  return out;
}

// ---------------------------------------------------------------------------
// ParcelInfo -> ShipmentDraft
// ---------------------------------------------------------------------------

/** Carrier named by a provider name or GoodRelations delivery method ("FedEx", "#FederalExpress", "USPS"). */
export function carrierFromName(name: string | null): CarrierId | null {
  if (!name) return null;
  const s = name.toLowerCase();
  if (/\bfed\s?ex\b|federal\s?express/.test(s)) return "fedex";
  if (/\busps\b|postal\s+service|u\.\s?s\.\s+mail/.test(s)) return "usps";
  if (/\bups\b|united\s+parcel/.test(s)) return "ups";
  if (/\bdhl\b/.test(s)) return "dhl";
  if (/\bamazon\b/.test(s)) return "amazon";
  if (/\bon\s?trac\b|\blaser\s?ship\b/.test(s)) return "ontrac";
  return null;
}

function dateOnly(v: string | null): string | null {
  if (!v) return null;
  const d = v.trim().slice(0, 10);
  return isCalendarDate(d) ? d : null;
}

function timeOf(v: string | null): string | null {
  const m = v ? /T(\d{2}):(\d{2})/.exec(v) : null;
  if (!m) return null;
  const h = Number(m[1]);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

/** One draft per parcel; null when it has neither a usable tracking number nor an order number. */
export function parcelToDraft(p: ParcelInfo): ShipmentDraft | null {
  let trackingNumber: string | null = null;
  let detectedCarrier: CarrierId | null = null;
  if (p.trackingNumber) {
    const detected = detectTrackingNumber(p.trackingNumber);
    const normalized = detected?.trackingNumber ?? normalizeTrackingNumber(p.trackingNumber);
    if (/^[A-Z0-9]{6,40}$/.test(normalized)) {
      trackingNumber = normalized;
      if (detected && detected.checksumValid !== false) detectedCarrier = detected.carrier;
    }
  }
  const orderRef = p.orderNumber?.slice(0, 64) ?? null;
  if (!trackingNumber && !orderRef) return null;

  const named = carrierFromName(p.carrierName) ?? carrierFromName(p.deliveryMethod);
  const carrier: CarrierId =
    named ?? detectedCarrier ?? (!trackingNumber && carrierFromName(p.sellerName) === "amazon" ? "amazon" : "unknown");

  const from = dateOnly(p.expectedArrivalFrom);
  const until = dateOnly(p.expectedArrivalUntil);
  const fromTime = timeOf(p.expectedArrivalFrom);
  const untilTime = timeOf(p.expectedArrivalUntil);
  const window = from && until && from === until && fromTime && untilTime ? `${fromTime} - ${untilTime}` : null;

  const items = p.itemNames;
  const description = items.length === 0 ? null : items.length === 1 ? items[0] : `${items[0]} + ${items.length - 1} more`;

  return {
    carrier,
    trackingNumber,
    orderRef,
    shipper: p.sellerName,
    description,
    status: statusFromSchema(p.deliveryStatus) ?? statusFromSchema(p.orderStatus),
    expectedDelivery: until ?? from,
    expectedWindow: window,
    deliveredAt: null,
  };
}

/** Drafts from all ParcelDelivery markup (JSON-LD first, then microdata), deduplicated. */
export function draftsFromMarkup(html: string): ShipmentDraft[] {
  if (!html) return [];
  const drafts: ShipmentDraft[] = [];
  const seen = new Set<string>();
  for (const parcel of [...parcelsFromJsonLd(html), ...parcelsFromMicrodata(html)]) {
    const draft = parcelToDraft(parcel);
    if (!draft) continue;
    const key = draft.trackingNumber ? `tn:${draft.trackingNumber}` : `order:${draft.orderRef}`;
    if (seen.has(key)) continue;
    seen.add(key);
    drafts.push(draft);
  }
  return drafts;
}
