import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { MemoryStore } from "@/lib/store";
import { getServerConfig } from "./config";
import { generateAccountKey, hashKey } from "./crypto";
import { HttpError } from "./http";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  getSessionAccount,
  readSessionKey,
  requireSessionAccount,
  setSessionCookie,
} from "./session";

const withCookie = (cookie: string) => new Request("http://localhost/", { headers: { cookie } });

describe("readSessionKey", () => {
  it("finds the pr_session cookie among others", () => {
    const key = generateAccountKey();
    expect(readSessionKey(withCookie(`a=1; ${SESSION_COOKIE}=${key}; b=2`))).toBe(key);
    expect(readSessionKey(withCookie(`${SESSION_COOKIE}="${key}"`))).toBe(key);
  });

  it("ignores missing, empty and malformed values", () => {
    expect(readSessionKey(new Request("http://localhost/"))).toBeNull();
    expect(readSessionKey(withCookie("other=1"))).toBeNull();
    expect(readSessionKey(withCookie(`${SESSION_COOKIE}=`))).toBeNull();
    expect(readSessionKey(withCookie(`${SESSION_COOKIE}=short`))).toBeNull();
    expect(readSessionKey(withCookie(`${SESSION_COOKIE}=${"a".repeat(20)}%20x`))).toBeNull();
  });
});

describe("getSessionAccount", () => {
  it("looks the account up by the key's hash", async () => {
    const store = new MemoryStore();
    const key = generateAccountKey();
    const record = await store.createAccount({
      id: "acct-1",
      alias: "r-aaaaaaaaaaaaaaaa",
      keyHash: hashKey(key),
      country: "US",
      postalCode: null,
      region: null,
      timezone: "America/New_York",
      now: "2026-10-08T12:00:00.000Z",
    });
    expect(await getSessionAccount(withCookie(`${SESSION_COOKIE}=${key}`), store)).toEqual(record);
    expect(await getSessionAccount(withCookie(`${SESSION_COOKIE}=${generateAccountKey()}`), store)).toBeNull();
    await expect(requireSessionAccount(new Request("http://localhost/"), store)).rejects.toMatchObject({
      status: 401,
      code: "unauthorized",
    });
    await expect(requireSessionAccount(new Request("http://localhost/"), store)).rejects.toBeInstanceOf(HttpError);
  });
});

describe("session cookie", () => {
  it("is httpOnly, SameSite=Lax, path /, 400 days; Secure only in production", () => {
    const dev = NextResponse.json({});
    setSessionCookie(dev, "k".repeat(43), getServerConfig({ NODE_ENV: "development" }));
    const line = dev.headers.get("set-cookie") ?? "";
    expect(line).toContain(`${SESSION_COOKIE}=${"k".repeat(43)}`);
    expect(line).toContain("HttpOnly");
    expect(line.toLowerCase()).toContain("samesite=lax");
    expect(line).toContain("Path=/");
    expect(line).toContain("Max-Age=34560000");
    expect(line).not.toContain("Secure");

    const prod = NextResponse.json({});
    setSessionCookie(prod, "k".repeat(43), getServerConfig({ NODE_ENV: "production" }));
    expect(prod.headers.get("set-cookie")).toContain("Secure");
  });

  it("clears with an empty, immediately expiring cookie", () => {
    const res = NextResponse.json({});
    clearSessionCookie(res, getServerConfig({}));
    const line = res.headers.get("set-cookie") ?? "";
    expect(line).toMatch(new RegExp(`^${SESSION_COOKIE}=;`));
    expect(line).toContain("Max-Age=0");
  });
});
