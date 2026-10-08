import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getDashboard } from "@/app/api/dashboard/route";
import type { MemoryStore } from "@/lib/store";
import { apiRequest, createTestAccount, resetTestEnv, setupTestEnv } from "@/lib/server/test-helpers";
import type { ApiError, DashboardResponse, ShipmentUpdate, StoredShipment } from "@/lib/types";
import { PATCH } from "./route";

let store: MemoryStore;

beforeEach(() => {
  store = setupTestEnv();
});
afterEach(() => resetTestEnv());

function update(trackingNumber: string): ShipmentUpdate {
  const now = new Date();
  return {
    carrier: "ups",
    trackingNumber,
    orderRef: null,
    shipper: "NORTHWIND HOME GOODS",
    description: null,
    status: "in_transit",
    expectedDelivery: null,
    expectedWindow: null,
    deliveredAt: null,
    eventAt: new Date(now.getTime() - 60_000).toISOString(),
    source: "ups",
  };
}

async function accountWithShipment(id: string) {
  const account = await createTestAccount(store);
  await store.applyUpdates(account.record.id, [update("1Z999AA10987654328")], () => id);
  return account;
}

const patch = (id: string, body: unknown, session?: string, origin?: string | null) =>
  PATCH(apiRequest(`/api/shipments/${encodeURIComponent(id)}`, { method: "PATCH", body, session, origin }), {
    params: Promise.resolve({ id }),
  });

describe("PATCH /api/shipments/[id]", () => {
  it("hides a shipment and marks one delivered", async () => {
    const { key } = await accountWithShipment("ship-a");
    const before = (await (await getDashboard(apiRequest("/api/dashboard", { session: key }))).json()) as DashboardResponse;
    expect(before.shipments.map((s) => s.id)).toEqual(["ship-a"]);

    const delivered = await patch("ship-a", { delivered: true }, key);
    expect(delivered.status).toBe(200);
    expect(delivered.headers.get("cache-control")).toBe("no-store");
    const { shipment } = (await delivered.json()) as { shipment: StoredShipment };
    expect(shipment).toMatchObject({ id: "ship-a", userMarkedDelivered: true, hidden: false });

    const hidden = await patch("ship-a", { hidden: true }, key);
    expect(((await hidden.json()) as { shipment: StoredShipment }).shipment).toMatchObject({ hidden: true, userMarkedDelivered: true });

    const after = (await (await getDashboard(apiRequest("/api/dashboard", { session: key }))).json()) as DashboardResponse;
    expect(after.shipments).toEqual([]);
  });

  it("is a 404 for another account's shipment, and changes nothing", async () => {
    const owner = await accountWithShipment("ship-owner");
    const other = await createTestAccount(store);
    const res = await patch("ship-owner", { hidden: true }, other.key);
    expect(res.status).toBe(404);
    expect(((await res.json()) as ApiError).error.code).toBe("not_found");
    const [shipment] = await store.listShipments(owner.record.id);
    expect(shipment.hidden).toBe(false);
  });

  it("is a 404 for unknown ids", async () => {
    const { key } = await accountWithShipment("ship-a");
    expect((await patch("nope", { hidden: true }, key)).status).toBe(404);
    expect((await patch("x".repeat(500), { hidden: true }, key)).status).toBe(404);
  });

  it("validates the body", async () => {
    const { key } = await accountWithShipment("ship-a");
    for (const body of [{}, { hidden: "yes" }, { delivered: 1 }, null]) {
      const res = await patch("ship-a", body, key);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it("needs a session and a same-origin request", async () => {
    const { key } = await accountWithShipment("ship-a");
    expect((await patch("ship-a", { hidden: true })).status).toBe(401);
    expect((await patch("ship-a", { hidden: true }, key, null)).status).toBe(403);
    expect((await patch("ship-a", { hidden: true }, key, "https://evil.example")).status).toBe(403);
  });
});
