import { z } from "zod";
import type { InboundEmail } from "@/lib/types";
import { extractAddresses, parseMailbox } from "./addresses";
import { parseMailDate } from "./dates";

/**
 * Webhook payloads -> provider-neutral `InboundEmail`.
 * See research/inbound-plumbing.md (Postmark field names) and
 * workers/inbound-email (generic JSON).
 */

/** The webhook body is not a usable email (wrong shape or types). Routes answer 400. */
export class InboundPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InboundPayloadError";
  }
}

/** Longest text or HTML body we keep, in characters. Longer bodies are cut. */
export const MAX_BODY_CHARS = 1_000_000;
const MAX_SUBJECT_CHARS = 2_000;
const MAX_HEADERS = 500;
const MAX_HEADER_VALUE_CHARS = 20_000;

/** Headers that name recipients (in addition to the envelope / provider fields). */
const RECIPIENT_HEADERS = ["delivered-to", "x-forwarded-to", "x-original-to", "to"] as const;

function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`)
    .join("; ");
}

function headerMap(entries: { name: string; value: string }[]): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const { name, value } of entries.slice(0, MAX_HEADERS)) {
    const key = name.trim().toLowerCase();
    if (!key || key === "__proto__" || key === "constructor" || key === "prototype") continue;
    const v = clip(value, MAX_HEADER_VALUE_CHARS);
    headers[key] = Object.hasOwn(headers, key) ? `${headers[key]}\n${v}` : v;
  }
  return headers;
}

function collectRecipients(sources: string[], headers: Record<string, string>): string[] {
  const all = new Set<string>();
  for (const s of sources) for (const a of extractAddresses(s)) all.add(a);
  for (const name of RECIPIENT_HEADERS) {
    const v = headers[name];
    if (v) for (const a of extractAddresses(v)) all.add(a);
  }
  return [...all];
}

/**
 * ISO time from a Date header; falls back to `receivedAt` when the header is
 * missing or unreadable, or claims to be more than a day after `receivedAt`.
 */
function resolveDate(raw: string | undefined, receivedAt: Date): string {
  const parsed = raw ? parseMailDate(raw) : null;
  if (parsed && parsed.date.getTime() <= receivedAt.getTime() + 86_400_000) return parsed.date.toISOString();
  return receivedAt.toISOString();
}

// ---------------------------------------------------------------------------
// Postmark
// ---------------------------------------------------------------------------

const postmarkAddress = z.object({
  Email: z.string(),
  Name: z.string().nullish(),
});

const postmarkSchema = z.object({
  From: z.string().nullish(),
  FromName: z.string().nullish(),
  FromFull: postmarkAddress.nullish(),
  To: z.string().nullish(),
  ToFull: z.array(postmarkAddress).nullish(),
  Cc: z.string().nullish(),
  CcFull: z.array(postmarkAddress).nullish(),
  Bcc: z.string().nullish(),
  BccFull: z.array(postmarkAddress).nullish(),
  OriginalRecipient: z.string().nullish(),
  Subject: z.string().nullish(),
  Date: z.string().nullish(),
  TextBody: z.string().nullish(),
  HtmlBody: z.string().nullish(),
  Headers: z.array(z.object({ Name: z.string(), Value: z.string() })).nullish(),
});

/**
 * Validates a Postmark inbound webhook body and converts it. Recipients are
 * ToFull, CcFull, BccFull, OriginalRecipient (the envelope recipient) and the
 * Delivered-To / X-Forwarded-To / X-Original-To / To headers, lowercased and
 * deduplicated. Bodies are cut at 1,000,000 characters each. `date` is the
 * Date header, else `receivedAt` (default: now).
 *
 * @throws InboundPayloadError when the payload doesn't have Postmark's shape.
 */
export function fromPostmark(payload: unknown, receivedAt: Date = new Date()): InboundEmail {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new InboundPayloadError("Postmark payload must be a JSON object");
  }
  const result = postmarkSchema.safeParse(payload);
  if (!result.success) throw new InboundPayloadError(`Invalid Postmark payload: ${describeIssues(result.error)}`);
  const p = result.data;
  if (!p.FromFull && typeof p.From !== "string") {
    throw new InboundPayloadError("Invalid Postmark payload: From/FromFull is required");
  }

  const headers = headerMap((p.Headers ?? []).map((h) => ({ name: h.Name, value: h.Value })));
  if (p.Date && !headers.date) headers.date = clip(p.Date, MAX_HEADER_VALUE_CHARS);

  const fromMailbox = p.FromFull?.Email ? parseMailbox(p.FromFull.Email) : p.From ? parseMailbox(p.From) : null;
  const fromName = (p.FromFull?.Name || p.FromName || "").trim() || fromMailbox?.name || null;

  const sources = [
    ...(p.ToFull ?? []).map((r) => r.Email),
    ...(p.CcFull ?? []).map((r) => r.Email),
    ...(p.BccFull ?? []).map((r) => r.Email),
    p.OriginalRecipient ?? "",
  ];
  if (!p.ToFull?.length && p.To) sources.push(p.To);

  return {
    recipients: collectRecipients(sources, headers),
    from: fromMailbox?.address ?? "",
    fromName,
    subject: clip(p.Subject ?? "", MAX_SUBJECT_CHARS),
    text: clip(p.TextBody ?? "", MAX_BODY_CHARS),
    html: clip(p.HtmlBody ?? "", MAX_BODY_CHARS),
    headers,
    date: resolveDate(p.Date ?? headers.date, receivedAt),
  };
}

// ---------------------------------------------------------------------------
// Generic JSON (Cloudflare Email Worker and other adapters)
// ---------------------------------------------------------------------------

const stringOrList = z.union([z.string(), z.array(z.string())]);

const rawSchema = z.object({
  from: z.string(),
  to: stringOrList,
  cc: stringOrList.nullish(),
  subject: z.string().nullish(),
  text: z.string().nullish(),
  html: z.string().nullish(),
  headers: z
    .union([
      z.record(z.string(), z.string()),
      z.array(z.object({ name: z.string(), value: z.string() })),
    ])
    .nullish(),
  date: z.string().nullish(),
});

function asList(v: string | string[] | null | undefined): string[] {
  if (v === null || v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Validates the generic inbound JSON shape and converts it:
 * `{ from: "Name <a@b>" | "a@b", to: string | string[], cc?, subject?, text?, html?,
 *    headers?: Record<string,string> | {name,value}[], date? }`.
 * `to` should carry the envelope recipient. Recipients also include cc and the
 * Delivered-To / X-Forwarded-To / X-Original-To / To headers. `date` (or the
 * Date header) falls back to `receivedAt` (default: now).
 *
 * @throws InboundPayloadError when the payload doesn't have this shape.
 */
export function fromRawJson(payload: unknown, receivedAt: Date = new Date()): InboundEmail {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new InboundPayloadError("Inbound payload must be a JSON object");
  }
  const result = rawSchema.safeParse(payload);
  if (!result.success) throw new InboundPayloadError(`Invalid inbound payload: ${describeIssues(result.error)}`);
  const p = result.data;

  const headerEntries = Array.isArray(p.headers)
    ? p.headers
    : Object.entries(p.headers ?? {}).map(([name, value]) => ({ name, value }));
  const headers = headerMap(headerEntries);
  if (p.date && !headers.date) headers.date = clip(p.date, MAX_HEADER_VALUE_CHARS);

  const from = parseMailbox(p.from);
  return {
    recipients: collectRecipients([...asList(p.to), ...asList(p.cc)], headers),
    from: from?.address ?? "",
    fromName: from?.name ?? null,
    subject: clip(p.subject ?? headers.subject ?? "", MAX_SUBJECT_CHARS),
    text: clip(p.text ?? "", MAX_BODY_CHARS),
    html: clip(p.html ?? "", MAX_BODY_CHARS),
    headers,
    date: resolveDate(p.date ?? headers.date, receivedAt),
  };
}
