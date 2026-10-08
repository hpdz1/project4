import { randomUUID } from "node:crypto";
import { DuplicateAccountError, toAccountView, type AccountRecord, type Store } from "@/lib/store";
import type { AccountResponse } from "@/lib/types";
import type { ServerConfig } from "./config";
import { generateAccountKey, generateAlias, hashKey } from "./crypto";

/** How often account creation retries after a (astronomically unlikely) id/alias/key collision. */
const CREATE_ATTEMPTS = 3;

export interface NewAccountFields {
  country: string;
  postalCode: string | null;
  region: string | null;
  timezone: string;
}

/**
 * Creates an account with a fresh id, inbound alias and sign-in key. Returns
 * the record and the plain key, which is never stored (only its hash).
 */
export async function createAccount(
  store: Store,
  fields: NewAccountFields,
  now: Date,
): Promise<{ record: AccountRecord; accountKey: string }> {
  for (let attempt = 1; ; attempt++) {
    const accountKey = generateAccountKey();
    try {
      const record = await store.createAccount({
        id: randomUUID(),
        alias: generateAlias(),
        keyHash: hashKey(accountKey),
        ...fields,
        now: now.toISOString(),
      });
      return { record, accountKey };
    } catch (err) {
      if (!(err instanceof DuplicateAccountError) || attempt >= CREATE_ATTEMPTS) throw err;
    }
  }
}

/** Body for GET/PATCH /api/account and POST /api/session. */
export function accountResponse(record: AccountRecord, config: ServerConfig): AccountResponse {
  return { account: toAccountView(record, config.inboundDomain), demoMode: config.demoMode };
}
