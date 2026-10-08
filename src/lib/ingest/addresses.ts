/** Email address helpers for header values such as `"Doe, Jane" <jane@example.com>, ops@example.com`. */

/**
 * An addr-spec, loosely: what real mail uses, not all of RFC 5322. The
 * lookbehind starts matches only at the beginning of a run of local-part
 * characters, which keeps scans of long junk strings linear.
 */
const ADDRESS_RE = /(?<![A-Za-z0-9.!#$%&'*+/=?^_`{|}~-])[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+/g;
const ANGLE_RE = /<\s*([^<>\s@]+@[^<>\s]+?)\s*>/;
const MAILTO_RE = /\[\s*mailto:\s*([^\]\s]+)\s*\]/i;
const VALID_RE = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/;

export interface Mailbox {
  /** Lowercased address. */
  address: string;
  name: string | null;
}

function cleanName(raw: string, address: string): string | null {
  const name = raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\\(["\\])/g, "$1")
    .trim();
  if (!name || name.toLowerCase() === address) return null;
  return name;
}

/**
 * Parses one mailbox: `Name <a@b>`, `"Name" <a@b>`, `Name [mailto:a@b]`
 * (old Outlook), or a bare address. Whitespace and line breaks inside the
 * angle brackets are tolerated (Gmail wraps long addresses in forwards).
 */
export function parseMailbox(raw: string): Mailbox | null {
  const angle = ANGLE_RE.exec(raw);
  if (angle) {
    const address = angle[1].replace(/^mailto:/i, "").toLowerCase();
    if (!VALID_RE.test(address)) return null;
    return { address, name: cleanName(raw.slice(0, angle.index), address) };
  }
  const mailto = MAILTO_RE.exec(raw);
  if (mailto) {
    const address = mailto[1].toLowerCase();
    if (!VALID_RE.test(address)) return null;
    return { address, name: cleanName(raw.slice(0, mailto.index), address) };
  }
  const bare = new RegExp(ADDRESS_RE.source).exec(raw);
  if (!bare) return null;
  const address = bare[0].toLowerCase();
  const rest = raw.slice(0, bare.index) + raw.slice(bare.index + bare[0].length);
  return { address, name: cleanName(rest.replace(/[()]/g, " "), address) };
}

/** Every address in a header value or free text, lowercased, in order, deduplicated. */
export function extractAddresses(value: string): string[] {
  const seen = new Set<string>();
  for (const m of value.matchAll(ADDRESS_RE)) seen.add(m[0].toLowerCase().replace(/\.+$/, ""));
  return [...seen];
}

/** Domain part of an address, lowercased and without a trailing dot. */
export function domainOf(address: string): string {
  const at = address.lastIndexOf("@");
  return at < 0 ? "" : address.slice(at + 1).toLowerCase().replace(/\.$/, "");
}

/** True when `domain` is `base` or one of its subdomains. */
export function isDomainOrSubdomain(domain: string, base: string): boolean {
  return domain === base || domain.endsWith(`.${base}`);
}
