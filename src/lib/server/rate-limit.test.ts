import { afterEach, describe, expect, it } from "vitest";
import { HttpError } from "./http";
import { RATE_LIMITS, consumeRateLimit, enforceRateLimit, resetRateLimits } from "./rate-limit";

const T0 = Date.parse("2026-10-08T12:00:00Z");
const HOUR = 60 * 60 * 1000;

describe("rate limiter", () => {
  afterEach(() => resetRateLimits());

  it("has the documented limits", () => {
    expect(RATE_LIMITS.account_create).toEqual({ limit: 10, windowMs: HOUR });
    expect(RATE_LIMITS.session_sign_in).toEqual({ limit: 20, windowMs: HOUR });
    expect(RATE_LIMITS.inbound_alias).toEqual({ limit: 300, windowMs: 24 * HOUR });
    expect(RATE_LIMITS.demo_seed).toEqual({ limit: 20, windowMs: HOUR });
  });

  it("allows up to the limit per window, then denies until the window ends", () => {
    for (let i = 0; i < 10; i++) {
      const r = consumeRateLimit("account_create", "1.2.3.4", T0 + i);
      expect(r).toMatchObject({ allowed: true, remaining: 9 - i });
    }
    const denied = consumeRateLimit("account_create", "1.2.3.4", T0 + 30 * 60 * 1000);
    expect(denied).toMatchObject({ allowed: false, remaining: 0, retryAfterSeconds: 30 * 60 });
    expect(consumeRateLimit("account_create", "1.2.3.4", T0 + HOUR - 1).allowed).toBe(false);
    expect(consumeRateLimit("account_create", "1.2.3.4", T0 + HOUR).allowed).toBe(true);
  });

  it("keeps keys and buckets apart", () => {
    for (let i = 0; i < 10; i++) consumeRateLimit("account_create", "a", T0);
    expect(consumeRateLimit("account_create", "a", T0).allowed).toBe(false);
    expect(consumeRateLimit("account_create", "b", T0).allowed).toBe(true);
    expect(consumeRateLimit("session_sign_in", "a", T0).allowed).toBe(true);
  });

  it("counts 300 inbound emails per alias per day", () => {
    for (let i = 0; i < 300; i++) expect(consumeRateLimit("inbound_alias", "r-x", T0 + i).allowed).toBe(true);
    expect(consumeRateLimit("inbound_alias", "r-x", T0 + 23 * HOUR).allowed).toBe(false);
    expect(consumeRateLimit("inbound_alias", "r-x", T0 + 24 * HOUR).allowed).toBe(true);
  });

  it("enforceRateLimit throws 429 with Retry-After", () => {
    for (let i = 0; i < 20; i++) enforceRateLimit("demo_seed", "acct", T0);
    let caught: unknown;
    try {
      enforceRateLimit("demo_seed", "acct", T0 + 1000);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(HttpError);
    const err = caught as HttpError;
    expect(err.status).toBe(429);
    expect(err.code).toBe("rate_limited");
    expect(err.headers["Retry-After"]).toBe(String(HOUR / 1000 - 1));
  });

  it("forgets expired counters", () => {
    for (let i = 0; i < 10; i++) consumeRateLimit("account_create", "gone", T0);
    // A later call far in the future sweeps the old entry; the key starts fresh.
    expect(consumeRateLimit("account_create", "other", T0 + 2 * HOUR).allowed).toBe(true);
    expect(consumeRateLimit("account_create", "gone", T0 + 2 * HOUR)).toMatchObject({ allowed: true, remaining: 9 });
  });
});
