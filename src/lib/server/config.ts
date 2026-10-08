/**
 * Server-only settings for route handlers, read from the environment on every
 * call (nothing is cached at module level, so tests can stub env vars).
 * Public NEXT_PUBLIC_* values live in src/lib/site.ts instead.
 */

export interface ServerConfig {
  /** Domain of the inbound addresses, e.g. "in.example.com" (lowercase, no "@"). */
  inboundDomain: string;
  /** Shared secret for the inbound webhooks; null disables them (503 inbound_disabled). */
  inboundSecret: string | null;
  /** SQLite file (the store reads DATABASE_PATH itself); null = the store's default. */
  databasePath: string | null;
  /** Sample-email seeding (POST /api/demo/seed) is available. */
  demoMode: boolean;
  /** Mark the session cookie Secure (HTTPS only). */
  secureCookies: boolean;
  /** Behind a reverse proxy: read the client IP from X-Forwarded-For and the host from X-Forwarded-Host. */
  trustProxy: boolean;
}

export const DEFAULT_INBOUND_DOMAIN = "inbound.localhost";

type Env = Record<string, string | undefined>;

function normalizeDomain(raw: string | undefined): string {
  const domain = (raw ?? "").trim().toLowerCase().replace(/^@+/, "").replace(/\.+$/, "");
  return domain || DEFAULT_INBOUND_DOMAIN;
}

function flag(raw: string | undefined): boolean | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return null;
}

/**
 * Current server configuration:
 * - INBOUND_DOMAIN (default "inbound.localhost");
 * - INBOUND_SECRET (unset or blank = inbound webhooks disabled);
 * - DATABASE_PATH;
 * - DEMO_MODE ("1" on, "0" off; unset = on only when NODE_ENV is "development");
 * - NODE_ENV "production" = Secure cookies;
 * - TRUST_PROXY ("1" = trust X-Forwarded-For / X-Forwarded-Host from one reverse proxy).
 */
export function getServerConfig(env: Env = process.env): ServerConfig {
  const secret = env.INBOUND_SECRET?.trim();
  return {
    inboundDomain: normalizeDomain(env.INBOUND_DOMAIN),
    inboundSecret: secret ? secret : null,
    databasePath: env.DATABASE_PATH?.trim() || null,
    demoMode: flag(env.DEMO_MODE) ?? env.NODE_ENV === "development",
    secureCookies: env.NODE_ENV === "production",
    trustProxy: flag(env.TRUST_PROXY) === true,
  };
}
