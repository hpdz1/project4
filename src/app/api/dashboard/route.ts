import { buildDashboard } from "@/lib/dashboard";
import { getStore, toAccountView } from "@/lib/store";
import { getServerConfig } from "@/lib/server/config";
import { handleApi, json } from "@/lib/server/http";
import { requireSessionAccount } from "@/lib/server/session";
import type { DashboardResponse } from "@/lib/types";

/** Forwarding confirmations older than this are not worth showing. */
const VERIFICATION_WINDOW_MS = 48 * 60 * 60 * 1000;

/** The answer page's data: "is anything on the way to my home?" */
export async function GET(request: Request): Promise<Response> {
  return handleApi(async () => {
    const config = getServerConfig();
    const store = getStore();
    const account = await requireSessionAccount(request, store);
    const now = new Date();
    const since = new Date(now.getTime() - VERIFICATION_WINDOW_MS).toISOString();
    const [shipments, stats, verifications] = await Promise.all([
      store.listShipments(account.id),
      store.getEmailStats(account.id),
      store.listVerifications(account.id, since),
    ]);
    return json<DashboardResponse>(
      buildDashboard({
        account: toAccountView(account, config.inboundDomain),
        shipments,
        feeds: stats.feeds,
        verifications,
        emailsReceived: stats.count,
        lastEmailAt: stats.lastAt,
        now,
        demoMode: config.demoMode,
      }),
    );
  });
}
