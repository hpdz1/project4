import { randomUUID } from "node:crypto";
import { InboundPayloadError, findInboundAlias, parseEmail } from "@/lib/ingest";
import { getStore, type Store } from "@/lib/store";
import type { InboundEmail, ParsedEmail } from "@/lib/types";
import { getServerConfig, type ServerConfig } from "./config";
import { safeEqual } from "./crypto";
import { HttpError, handleApi, json, readJsonBody } from "./http";
import { consumeRateLimit } from "./rate-limit";

/**
 * Inbound email plumbing shared by the webhook routes: route an email to its
 * account by inbound alias, parse it, and store only the extracted facts
 * (shipment updates, forwarding confirmations, a metadata log row). Raw
 * bodies are never stored.
 */

/** Largest inbound webhook body accepted (Postmark JSON or the worker's JSON). */
export const MAX_INBOUND_BYTES = 2 * 1024 * 1024;

export interface InboundResult {
  /** stored: processed for an account; unroutable: no account for this address; rate_limited: dropped. */
  status: "stored" | "unroutable" | "rate_limited";
  kind?: ParsedEmail["kind"];
  /** Shipments created or changed. */
  updates?: number;
}

export interface InboundDeps {
  store?: Store;
  config?: ServerConfig;
  newId?: () => string;
  /** Count the email against the per-alias daily limit (default true; demo seeding passes false). */
  rateLimit?: boolean;
}

/** Lowercase domain of a bare email address (InboundEmail.from), e.g. "ups.com"; null when there is none. */
export function senderDomain(from: string): string | null {
  const at = from.lastIndexOf("@");
  if (at < 0) return null;
  const domain = from.slice(at + 1).trim().toLowerCase().replace(/[>\s].*$/, "").replace(/\.$/, "");
  return /^[a-z0-9.-]{1,253}$/.test(domain) && domain.includes(".") ? domain : null;
}

/**
 * Routes, parses and stores one inbound email. Mail for an unknown alias is
 * "unroutable"; more than the per-alias daily limit is "rate_limited". Both
 * are dropped without error so webhook providers don't retry them.
 * Store failures propagate (the route answers 500 and the provider retries).
 */
export async function handleInbound(email: InboundEmail, now: Date, deps: InboundDeps = {}): Promise<InboundResult> {
  const store = deps.store ?? getStore();
  const config = deps.config ?? getServerConfig();
  const newId = deps.newId ?? randomUUID;

  const alias = findInboundAlias(email, config.inboundDomain);
  if (!alias) return { status: "unroutable" };
  const account = await store.getAccountByAlias(alias);
  if (!account) return { status: "unroutable" };
  const limited =
    deps.rateLimit !== false && !consumeRateLimit("inbound_alias", account.alias.toLowerCase(), now.getTime()).allowed;
  if (limited) return { status: "rate_limited" };

  const parsed = parseEmail(email, { timezone: account.timezone });
  const changed = parsed.updates.length ? await store.applyUpdates(account.id, parsed.updates, newId) : [];
  if (parsed.verification) await store.addVerification(account.id, parsed.verification);
  await store.recordEmail(account.id, {
    receivedAt: email.date,
    kind: parsed.kind,
    senderDomain: senderDomain(email.from),
    updates: parsed.updates.length,
    note: parsed.note,
  });
  return { status: "stored", kind: parsed.kind, updates: changed.length };
}

// ---------------------------------------------------------------------------
// Webhook authentication
// ---------------------------------------------------------------------------

function authorization(request: Request, scheme: "basic" | "bearer"): string | null {
  const header = request.headers.get("authorization")?.trim();
  if (!header) return null;
  const space = header.indexOf(" ");
  if (space < 0 || header.slice(0, space).toLowerCase() !== scheme) return null;
  const value = header.slice(space + 1).trim();
  return value || null;
}

/** The password from an `Authorization: Basic` header (any username), or null. */
export function basicAuthPassword(request: Request): string | null {
  const encoded = authorization(request, "basic");
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const colon = decoded.indexOf(":");
  return colon < 0 ? null : decoded.slice(colon + 1);
}

/** The token from an `Authorization: Bearer` header, or null. */
export function bearerToken(request: Request): string | null {
  return authorization(request, "bearer");
}

export interface InboundRouteOptions {
  /** The secret the caller presented, or null. */
  presentedSecret: (request: Request) => string | null;
  /** WWW-Authenticate challenge for 401 answers. */
  challenge: string;
  /** Webhook JSON -> InboundEmail; throws InboundPayloadError on a bad shape. */
  normalize: (payload: unknown, receivedAt: Date) => InboundEmail;
}

/**
 * The whole inbound webhook flow: 503 when INBOUND_SECRET is unset, 401 for
 * a missing or wrong secret, 415/413/400 for bad bodies, 400 invalid_input for
 * a payload of the wrong shape, else 200 `{ ok: true, status, kind?, updates? }`
 * (also for unroutable or rate-limited mail, so providers don't retry it).
 */
export function processInboundRequest(request: Request, options: InboundRouteOptions): Promise<Response> {
  return handleApi(async () => {
    const config = getServerConfig();
    if (!config.inboundSecret) {
      throw new HttpError(503, "inbound_disabled", "Inbound email is not configured on this server.");
    }
    const presented = options.presentedSecret(request);
    if (presented === null || !safeEqual(presented, config.inboundSecret)) {
      throw new HttpError(401, "unauthorized", "Missing or wrong inbound credentials.", {
        "WWW-Authenticate": options.challenge,
      });
    }
    const payload = await readJsonBody(request, MAX_INBOUND_BYTES);
    const now = new Date();
    let email: InboundEmail;
    try {
      email = options.normalize(payload, now);
    } catch (err) {
      if (err instanceof InboundPayloadError) throw new HttpError(400, "invalid_input", err.message);
      throw err;
    }
    const result = await handleInbound(email, now, { config });
    return json({ ok: true as const, ...result });
  });
}
