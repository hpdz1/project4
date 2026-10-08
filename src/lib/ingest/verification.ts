import type { ForwardingVerification, InboundEmail } from "@/lib/types";
import { domainOf, extractAddresses, isDomainOrSubdomain } from "./addresses";
import { decodeEntities, extractLinks, htmlToText } from "./html";

/**
 * Forwarding confirmations: when a user adds our inbound address as a
 * forwarding destination, Gmail (and Yahoo, ...) emails it a confirmation
 * link and, in older or some localized versions, a numeric code. We surface
 * them in the setup wizard. See research/forwarding.md §1b-1c.
 *
 * Links are kept only when they are https, on the provider's own domain,
 * with no credentials or odd port: the dashboard renders them as a button.
 */

type Provider = ForwardingVerification["provider"];

const GMAIL_SENDERS = new Set(["forwarding-noreply@google.com", "mail-noreply@google.com"]);

const PROVIDER_DOMAINS: Record<Exclude<Provider, "other">, readonly string[]> = {
  gmail: ["google.com"],
  yahoo: ["yahoo.com"],
  icloud: ["apple.com", "icloud.com"],
  outlook: ["live.com", "outlook.com", "microsoft.com"],
};

const SENDER_DOMAINS: Record<Exclude<Provider, "gmail" | "other">, readonly string[]> = {
  yahoo: ["yahoo.com", "yahooinc.com", "yahoo-inc.com"],
  icloud: ["icloud.com", "apple.com", "me.com", "mac.com"],
  outlook: ["microsoft.com", "outlook.com", "live.com", "hotmail.com", "microsoftonline.com", "office365.com"],
};

/** Gmail's subject, in the languages we have seen ("(#123) Gmail Forwarding Confirmation - Receive Mail from x@gmail.com"). */
const GMAIL_SUBJECT_RE =
  /forwarding\s+confirmation|confirmation\s+d[eu]\s+transfert|weiterleitungsbest[äa]tigung|confirmaci[óo]n\s+de\s+reenv[íi]o|conferma\s+(?:dell?['’]\s*)?inoltro/i;
const FORWARD_WORD_RE = /forward|weiterleit|transfert|reenv[íi]o|inoltro|doorstu/i;
const VERIFY_WORD_RE = /verif|confirm|best[äa]tig|approve/i;

const CODE_SUBJECT_RE = /\((?:#|n°|nº|no\.?)\s*(\d{6,12})\)/i;
const CODE_BODY_RE =
  /(?:confirmation|verification|verify)\s+code|code\s+de\s+(?:confirmation|v[ée]rification)|best[äa]tigungscode|c[óo]digo\s+de\s+(?:confirmaci[óo]n|verificaci[óo]n)|codice\s+di\s+conferma/i;
const CODE_AFTER_LABEL_RE = /^\s*(?:is\s*)?[:：]?\s*(\d{4,12})\b/;
const GMAIL_REQUESTER_BODY_RE = /(?<![A-Z0-9._%+-])([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\s+has\s+requested\s+to\s+automatically\s+forward/i;
const SUBJECT_TRAILING_ADDRESS_RE = /(?<![A-Z0-9._%+-])([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\)?\s*$/i;
const URL_RE = /https?:\/\/[^\s<>"'`]+/gi;
const TRAILING_PUNCT_RE = /[.,;:!?)\]}>*'"]+$/;

function senderProvider(from: string, subject: string, text: string): Provider | null {
  const address = from.trim().toLowerCase();
  if (GMAIL_SENDERS.has(address)) return "gmail";
  const domain = domainOf(address);
  const looksLikeForwarding =
    FORWARD_WORD_RE.test(subject) && (VERIFY_WORD_RE.test(subject) || VERIFY_WORD_RE.test(text.slice(0, 2000)));
  if (!looksLikeForwarding) return null;
  for (const provider of ["yahoo", "icloud", "outlook"] as const) {
    if (SENDER_DOMAINS[provider].some((d) => isDomainOrSubdomain(domain, d))) return provider;
  }
  if (isDomainOrSubdomain(domain, "google.com") && GMAIL_SUBJECT_RE.test(subject)) return "gmail";
  return null;
}

/** True for an https URL on one of `domains`, without credentials or a non-default port. */
export function isProviderLink(url: string, domains: readonly string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) return false;
  if (parsed.port !== "" && parsed.port !== "443") return false;
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  return domains.some((d) => isDomainOrSubdomain(host, d));
}

function candidateLinks(text: string, html: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(URL_RE)) out.push(m[0].replace(TRAILING_PUNCT_RE, ""));
  for (const href of extractLinks(html)) out.push(href);
  return [...new Set(out.map((u) => decodeEntities(u)))];
}

function confirmationLink(provider: Provider, links: string[]): string | null {
  if (provider === "other") return null;
  const domains = PROVIDER_DOMAINS[provider];
  for (const link of links) {
    if (!isProviderLink(link, domains)) continue;
    const path = new URL(link).pathname;
    if (provider === "gmail") {
      // vf- confirms; uf- cancels and must never be shown or followed.
      if (/^\/mail\/(?:u\/\d+\/)?vf-/i.test(path)) return link;
      continue;
    }
    if (/cancel|unsubscribe|deny|reject|decline|not-?me|report/i.test(link)) continue;
    if (/verif|confirm|approve|accept/i.test(link)) return link;
  }
  return null;
}

function findCode(subject: string, text: string): string | null {
  const inSubject = CODE_SUBJECT_RE.exec(subject);
  if (inSubject) return inSubject[1];
  const label = CODE_BODY_RE.exec(text);
  if (!label) return null;
  return CODE_AFTER_LABEL_RE.exec(text.slice(label.index + label[0].length))?.[1] ?? null;
}

function findRequester(provider: Provider, email: InboundEmail, subject: string, text: string): string | null {
  if (provider === "gmail") {
    const fromBody = GMAIL_REQUESTER_BODY_RE.exec(text)?.[1];
    const fromSubject = SUBJECT_TRAILING_ADDRESS_RE.exec(subject.trim())?.[1];
    const found = fromBody ?? fromSubject;
    if (found) return found.toLowerCase();
  }
  const own = new Set([...email.recipients, email.from.toLowerCase()]);
  for (const address of [...extractAddresses(subject), ...extractAddresses(text)]) {
    if (own.has(address)) continue;
    if (/^(?:no-?reply|do-?not-?reply|forwarding-noreply|mail-noreply)@/.test(address)) continue;
    return address;
  }
  return null;
}

/**
 * Reads a forwarding confirmation email (Gmail, Yahoo, iCloud, Outlook):
 * the confirmation link (provider's own https domain only; Gmail's "vf-"
 * link, never its "uf-" cancel link), a legacy numeric code if present, and
 * the mailbox that asked to forward. Null when the email isn't one.
 */
export function parseForwardingVerification(email: InboundEmail): ForwardingVerification | null {
  const subject = email.subject;
  const text = [email.text, htmlToText(email.html)].filter((s) => s.trim()).join("\n\n");
  const provider = senderProvider(email.from, subject, text);
  if (!provider) return null;
  const code = findCode(subject, text);
  const link = confirmationLink(provider, candidateLinks(text, email.html));
  if (provider !== "gmail" && !code && !link) return null;
  return {
    provider,
    requestedBy: findRequester(provider, email, subject, text),
    code,
    link,
    receivedAt: email.date,
  };
}
