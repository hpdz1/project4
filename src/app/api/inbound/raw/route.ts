import { fromRawJson } from "@/lib/ingest";
import { bearerToken, processInboundRequest } from "@/lib/server/inbound";

/**
 * Generic JSON inbound email (`{ from, to, cc?, subject?, text?, html?, headers?, date? }`),
 * e.g. from the Cloudflare Email Worker in workers/inbound-email.
 * Requires `Authorization: Bearer <INBOUND_SECRET>`.
 */
export async function POST(request: Request): Promise<Response> {
  return processInboundRequest(request, {
    presentedSecret: bearerToken,
    challenge: 'Bearer realm="Package Radar inbound"',
    normalize: fromRawJson,
  });
}
