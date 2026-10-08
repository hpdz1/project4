import { sampleEmails } from "@/lib/ingest";
import { getStore } from "@/lib/store";
import { getServerConfig } from "@/lib/server/config";
import { HttpError, assertSameOrigin, handleApi, json } from "@/lib/server/http";
import { handleInbound } from "@/lib/server/inbound";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requireSessionAccount } from "@/lib/server/session";

/**
 * Demo mode only: runs the built-in sample carrier emails (USPS, UPS, FedEx,
 * Amazon and a Gmail forwarding confirmation) through the normal inbound
 * pipeline for the signed-in account. Returns `{ added, updates }`: emails
 * ingested and shipment changes. No body needed.
 */
export async function POST(request: Request): Promise<Response> {
  return handleApi(async () => {
    const config = getServerConfig();
    assertSameOrigin(request, config);
    const store = getStore();
    const account = await requireSessionAccount(request, store);
    if (!config.demoMode) throw new HttpError(403, "demo_disabled", "Sample emails are only available in demo mode.");
    const now = new Date();
    enforceRateLimit("demo_seed", account.id, now.getTime());

    const emails = sampleEmails({
      now,
      alias: account.alias,
      inboundDomain: config.inboundDomain,
      timezone: account.timezone,
    });
    let added = 0;
    let updates = 0;
    for (const email of emails) {
      // Samples don't use up the account's real inbound quota (the seed route has its own limit).
      const result = await handleInbound(email, now, { store, config, rateLimit: false });
      if (result.status === "stored") {
        added += 1;
        updates += result.updates ?? 0;
      }
    }
    return json({ added, updates });
  });
}
