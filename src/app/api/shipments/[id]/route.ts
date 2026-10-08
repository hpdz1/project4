import { getStore } from "@/lib/store";
import { getServerConfig } from "@/lib/server/config";
import { HttpError, assertSameOrigin, handleApi, json, parseInput, readJsonBody } from "@/lib/server/http";
import { updateShipmentSchema } from "@/lib/server/schemas";
import { requireSessionAccount } from "@/lib/server/session";
import type { StoredShipment } from "@/lib/types";

/** Hide a shipment ("not mine") and/or mark it delivered. Returns `{ shipment }`. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return handleApi(async () => {
    const config = getServerConfig();
    assertSameOrigin(request, config);
    const store = getStore();
    const account = await requireSessionAccount(request, store);
    const { id } = await context.params;
    const flags = parseInput(updateShipmentSchema, await readJsonBody(request));
    const notFound = new HttpError(404, "not_found", "No such shipment.");
    if (!id || id.length > 128) throw notFound;

    const shipment = await store.setShipmentFlags(account.id, id, {
      hidden: flags.hidden,
      userMarkedDelivered: flags.delivered,
    });
    if (!shipment) throw notFound;
    return json<{ shipment: StoredShipment }>({ shipment });
  });
}
