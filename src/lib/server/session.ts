import type { NextResponse } from "next/server";
import { getStore, type AccountRecord, type Store } from "@/lib/store";
import { getServerConfig, type ServerConfig } from "./config";
import { hashKey } from "./crypto";
import { HttpError } from "./http";

/**
 * The session is the account's secret sign-in key itself, in an httpOnly
 * cookie. The server only stores its SHA-256 hash, so rotating the key (or
 * deleting the account) signs out every device at once.
 */

export const SESSION_COOKIE = "pr_session";

/** 400 days, the longest lifetime browsers accept for a cookie. */
export const SESSION_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/** Shape of a key we might have issued (base64url); anything else is never looked up. */
const KEY_RE = /^[A-Za-z0-9_-]{16,128}$/;

/** The session cookie's value from the Cookie header, if it looks like a key. */
export function readSessionKey(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0 || part.slice(0, eq).trim() !== SESSION_COOKIE) continue;
    let value = part.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) value = value.slice(1, -1);
    return KEY_RE.test(value) ? value : null;
  }
  return null;
}

/** The signed-in account, or null when there is no (valid) session cookie. */
export async function getSessionAccount(request: Request, store: Store = getStore()): Promise<AccountRecord | null> {
  const key = readSessionKey(request);
  if (!key) return null;
  return store.getAccountByKeyHash(hashKey(key));
}

/**
 * The signed-in account.
 * @throws HttpError 401 unauthorized when there is none.
 */
export async function requireSessionAccount(request: Request, store: Store = getStore()): Promise<AccountRecord> {
  const account = await getSessionAccount(request, store);
  if (!account) throw new HttpError(401, "unauthorized", "You're not signed in.");
  return account;
}

function cookieOptions(config: ServerConfig, maxAge: number) {
  return { httpOnly: true, sameSite: "lax" as const, path: "/", secure: config.secureCookies, maxAge };
}

/** Sets the session cookie to `key` (httpOnly, SameSite=Lax, Secure in production, 400 days). */
export function setSessionCookie(response: NextResponse, key: string, config: ServerConfig = getServerConfig()): void {
  response.cookies.set(SESSION_COOKIE, key, cookieOptions(config, SESSION_MAX_AGE_SECONDS));
}

/** Expires the session cookie. */
export function clearSessionCookie(response: NextResponse, config: ServerConfig = getServerConfig()): void {
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(config, 0));
}
