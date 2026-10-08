import { getStore } from "@/lib/store";
import { accountResponse } from "@/lib/server/account";
import { getServerConfig } from "@/lib/server/config";
import { hashKey } from "@/lib/server/crypto";
import { HttpError, assertSameOrigin, clientIp, handleApi, json, parseInput, readJsonBody } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { signInSchema } from "@/lib/server/schemas";
import { clearSessionCookie, setSessionCookie } from "@/lib/server/session";
import type { AccountResponse } from "@/lib/types";

/** Shape of keys we issue (base64url). Anything else can't match, but is still hashed and looked up. */
const KEY_RE = /^[A-Za-z0-9_-]{16,128}$/;

/**
 * Sign in with an account key (e.g. on another device): sets the session
 * cookie. Every attempt counts toward the per-IP limit, and every failure
 * gets the same answer, whatever the reason.
 */
export async function POST(request: Request): Promise<Response> {
  return handleApi(async () => {
    const config = getServerConfig();
    assertSameOrigin(request, config);
    const { accountKey } = parseInput(signInSchema, await readJsonBody(request));
    enforceRateLimit("session_sign_in", clientIp(request, config) ?? "direct", Date.now());

    const key = accountKey.trim();
    // Same work for well- and badly-formed keys: hash and look up either way.
    const account = await getStore().getAccountByKeyHash(hashKey(key));
    if (!account || !KEY_RE.test(key)) {
      throw new HttpError(401, "unauthorized", "That key didn't work. Check it and try again.");
    }
    const response = json<AccountResponse>(accountResponse(account, config));
    setSessionCookie(response, key, config);
    return response;
  });
}

/** Sign out on this device (the key keeps working elsewhere). Always succeeds. */
export async function DELETE(request: Request): Promise<Response> {
  return handleApi(async () => {
    const config = getServerConfig();
    assertSameOrigin(request, config);
    const response = json({ ok: true as const });
    clearSessionCookie(response, config);
    return response;
  });
}
