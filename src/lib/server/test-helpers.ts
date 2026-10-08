import { vi } from "vitest";
import { MemoryStore, setStore, type AccountRecord } from "@/lib/store";
import type { InboundEmail } from "@/lib/types";
import { createAccount, type NewAccountFields } from "./account";
import { resetRateLimits } from "./rate-limit";
import { SESSION_COOKIE } from "./session";

/**
 * Helpers for route-handler tests (imported only by *.test.ts files): a fresh
 * MemoryStore and rate limiter per test, env stubs, and request builders.
 */

export const TEST_HOST = "radar.test";
export const TEST_ORIGIN = `https://${TEST_HOST}`;
export const TEST_INBOUND_DOMAIN = "in.radar.test";
export const TEST_INBOUND_SECRET = "test-inbound-secret-0123456789abcdef";

/** Fresh store and limiter, standard env. Call from beforeEach; pair with `resetTestEnv` in afterEach. */
export function setupTestEnv(env: Record<string, string> = {}): MemoryStore {
  const store = new MemoryStore();
  setStore(store);
  resetRateLimits();
  vi.stubEnv("INBOUND_DOMAIN", TEST_INBOUND_DOMAIN);
  vi.stubEnv("INBOUND_SECRET", TEST_INBOUND_SECRET);
  vi.stubEnv("DEMO_MODE", "1");
  vi.stubEnv("TRUST_PROXY", "");
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  return store;
}

export function resetTestEnv(): void {
  vi.unstubAllEnvs();
  setStore(null);
  resetRateLimits();
}

export interface RequestOptions {
  method?: string;
  /** JSON-encoded unless `rawBody` is given. */
  body?: unknown;
  rawBody?: string;
  /** Session key to send as the pr_session cookie. */
  session?: string | null;
  /** Origin header; null omits it. Default: TEST_ORIGIN. */
  origin?: string | null;
  contentType?: string | null;
  headers?: Record<string, string>;
}

/** A request to this test server (Host: TEST_HOST), with a same-site Origin by default. */
export function apiRequest(path: string, opts: RequestOptions = {}): Request {
  const headers = new Headers({ host: TEST_HOST, ...opts.headers });
  const origin = opts.origin === undefined ? TEST_ORIGIN : opts.origin;
  if (origin !== null) headers.set("origin", origin);
  if (opts.session) headers.set("cookie", `${SESSION_COOKIE}=${opts.session}`);
  let body: string | undefined;
  if (opts.rawBody !== undefined) body = opts.rawBody;
  else if (opts.body !== undefined) body = JSON.stringify(opts.body);
  const contentType = opts.contentType === undefined ? (body !== undefined ? "application/json" : null) : opts.contentType;
  if (contentType) headers.set("content-type", contentType);
  return new Request(`${TEST_ORIGIN}${path}`, { method: opts.method ?? "GET", headers, body });
}

/** The pr_session value a response sets ("" when it clears it), or null when it doesn't touch it. */
export function sessionCookie(response: Response): string | null {
  for (const line of response.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    if (pair.slice(0, eq).trim() === SESSION_COOKIE) return pair.slice(eq + 1);
  }
  return null;
}

/** The full Set-Cookie line for pr_session. */
export function sessionCookieLine(response: Response): string | null {
  return response.headers.getSetCookie().find((line) => line.startsWith(`${SESSION_COOKIE}=`)) ?? null;
}

/** An InboundEmail as the generic JSON the worker posts to /api/inbound/raw. */
export function toRawJson(email: InboundEmail): Record<string, unknown> {
  return {
    from: email.fromName ? `${email.fromName} <${email.from}>` : email.from,
    to: email.recipients,
    subject: email.subject,
    text: email.text,
    html: email.html,
    headers: email.headers,
    date: email.headers.date ?? email.date,
  };
}

/** Creates an account straight in the store (bypassing the route and its rate limit). */
export async function createTestAccount(
  store: MemoryStore,
  fields: Partial<NewAccountFields> = {},
): Promise<{ key: string; record: AccountRecord }> {
  const { record, accountKey } = await createAccount(
    store,
    { country: "US", postalCode: "94107", region: "CA", timezone: "America/Los_Angeles", ...fields },
    new Date(),
  );
  return { key: accountKey, record };
}
