import { getStore } from "@/lib/store";
import { accountResponse, createAccount } from "@/lib/server/account";
import { getServerConfig } from "@/lib/server/config";
import { assertSameOrigin, clientIp, errorJson, handleApi, json, parseInput, readJsonBody } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { createAccountSchema, updateAccountSchema } from "@/lib/server/schemas";
import { clearSessionCookie, requireSessionAccount, setSessionCookie } from "@/lib/server/session";
import type { AccountCreatedResponse, AccountResponse } from "@/lib/types";

/** Create an account: sets the session cookie and returns the sign-in key (shown once). */
export async function POST(request: Request): Promise<Response> {
  return handleApi(async () => {
    const config = getServerConfig();
    assertSameOrigin(request, config);
    const input = parseInput(createAccountSchema, await readJsonBody(request));
    const now = new Date();
    enforceRateLimit("account_create", clientIp(request, config) ?? "direct", now.getTime());

    const { record, accountKey } = await createAccount(
      getStore(),
      {
        country: input.country,
        postalCode: input.postalCode ?? null,
        region: input.region ?? null,
        timezone: input.timezone,
      },
      now,
    );
    const response = json<AccountCreatedResponse>({ ...accountResponse(record, config), accountKey }, { status: 201 });
    setSessionCookie(response, accountKey, config);
    return response;
  });
}

/** The signed-in account. */
export async function GET(request: Request): Promise<Response> {
  return handleApi(async () => {
    const account = await requireSessionAccount(request);
    return json<AccountResponse>(accountResponse(account, getServerConfig()));
  });
}

/** Update postal code / region / time zone / program checklist. */
export async function PATCH(request: Request): Promise<Response> {
  return handleApi(async () => {
    const config = getServerConfig();
    assertSameOrigin(request, config);
    const account = await requireSessionAccount(request);
    const patch = parseInput(updateAccountSchema, await readJsonBody(request));
    const updated = await getStore().updateAccount(account.id, patch, new Date().toISOString());
    if (!updated) {
      const response = errorJson(401, "unauthorized", "You're not signed in.");
      clearSessionCookie(response, config);
      return response;
    }
    return json<AccountResponse>(accountResponse(updated, config));
  });
}

/** Delete the account and everything stored for it, and sign out. */
export async function DELETE(request: Request): Promise<Response> {
  return handleApi(async () => {
    const config = getServerConfig();
    assertSameOrigin(request, config);
    const account = await requireSessionAccount(request);
    await getStore().deleteAccount(account.id);
    const response = json({ ok: true as const });
    clearSessionCookie(response, config);
    return response;
  });
}
