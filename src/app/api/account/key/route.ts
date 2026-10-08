import { getStore } from "@/lib/store";
import { accountResponse } from "@/lib/server/account";
import { getServerConfig } from "@/lib/server/config";
import { generateAccountKey, hashKey } from "@/lib/server/crypto";
import { assertSameOrigin, errorJson, handleApi, json } from "@/lib/server/http";
import { clearSessionCookie, requireSessionAccount, setSessionCookie } from "@/lib/server/session";
import type { AccountCreatedResponse } from "@/lib/types";

/**
 * Rotate the sign-in key: the old key (and every device signed in with it)
 * stops working; this browser gets the new key in its cookie. No body needed.
 */
export async function POST(request: Request): Promise<Response> {
  return handleApi(async () => {
    const config = getServerConfig();
    assertSameOrigin(request, config);
    const account = await requireSessionAccount(request);
    const accountKey = generateAccountKey();
    const updated = await getStore().updateAccount(account.id, { keyHash: hashKey(accountKey) }, new Date().toISOString());
    if (!updated) {
      const gone = errorJson(401, "unauthorized", "You're not signed in.");
      clearSessionCookie(gone, config);
      return gone;
    }
    const response = json<AccountCreatedResponse>({ ...accountResponse(updated, config), accountKey });
    setSessionCookie(response, accountKey, config);
    return response;
  });
}
