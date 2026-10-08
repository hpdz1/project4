/**
 * HTML email bodies to plain text, and links out of them. Regex based on
 * purpose: we only need readable text and hrefs, never a DOM, and the input
 * is untrusted (nothing here executes or fetches anything).
 */

/** Named entities seen in carrier and retailer emails. Anything else is left as written. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  nbsp: "\u00A0", ensp: "\u2002", emsp: "\u2003", thinsp: "\u2009",
  zwnj: "\u200C", zwj: "\u200D", zwsp: "\u200B", shy: "\u00AD", lrm: "\u200E", rlm: "\u200F",
  reg: "®", copy: "©", trade: "™", hellip: "…", mdash: "—", ndash: "–", minus: "−",
  lsquo: "‘", rsquo: "’", sbquo: "‚", ldquo: "“", rdquo: "”", bdquo: "„", laquo: "«", raquo: "»",
  lsaquo: "‹", rsaquo: "›", prime: "′", Prime: "″",
  bull: "•", middot: "·", deg: "°", times: "×", divide: "÷", plusmn: "±", frac12: "½", frac14: "¼", frac34: "¾",
  euro: "€", pound: "£", cent: "¢", yen: "¥", curren: "¤", sect: "§", para: "¶", dagger: "†", Dagger: "‡",
  iexcl: "¡", iquest: "¿", ordf: "ª", ordm: "º", micro: "µ", larr: "←", rarr: "→", uarr: "↑", darr: "↓",
  check: "✓", star: "☆", hearts: "♥",
  Agrave: "À", Aacute: "Á", Acirc: "Â", Atilde: "Ã", Auml: "Ä", Aring: "Å", AElig: "Æ", Ccedil: "Ç",
  Egrave: "È", Eacute: "É", Ecirc: "Ê", Euml: "Ë", Igrave: "Ì", Iacute: "Í", Icirc: "Î", Iuml: "Ï",
  Ntilde: "Ñ", Ograve: "Ò", Oacute: "Ó", Ocirc: "Ô", Otilde: "Õ", Ouml: "Ö", Oslash: "Ø",
  Ugrave: "Ù", Uacute: "Ú", Ucirc: "Û", Uuml: "Ü", Yacute: "Ý", szlig: "ß",
  agrave: "à", aacute: "á", acirc: "â", atilde: "ã", auml: "ä", aring: "å", aelig: "æ", ccedil: "ç",
  egrave: "è", eacute: "é", ecirc: "ê", euml: "ë", igrave: "ì", iacute: "í", icirc: "î", iuml: "ï",
  ntilde: "ñ", ograve: "ò", oacute: "ó", ocirc: "ô", otilde: "õ", ouml: "ö", oslash: "ø",
  ugrave: "ù", uacute: "ú", ucirc: "û", uuml: "ü", yacute: "ý", yuml: "ÿ",
};

const ENTITY_RE = /&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([A-Za-z][A-Za-z0-9]{1,31}));?/g;

function fromCodePoint(cp: number): string {
  if (cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return "�";
  return String.fromCodePoint(cp);
}

/**
 * Decodes HTML character references: decimal (&#8203;), hex (&#x200B;) and the
 * named entities in NAMED_ENTITIES. Named entities need their semicolon,
 * except the five XML ones and &nbsp;, which emails often write without it.
 */
export function decodeEntities(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(ENTITY_RE, (whole, dec: string | undefined, hex: string | undefined, name: string | undefined) => {
    if (dec !== undefined) return fromCodePoint(Number(dec));
    if (hex !== undefined) return fromCodePoint(parseInt(hex, 16));
    if (name === undefined) return whole;
    const hasSemicolon = whole.endsWith(";");
    const value = NAMED_ENTITIES[name] ?? NAMED_ENTITIES[name.toLowerCase()];
    if (value === undefined) return whole;
    if (!hasSemicolon && !/^(?:amp|lt|gt|quot|apos|nbsp)$/i.test(name)) return whole;
    return value;
  });
}

/**
 * Attribute section of a tag. Quoted values may contain ">", but no part of a
 * tag may contain "<": on broken markup ("<a <a <a ...") every scan then stops
 * at the next "<" and the regexes stay linear.
 */
const ATTRS = String.raw`(?:[^<>"']|"[^"<]*"|'[^'<]*')*`;
const COMMENT_RE = /<!--[\s\S]*?(?:-->|$)/g;
const DECLARATION_RE = /<![^<>]*>|<\?[^<>]*>/g;
const DROPPED_OPEN_RE = new RegExp(
  String.raw`<(script|style|head|title|noscript|template|svg|xml|object)\b${ATTRS}>`,
  "gi",
);
const BR_RE = new RegExp(String.raw`<br\b${ATTRS}>`, "gi");
const CELL_RE = new RegExp(String.raw`<\/?(?:td|th)\b${ATTRS}>`, "gi");
/** A run of adjacent block-level tags ("</td></tr><tr><td>" after cells became spaces) is one line break. */
const BLOCK_RUN_RE = new RegExp(
  String.raw`(?:<\/?(?:p|div|tr|table|tbody|thead|tfoot|li|ul|ol|dl|dt|dd|h[1-6]|section|article|header|footer|main|nav|aside|blockquote|center|hr|pre|address|form|fieldset|figure|figcaption|caption|body|html)\b${ATTRS}>\s*)+`,
  "gi",
);
const ANY_TAG_RE = new RegExp(String.raw`<\/?[A-Za-z][^\s<>/]*${ATTRS}>`, "g");

/**
 * Removes elements whose content is not text (<head>, <script>, <style>, ...).
 * An element that is never closed runs to the end, as in a browser. Linear:
 * each closing-tag search starts where the previous one ended.
 */
function dropNonTextElements(html: string): string {
  const open = new RegExp(DROPPED_OPEN_RE.source, "gi");
  const out: string[] = [];
  let at = 0;
  for (let m = open.exec(html); m; m = open.exec(html)) {
    out.push(html.slice(at, m.index), " ");
    // A <head> nobody closed ends where <body> starts, as in a browser.
    const closing = m[1].toLowerCase() === "head" ? String.raw`<\/head\s*>|(?=<body\b)` : String.raw`<\/${m[1]}\s*>`;
    const close = new RegExp(closing, "gi");
    close.lastIndex = m.index + m[0].length;
    const end = close.exec(html);
    if (!end) {
      at = html.length;
      break;
    }
    at = end.index + end[0].length;
    open.lastIndex = at;
  }
  out.push(html.slice(at));
  return out.join("");
}

const INVISIBLE_RE = /[\u200B-\u200D\u2060\uFEFF\u00AD\u200E\u200F]/g;
const HSPACE_RE = /[ \t\u00A0\u2000-\u200A\u202F\u205F\u3000]+/g;

/**
 * Readable plain text from an HTML email: drops <head>, <script>, <style> and
 * comments; block elements and <br> become line breaks (adjacent block tags
 * make one), table cells become spaces; entities are decoded; zero-width
 * characters removed; runs of spaces collapsed, lines trimmed and blank lines
 * squeezed to one. Linear-time on malformed input.
 */
export function htmlToText(html: string): string {
  if (!html) return "";
  let s = dropNonTextElements(html.replace(COMMENT_RE, " "))
    .replace(DECLARATION_RE, " ")
    // Source line breaks are just whitespace in HTML.
    .replace(/[\r\n\t\f]+/g, " ")
    .replace(CELL_RE, " ")
    .replace(BLOCK_RUN_RE, "\n")
    // After block runs, so "<br><br>" between paragraphs still leaves a blank line.
    .replace(BR_RE, "\n")
    .replace(ANY_TAG_RE, "");
  s = decodeEntities(s).replace(INVISIBLE_RE, "");
  return s
    .split("\n")
    .map((line) => line.replace(HSPACE_RE, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const LINK_TAG_RE = new RegExp(String.raw`<(?:a|area)\b(${ATTRS})>`, "gi");
const HREF_RE = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;
const MAX_LINKS = 500;

/**
 * Absolute http(s) link targets (<a href> and <area href>) in document order,
 * entity-decoded and deduplicated. mailto:, tel:, javascript: and relative
 * links are dropped.
 */
export function extractLinks(html: string): string[] {
  if (!html) return [];
  const seen = new Set<string>();
  for (const tag of html.matchAll(LINK_TAG_RE)) {
    const m = HREF_RE.exec(tag[1]);
    if (!m) continue;
    const href = decodeEntities(m[1] ?? m[2] ?? m[3] ?? "")
      .replace(/[\s\u200B-\u200D\uFEFF]+/g, "")
      .trim();
    if (!/^(?:https?:\/\/|www\.)/i.test(href)) continue;
    seen.add(href);
    if (seen.size >= MAX_LINKS) break;
  }
  return [...seen];
}
