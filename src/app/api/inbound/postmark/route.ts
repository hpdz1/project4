import { fromPostmark } from "@/lib/ingest";
import { basicAuthPassword, processInboundRequest } from "@/lib/server/inbound";

/**
 * Postmark inbound webhook. Configure the URL with HTTP Basic credentials,
 * e.g. https://postmark:<INBOUND_SECRET>@example.com/api/inbound/postmark
 * (any username; the password must equal INBOUND_SECRET). Failed auth is a 401
 * (Postmark retries it), never a 403 (which would stop retries for good).
 */
export async function POST(request: Request): Promise<Response> {
  return processInboundRequest(request, {
    presentedSecret: basicAuthPassword,
    challenge: 'Basic realm="Package Radar inbound", charset="UTF-8"',
    normalize: fromPostmark,
  });
}
