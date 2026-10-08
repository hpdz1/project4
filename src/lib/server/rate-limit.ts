import { HttpError } from "./http";

/**
 * In-memory fixed-window rate limiter, one counter per bucket + key. Good for
 * a single server process (the SQLite deployment model); counters reset when
 * the process restarts. Cached on globalThis so Next dev's hot reloads keep it.
 */

export type RateLimitBucket = "account_create" | "session_sign_in" | "inbound_alias" | "demo_seed";

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const RATE_LIMITS: Readonly<Record<RateLimitBucket, RateLimitRule>> = {
  /** Per client IP. */
  account_create: { limit: 10, windowMs: HOUR_MS },
  /** Per client IP; every attempt counts, successful or not. */
  session_sign_in: { limit: 20, windowMs: HOUR_MS },
  /** Per inbound alias. */
  inbound_alias: { limit: 300, windowMs: DAY_MS },
  /** Per account. */
  demo_seed: { limit: 20, windowMs: HOUR_MS },
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until this key's window resets (at least 1). */
  retryAfterSeconds: number;
}

interface Entry {
  start: number;
  windowMs: number;
  count: number;
}

interface LimiterState {
  entries: Map<string, Entry>;
  lastSweep: number;
}

/** Most counters kept; the oldest are evicted beyond this, so a flood of keys can't exhaust memory. */
const MAX_ENTRIES = 50_000;
const SWEEP_INTERVAL_MS = 60_000;

const globalLimiter = globalThis as typeof globalThis & { __packageRadarRateLimits?: LimiterState };

function state(): LimiterState {
  globalLimiter.__packageRadarRateLimits ??= { entries: new Map(), lastSweep: 0 };
  return globalLimiter.__packageRadarRateLimits;
}

function sweep(s: LimiterState, nowMs: number): void {
  if (nowMs - s.lastSweep < SWEEP_INTERVAL_MS && s.entries.size < MAX_ENTRIES) return;
  s.lastSweep = nowMs;
  for (const [key, entry] of s.entries) {
    if (nowMs >= entry.start + entry.windowMs) s.entries.delete(key);
  }
  // Still too many live counters: drop the oldest (Map iteration is insertion order).
  for (const key of s.entries.keys()) {
    if (s.entries.size < MAX_ENTRIES) break;
    s.entries.delete(key);
  }
}

/**
 * Counts one hit for `key` in `bucket` and says whether it is allowed. A
 * denied hit is not counted. The window starts at the key's first hit.
 */
export function consumeRateLimit(bucket: RateLimitBucket, key: string, nowMs: number): RateLimitResult {
  const rule = RATE_LIMITS[bucket];
  const s = state();
  sweep(s, nowMs);
  const mapKey = `${bucket}:${key}`;
  let entry = s.entries.get(mapKey);
  if (!entry || nowMs >= entry.start + rule.windowMs || nowMs < entry.start) {
    s.entries.delete(mapKey);
    entry = { start: nowMs, windowMs: rule.windowMs, count: 0 };
    s.entries.set(mapKey, entry);
  }
  const retryAfterSeconds = Math.max(1, Math.ceil((entry.start + rule.windowMs - nowMs) / 1000));
  if (entry.count >= rule.limit) {
    return { allowed: false, limit: rule.limit, remaining: 0, retryAfterSeconds };
  }
  entry.count += 1;
  return { allowed: true, limit: rule.limit, remaining: rule.limit - entry.count, retryAfterSeconds };
}

/**
 * Like `consumeRateLimit`, but throws when the limit is reached.
 * @throws HttpError 429 rate_limited with a Retry-After header.
 */
export function enforceRateLimit(bucket: RateLimitBucket, key: string, nowMs: number): void {
  const result = consumeRateLimit(bucket, key, nowMs);
  if (!result.allowed) {
    throw new HttpError(429, "rate_limited", "Too many requests. Please wait a while and try again.", {
      "Retry-After": String(result.retryAfterSeconds),
    });
  }
}

/** Forgets every counter (tests). */
export function resetRateLimits(): void {
  delete globalLimiter.__packageRadarRateLimits;
}
