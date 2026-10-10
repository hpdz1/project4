/**
 * Behavioural contract every Store implementation must pass. Not a test file
 * itself: memory.test.ts and sqlite.test.ts run it against their store.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ForwardingVerification, ShipmentUpdate } from "@/lib/types";
import { DuplicateAccountError } from "./errors";
import {
  DELIVERED_RETENTION_MS,
  EMAIL_LOG_LIMIT,
  EMAIL_LOG_RETENTION_MS,
  STALE_SHIPMENT_RETENTION_MS,
  VERIFICATION_LIMIT,
  VERIFICATION_RETENTION_MS,
} from "./limits";
import type { CreateAccountInput, EmailLogEntry, Store } from "./types";

const NOW = "2026-10-08T12:00:00.000Z";
const T1 = "2026-10-05T10:00:00.000Z";
const T2 = "2026-10-06T10:00:00.000Z";
const T3 = "2026-10-07T10:00:00.000Z";

export function accountInput(overrides: Partial<CreateAccountInput> = {}): CreateAccountInput {
  return {
    id: "acc_1",
    alias: "r-k3j9x2m4q8w1",
    keyHash: "hash-1",
    country: "US",
    postalCode: "60614",
    region: "IL",
    timezone: "America/Chicago",
    now: NOW,
    ...overrides,
  };
}

export function shipmentUpdate(overrides: Partial<ShipmentUpdate> = {}): ShipmentUpdate {
  return {
    carrier: "ups",
    trackingNumber: "1Z999AA10123456784",
    orderRef: null,
    shipper: null,
    status: "in_transit",
    expectedDelivery: null,
    expectedWindow: null,
    deliveredAt: null,
    eventAt: T2,
    source: "ups",
    ...overrides,
  };
}

function logEntry(overrides: Partial<EmailLogEntry> = {}): EmailLogEntry {
  return { receivedAt: T2, kind: "ups", senderDomain: "ups.com", updates: 1, note: null, ...overrides };
}

function verification(overrides: Partial<ForwardingVerification> = {}): ForwardingVerification {
  return { provider: "gmail", requestedBy: "me@gmail.com", code: "123456789", link: null, receivedAt: T2, ...overrides };
}

function idSequence(prefix = "shp"): () => string {
  let n = 0;
  return () => `${prefix}_${++n}`;
}

/** Registers the shared Store contract tests. `create` is called before each test and should return an empty store. */
export function describeStoreContract(name: string, create: () => Store): void {
  describe(`${name}: Store contract`, () => {
    let store: Store;

    beforeEach(() => {
      store = create();
    });

    afterEach(() => {
      store.close?.();
    });

    describe("accounts", () => {
      it("creates an account and finds it by id, key hash and alias", async () => {
        const created = await store.createAccount(accountInput());
        expect(created).toEqual({
          id: "acc_1",
          alias: "r-k3j9x2m4q8w1",
          keyHash: "hash-1",
          country: "US",
          postalCode: "60614",
          region: "IL",
          timezone: "America/Chicago",
          programs: {},
          createdAt: NOW,
          updatedAt: NOW,
        });
        expect(await store.getAccountById("acc_1")).toEqual(created);
        expect(await store.getAccountByKeyHash("hash-1")).toEqual(created);
        expect(await store.getAccountByAlias("r-k3j9x2m4q8w1")).toEqual(created);
      });

      it("returns null for unknown accounts", async () => {
        await store.createAccount(accountInput());
        expect(await store.getAccountById("nope")).toBeNull();
        expect(await store.getAccountByKeyHash("nope")).toBeNull();
        expect(await store.getAccountByAlias("r-nope")).toBeNull();
      });

      it("matches aliases case-insensitively", async () => {
        await store.createAccount(accountInput({ alias: "r-AbC123" }));
        expect((await store.getAccountByAlias("R-ABC123"))?.id).toBe("acc_1");
        expect((await store.getAccountByAlias("r-abc123"))?.alias).toBe("r-AbC123");
      });

      it("rejects a duplicate id, alias (any case) or key hash", async () => {
        await store.createAccount(accountInput());
        const dup = (overrides: Partial<CreateAccountInput>) =>
          store.createAccount(accountInput({ id: "acc_2", alias: "r-other", keyHash: "hash-2", ...overrides }));
        await expect(dup({ id: "acc_1" })).rejects.toMatchObject({ name: "DuplicateAccountError", field: "id" });
        await expect(dup({ alias: "R-K3J9X2M4Q8W1" })).rejects.toBeInstanceOf(DuplicateAccountError);
        await expect(dup({ alias: "R-K3J9X2M4Q8W1" })).rejects.toMatchObject({ field: "alias" });
        await expect(dup({ keyHash: "hash-1" })).rejects.toMatchObject({ field: "keyHash" });
        expect(await dup({})).toMatchObject({ id: "acc_2" });
      });

      it("updates only the fields in the patch", async () => {
        await store.createAccount(accountInput());
        const later = "2026-10-09T08:00:00.000Z";
        const updated = await store.updateAccount("acc_1", { postalCode: null, timezone: "America/New_York" }, later);
        expect(updated).toMatchObject({
          country: "US",
          postalCode: null,
          region: "IL",
          timezone: "America/New_York",
          createdAt: NOW,
          updatedAt: later,
        });
        expect(await store.getAccountById("acc_1")).toEqual(updated);
      });

      it("merges the programs checklist, null deleting a key", async () => {
        await store.createAccount(accountInput());
        await store.updateAccount("acc_1", { programs: { usps_informed_delivery: "done", ups_my_choice: "skipped" } }, NOW);
        const updated = await store.updateAccount(
          "acc_1",
          { programs: { ups_my_choice: null, fedex_delivery_manager: "done" } },
          NOW,
        );
        expect(updated?.programs).toEqual({ usps_informed_delivery: "done", fedex_delivery_manager: "done" });
        expect((await store.getAccountById("acc_1"))?.programs).toEqual(updated?.programs);
      });

      it("keeps only well-formed program ids with a done/skipped state", async () => {
        await store.createAccount(accountInput());
        const programs = {
          royal_mail_delivery_notifications: "done",
          jp_post_e_tracking: "skipped",
          "Bad-Key": "done",
          x: "done",
          ["a".repeat(65)]: "done",
          __proto__: "done",
          dhl_paket_app: "maybe",
        } as unknown as Record<string, "done" | "skipped">;
        const updated = await store.updateAccount("acc_1", { programs }, NOW);
        expect(updated?.programs).toEqual({ royal_mail_delivery_notifications: "done", jp_post_e_tracking: "skipped" });
        expect((await store.getAccountById("acc_1"))?.programs).toEqual(updated?.programs);
      });

      it("rotates the key hash", async () => {
        await store.createAccount(accountInput());
        await store.updateAccount("acc_1", { keyHash: "hash-new" }, NOW);
        expect(await store.getAccountByKeyHash("hash-1")).toBeNull();
        expect((await store.getAccountByKeyHash("hash-new"))?.id).toBe("acc_1");
        // Re-saving the account's own hash is not a conflict.
        expect(await store.updateAccount("acc_1", { keyHash: "hash-new" }, NOW)).not.toBeNull();
      });

      it("rejects a key hash that belongs to another account", async () => {
        await store.createAccount(accountInput());
        await store.createAccount(accountInput({ id: "acc_2", alias: "r-other", keyHash: "hash-2" }));
        await expect(store.updateAccount("acc_2", { keyHash: "hash-1" }, NOW)).rejects.toMatchObject({ field: "keyHash" });
        expect((await store.getAccountById("acc_2"))?.keyHash).toBe("hash-2");
      });

      it("returns null when updating an unknown account", async () => {
        expect(await store.updateAccount("nope", { country: "CA" }, NOW)).toBeNull();
      });

      it("returns copies", async () => {
        const created = await store.createAccount(accountInput());
        created.programs.usps_informed_delivery = "done";
        created.country = "XX";
        const fetched = await store.getAccountById("acc_1");
        expect(fetched).toMatchObject({ country: "US", programs: {} });
      });
    });

    describe("deleteAccount", () => {
      it("removes the account and every row that belongs to it", async () => {
        await store.createAccount(accountInput());
        await store.createAccount(accountInput({ id: "acc_2", alias: "r-other", keyHash: "hash-2" }));
        for (const id of ["acc_1", "acc_2"]) {
          await store.applyUpdates(id, [shipmentUpdate()], idSequence(id));
          await store.recordEmail(id, logEntry());
          await store.addVerification(id, verification());
        }

        await store.deleteAccount("acc_1");

        expect(await store.getAccountById("acc_1")).toBeNull();
        expect(await store.getAccountByAlias("r-k3j9x2m4q8w1")).toBeNull();
        expect(await store.getAccountByKeyHash("hash-1")).toBeNull();
        expect(await store.listShipments("acc_1")).toEqual([]);
        expect(await store.listEmailLog("acc_1")).toEqual([]);
        expect(await store.getEmailStats("acc_1")).toEqual({ count: 0, lastAt: null, feeds: [] });
        expect(await store.listVerifications("acc_1", T1)).toEqual([]);

        // The other account is untouched.
        expect(await store.listShipments("acc_2")).toHaveLength(1);
        expect((await store.getEmailStats("acc_2")).count).toBe(1);
        expect(await store.listVerifications("acc_2", T1)).toHaveLength(1);

        // Re-using the id, alias and key hash starts from a clean slate.
        await store.createAccount(accountInput());
        expect(await store.listShipments("acc_1")).toEqual([]);
        expect(await store.listEmailLog("acc_1")).toEqual([]);
        expect(await store.listVerifications("acc_1", T1)).toEqual([]);
      });

      it("is a no-op for an unknown account", async () => {
        await expect(store.deleteAccount("nope")).resolves.toBeUndefined();
      });
    });

    describe("shipments", () => {
      beforeEach(async () => {
        await store.createAccount(accountInput());
      });

      it("creates shipments, merges repeats and returns the affected rows once", async () => {
        const newId = idSequence();
        const affected = await store.applyUpdates(
          "acc_1",
          [
            shipmentUpdate({ status: "pre_transit", eventAt: T1 }),
            shipmentUpdate({ carrier: "usps", trackingNumber: "9400111899223197428490", source: "usps_digest" }),
            shipmentUpdate({ status: "out_for_delivery", expectedDelivery: "2026-10-07", eventAt: T3 }),
            shipmentUpdate({ trackingNumber: null, orderRef: null }),
          ],
          newId,
        );
        expect(affected.map((s) => s.id)).toEqual(["shp_1", "shp_2"]);
        expect(affected[0]).toMatchObject({
          trackingNumber: "1Z999AA10123456784",
          status: "out_for_delivery",
          expectedDelivery: "2026-10-07",
          firstSeenAt: T1,
          lastEventAt: T3,
        });
        expect(await store.listShipments("acc_1")).toEqual(affected);
      });

      it("merges into existing rows across calls", async () => {
        await store.applyUpdates("acc_1", [shipmentUpdate({ status: "in_transit", eventAt: T2 })], idSequence("a"));
        const [merged] = await store.applyUpdates(
          "acc_1",
          [shipmentUpdate({ status: "delivered", eventAt: T3 })],
          idSequence("b"),
        );
        expect(merged).toMatchObject({ id: "a_1", status: "delivered", deliveredAt: T3 });
        expect(await store.listShipments("acc_1")).toHaveLength(1);
      });

      it("keeps delivered sticky and ignores out-of-order regressions", async () => {
        await store.applyUpdates("acc_1", [shipmentUpdate({ status: "delivered", eventAt: T3 })], idSequence());
        await store.applyUpdates("acc_1", [shipmentUpdate({ status: "out_for_delivery", eventAt: T2 })], idSequence());
        await store.applyUpdates("acc_1", [shipmentUpdate({ status: "in_transit", eventAt: "2026-10-08T09:00:00.000Z" })], idSequence());
        const [s] = await store.listShipments("acc_1");
        expect(s).toMatchObject({ status: "delivered", deliveredAt: T3, lastEventAt: "2026-10-08T09:00:00.000Z" });
      });

      it("re-keys an Amazon order row to the tracking number from the Shipped email", async () => {
        const order = shipmentUpdate({
          carrier: "amazon",
          trackingNumber: null,
          orderRef: "113-1234567-1234567",
          status: "pre_transit",
          eventAt: T1,
          source: "amazon",
        });
        const [created] = await store.applyUpdates("acc_1", [order], idSequence("a"));

        const shipped = shipmentUpdate({
          carrier: "ups",
          trackingNumber: "1Z999AA10123456784",
          orderRef: "113-1234567-1234567",
          status: "in_transit",
          eventAt: T2,
          source: "amazon",
        });
        const [rekeyed] = await store.applyUpdates("acc_1", [shipped], idSequence("b"));
        expect(rekeyed).toMatchObject({
          id: created.id,
          carrier: "ups",
          trackingNumber: "1Z999AA10123456784",
          orderRef: "113-1234567-1234567",
          status: "in_transit",
          firstSeenAt: T1,
        });

        // The carrier's own email now finds the same row by tracking number.
        const [fromUps] = await store.applyUpdates(
          "acc_1",
          [shipmentUpdate({ status: "out_for_delivery", eventAt: T3, orderRef: null })],
          idSequence("c"),
        );
        expect(fromUps).toMatchObject({ id: created.id, status: "out_for_delivery", source: "ups" });

        // So does a later order-only Amazon email.
        const [delivered] = await store.applyUpdates(
          "acc_1",
          [{ ...order, status: "delivered", eventAt: "2026-10-08T09:00:00.000Z" }],
          idSequence("d"),
        );
        expect(delivered).toMatchObject({ id: created.id, status: "delivered", carrier: "ups" });
        expect(await store.listShipments("acc_1")).toHaveLength(1);
      });

      it("finds the order row even when the Shipped email names another carrier", async () => {
        const order = shipmentUpdate({ carrier: "amazon", trackingNumber: null, orderRef: "113-7", source: "amazon", eventAt: T1 });
        const [created] = await store.applyUpdates("acc_1", [order], idSequence("a"));
        const shipped = shipmentUpdate({ carrier: "usps", trackingNumber: "9400111899223197428490", orderRef: "113-7", eventAt: T2 });
        const [merged] = await store.applyUpdates("acc_1", [shipped], idSequence("b"));
        expect(merged).toMatchObject({ id: created.id, carrier: "usps", trackingNumber: "9400111899223197428490" });
      });

      it("joins a FedEx email whose reference is the Amazon order number to the Amazon order row", async () => {
        const orderRef = "113-1234567-1234567";
        const [order] = await store.applyUpdates(
          "acc_1",
          [
            shipmentUpdate({
              carrier: "amazon",
              trackingNumber: null,
              orderRef,
              shipper: "Amazon.com",
              status: "pre_transit",
              expectedDelivery: "2026-10-09",
              eventAt: T1,
              source: "amazon",
            }),
          ],
          idSequence("a"),
        );

        const fedex = shipmentUpdate({
          carrier: "fedex",
          trackingNumber: "794612345678",
          orderRef,
          shipper: null,
          status: "in_transit",
          eventAt: T2,
          source: "fedex",
        });
        const [joined] = await store.applyUpdates("acc_1", [fedex], idSequence("b"));
        expect(joined).toMatchObject({
          id: order.id,
          carrier: "fedex",
          trackingNumber: "794612345678",
          orderRef,
          shipper: "Amazon.com",
          status: "in_transit",
          expectedDelivery: "2026-10-09",
          firstSeenAt: T1,
          lastEventAt: T2,
          source: "fedex",
        });

        // Re-keyed to the tracking number: FedEx's next email (no reference) lands on the same row...
        const [next] = await store.applyUpdates(
          "acc_1",
          [{ ...fedex, orderRef: null, status: "out_for_delivery", eventAt: T3 }],
          idSequence("c"),
        );
        expect(next).toMatchObject({ id: order.id, carrier: "fedex", status: "out_for_delivery" });
        // ...and so does Amazon's own order-only email, which no longer changes the carrier.
        const [fromAmazon] = await store.applyUpdates(
          "acc_1",
          [shipmentUpdate({ carrier: "amazon", trackingNumber: null, orderRef, status: "delivered", eventAt: NOW, source: "amazon" })],
          idSequence("d"),
        );
        expect(fromAmazon).toMatchObject({ id: order.id, carrier: "fedex", trackingNumber: "794612345678", status: "delivered" });
        expect(await store.listShipments("acc_1")).toHaveLength(1);
      });

      it("joins the Amazon order row when the carrier email comes first", async () => {
        const orderRef = "113-7654321-7654321";
        const [fromUps] = await store.applyUpdates(
          "acc_1",
          [shipmentUpdate({ orderRef, status: "in_transit", eventAt: T2 })],
          idSequence("a"),
        );
        const [fromAmazon] = await store.applyUpdates(
          "acc_1",
          [shipmentUpdate({ carrier: "amazon", trackingNumber: null, orderRef, status: "pre_transit", eventAt: T1, source: "amazon" })],
          idSequence("b"),
        );
        expect(fromAmazon).toMatchObject({ id: fromUps.id, carrier: "ups", status: "in_transit", firstSeenAt: T1 });
        expect(await store.listShipments("acc_1")).toHaveLength(1);
      });

      it("keys order rows by order ref alone, so another sender's order-only email finds the row", async () => {
        const orderRef = "113-5555555-5555555";
        const base = { trackingNumber: null, orderRef, status: "pre_transit" as const };
        // A split order: two packages already have rows of their own, so an order-only email
        // can't pick one and gets an order row.
        await store.applyUpdates(
          "acc_1",
          [
            shipmentUpdate({ carrier: "ups", trackingNumber: "1Z999AA10123456784", orderRef, eventAt: T1 }),
            shipmentUpdate({ carrier: "amazon", trackingNumber: "TBA111", orderRef, eventAt: T1, source: "amazon" }),
          ],
          idSequence("a"),
        );
        const [order] = await store.applyUpdates(
          "acc_1",
          [shipmentUpdate({ ...base, carrier: "amazon", eventAt: T1, source: "amazon" })],
          idSequence("b"),
        );
        expect(order.id).toBe("b_1");
        const [again] = await store.applyUpdates(
          "acc_1",
          [shipmentUpdate({ ...base, carrier: "unknown", status: "in_transit", eventAt: T2, source: "generic" })],
          idSequence("c"),
        );
        expect(again).toMatchObject({ id: "b_1", carrier: "amazon", status: "in_transit" });
        expect(await store.listShipments("acc_1")).toHaveLength(3);
      });

      it("keeps split shipments of one order apart", async () => {
        const base = { carrier: "amazon" as const, orderRef: "113-9", source: "amazon" as const };
        await store.applyUpdates("acc_1", [shipmentUpdate({ ...base, trackingNumber: null, eventAt: T1 })], idSequence("a"));
        await store.applyUpdates("acc_1", [shipmentUpdate({ ...base, trackingNumber: "TBA111", eventAt: T2 })], idSequence("b"));
        // The order row became TBA111; a second package of the same order gets its own row.
        await store.applyUpdates("acc_1", [shipmentUpdate({ ...base, trackingNumber: "TBA222", eventAt: T2 })], idSequence("c"));
        // An order-only email can't tell which package it means: it gets an order row of its own.
        await store.applyUpdates(
          "acc_1",
          [shipmentUpdate({ ...base, trackingNumber: null, status: "delivered", eventAt: T3 })],
          idSequence("d"),
        );
        const rows = await store.listShipments("acc_1");
        expect(rows.map((s) => [s.id, s.trackingNumber, s.status]).sort()).toEqual([
          ["a_1", "TBA111", "in_transit"],
          ["c_1", "TBA222", "in_transit"],
          ["d_1", null, "delivered"],
        ]);
      });

      it("stores worldwide carriers and carrier alerts as they are", async () => {
        const updates = [
          shipmentUpdate({ carrier: "royal_mail", trackingNumber: "AB123456785GB", source: "carrier_alert" }),
          shipmentUpdate({ carrier: "intl_post", trackingNumber: "RR123456785CN", source: "carrier_alert" }),
          shipmentUpdate({ carrier: "fourpx", trackingNumber: "4PX3001234567890CN", source: "generic" }),
        ];
        await store.applyUpdates("acc_1", updates, idSequence());
        const rows = await store.listShipments("acc_1");
        expect(rows.map((s) => [s.carrier, s.source]).sort()).toEqual([
          ["fourpx", "generic"],
          ["intl_post", "carrier_alert"],
          ["royal_mail", "carrier_alert"],
        ]);
      });

      it("upgrades an amazon row to the carrier with the same tracking number", async () => {
        await store.applyUpdates(
          "acc_1",
          [shipmentUpdate({ carrier: "amazon", trackingNumber: "9400111899223197428490", source: "amazon" })],
          idSequence(),
        );
        const [s] = await store.applyUpdates(
          "acc_1",
          [shipmentUpdate({ carrier: "usps", trackingNumber: "9400111899223197428490", source: "usps_alert", eventAt: T3 })],
          idSequence(),
        );
        expect(s).toMatchObject({ carrier: "usps", source: "usps_alert" });
      });

      it("rolls the whole batch back when it fails", async () => {
        await store.applyUpdates("acc_1", [shipmentUpdate({ status: "pre_transit", eventAt: T1 })], idSequence("a"));
        let calls = 0;
        const failingId = () => {
          if (++calls > 1) throw new Error("id generator failed");
          return `x_${calls}`;
        };
        await expect(
          store.applyUpdates(
            "acc_1",
            [
              shipmentUpdate({ status: "in_transit", eventAt: T2 }),
              shipmentUpdate({ trackingNumber: "TBA1", carrier: "amazon" }),
              shipmentUpdate({ trackingNumber: "TBA2", carrier: "amazon" }),
            ],
            failingId,
          ),
        ).rejects.toThrow("id generator failed");
        const rows = await store.listShipments("acc_1");
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ id: "a_1", status: "pre_transit" });
      });

      it("ignores updates for an unknown account", async () => {
        expect(await store.applyUpdates("nope", [shipmentUpdate()], idSequence())).toEqual([]);
        expect(await store.listShipments("nope")).toEqual([]);
      });

      it("lists shipments newest activity first, per account", async () => {
        await store.createAccount(accountInput({ id: "acc_2", alias: "r-other", keyHash: "hash-2" }));
        await store.applyUpdates(
          "acc_1",
          [
            shipmentUpdate({ trackingNumber: "A", eventAt: T1 }),
            shipmentUpdate({ trackingNumber: "B", eventAt: T3 }),
            shipmentUpdate({ trackingNumber: "C", eventAt: T2 }),
          ],
          idSequence("a"),
        );
        await store.applyUpdates("acc_2", [shipmentUpdate({ trackingNumber: "D" })], idSequence("b"));
        expect((await store.listShipments("acc_1")).map((s) => s.trackingNumber)).toEqual(["B", "C", "A"]);
        expect((await store.listShipments("acc_2")).map((s) => s.trackingNumber)).toEqual(["D"]);
      });

      it("sets user flags, which later emails preserve", async () => {
        const [s] = await store.applyUpdates("acc_1", [shipmentUpdate()], idSequence());
        expect(await store.setShipmentFlags("acc_1", s.id, { hidden: true })).toMatchObject({
          hidden: true,
          userMarkedDelivered: false,
        });
        expect(await store.setShipmentFlags("acc_1", s.id, { userMarkedDelivered: true })).toMatchObject({
          hidden: true,
          userMarkedDelivered: true,
        });
        await store.applyUpdates("acc_1", [shipmentUpdate({ status: "out_for_delivery", eventAt: T3 })], idSequence());
        const [after] = await store.listShipments("acc_1");
        expect(after).toMatchObject({ status: "out_for_delivery", hidden: true, userMarkedDelivered: true });
        expect(await store.setShipmentFlags("acc_1", s.id, { hidden: false })).toMatchObject({
          hidden: false,
          userMarkedDelivered: true,
        });
        expect(await store.setShipmentFlags("acc_1", s.id, {})).toMatchObject({ hidden: false, userMarkedDelivered: true });
      });

      it("refuses to flag a shipment of another account or an unknown one", async () => {
        await store.createAccount(accountInput({ id: "acc_2", alias: "r-other", keyHash: "hash-2" }));
        const [s] = await store.applyUpdates("acc_1", [shipmentUpdate()], idSequence());
        expect(await store.setShipmentFlags("acc_2", s.id, { hidden: true })).toBeNull();
        expect(await store.setShipmentFlags("acc_1", "nope", { hidden: true })).toBeNull();
        expect((await store.listShipments("acc_1"))[0].hidden).toBe(false);
      });

      it("deletes a shipment permanently", async () => {
        const [a, b] = await store.applyUpdates(
          "acc_1",
          [shipmentUpdate({ trackingNumber: "A" }), shipmentUpdate({ trackingNumber: "B" })],
          idSequence("a"),
        );
        expect(await store.deleteShipment("acc_1", a.id)).toBe(true);
        expect((await store.listShipments("acc_1")).map((s) => s.id)).toEqual([b.id]);
        expect(await store.deleteShipment("acc_1", a.id)).toBe(false);
        expect(await store.setShipmentFlags("acc_1", a.id, { hidden: true })).toBeNull();

        // A later email about the same package starts a fresh row.
        const [fresh] = await store.applyUpdates("acc_1", [shipmentUpdate({ trackingNumber: "A", eventAt: T3 })], idSequence("b"));
        expect(fresh).toMatchObject({ id: "b_1", firstSeenAt: T3, hidden: false });
      });

      it("refuses to delete a shipment of another account or an unknown one", async () => {
        await store.createAccount(accountInput({ id: "acc_2", alias: "r-other", keyHash: "hash-2" }));
        const [s] = await store.applyUpdates("acc_1", [shipmentUpdate()], idSequence());
        expect(await store.deleteShipment("acc_2", s.id)).toBe(false);
        expect(await store.deleteShipment("acc_1", "nope")).toBe(false);
        expect(await store.deleteShipment("nope", s.id)).toBe(false);
        expect(await store.listShipments("acc_1")).toHaveLength(1);
      });

      it("returns copies", async () => {
        const [s] = await store.applyUpdates("acc_1", [shipmentUpdate()], idSequence());
        s.status = "delivered";
        s.hidden = true;
        const [listed] = await store.listShipments("acc_1");
        expect(listed).toMatchObject({ status: "in_transit", hidden: false });
        listed.status = "exception";
        expect((await store.listShipments("acc_1"))[0].status).toBe("in_transit");
      });
    });

    describe("email log and stats", () => {
      beforeEach(async () => {
        await store.createAccount(accountInput());
      });

      it("starts empty", async () => {
        expect(await store.getEmailStats("acc_1")).toEqual({ count: 0, lastAt: null, feeds: [] });
        expect(await store.listEmailLog("acc_1")).toEqual([]);
      });

      it("counts emails and tracks the newest one, even out of order", async () => {
        await store.recordEmail("acc_1", logEntry({ receivedAt: T2 }));
        await store.recordEmail("acc_1", logEntry({ receivedAt: T3, kind: "ignored", senderDomain: null, updates: 0 }));
        await store.recordEmail("acc_1", logEntry({ receivedAt: T1, kind: "forwarding_verification" }));
        const stats = await store.getEmailStats("acc_1");
        expect(stats.count).toBe(3);
        expect(stats.lastAt).toBe(T3);
      });

      it("bumps a feed only for carrier kinds, and only forward", async () => {
        await store.recordEmail("acc_1", logEntry({ kind: "usps_digest", receivedAt: T2 }));
        await store.recordEmail("acc_1", logEntry({ kind: "usps_digest", receivedAt: T1 }));
        await store.recordEmail("acc_1", logEntry({ kind: "ups", receivedAt: T1 }));
        await store.recordEmail("acc_1", logEntry({ kind: "ups", receivedAt: T3 }));
        await store.recordEmail("acc_1", logEntry({ kind: "ignored", receivedAt: T3 }));
        await store.recordEmail("acc_1", logEntry({ kind: "forwarding_verification", receivedAt: T3 }));
        expect((await store.getEmailStats("acc_1")).feeds).toEqual([
          { source: "ups", lastSeenAt: T3 },
          { source: "usps_digest", lastSeenAt: T2 },
        ]);
      });

      it("keeps the log entries, newest first", async () => {
        const first = logEntry({ receivedAt: T1, kind: "ups", note: "first" });
        const second = logEntry({ receivedAt: T3, kind: "ignored", senderDomain: null, updates: 0, note: "no tracking numbers found" });
        const third = logEntry({ receivedAt: T2, kind: "fedex", senderDomain: "fedex.com", updates: 2 });
        for (const e of [first, second, third]) await store.recordEmail("acc_1", e);
        expect(await store.listEmailLog("acc_1")).toEqual([second, third, first]);
        expect(await store.listEmailLog("acc_1", 1)).toEqual([second]);
      });

      it(`keeps only the newest ${EMAIL_LOG_LIMIT} log rows, but counts every email`, async () => {
        const base = Date.parse("2026-09-01T00:00:00.000Z");
        const total = EMAIL_LOG_LIMIT + 5;
        for (let i = 0; i < total; i++) {
          await store.recordEmail("acc_1", logEntry({ receivedAt: new Date(base + i * 60_000).toISOString(), note: `#${i}` }));
        }
        const log = await store.listEmailLog("acc_1", 1000);
        expect(log).toHaveLength(EMAIL_LOG_LIMIT);
        expect(log[0].note).toBe(`#${total - 1}`);
        expect(log[log.length - 1].note).toBe("#5");
        expect((await store.getEmailStats("acc_1")).count).toBe(total);
      });

      it("ignores emails for an unknown account", async () => {
        await store.recordEmail("nope", logEntry());
        expect(await store.getEmailStats("nope")).toEqual({ count: 0, lastAt: null, feeds: [] });
        expect(await store.listEmailLog("nope")).toEqual([]);
      });
    });

    describe("forwarding verifications", () => {
      beforeEach(async () => {
        await store.createAccount(accountInput());
      });

      it("lists verifications since a time, newest first", async () => {
        const old = verification({ receivedAt: T1, code: "111" });
        const mid = verification({ receivedAt: T2, code: "222", provider: "outlook", requestedBy: null });
        const recent = verification({ receivedAt: T3, code: null, link: "https://mail.google.com/mail/vf-abc" });
        for (const v of [mid, recent, old]) await store.addVerification("acc_1", v);
        expect(await store.listVerifications("acc_1", T2)).toEqual([recent, mid]);
        expect(await store.listVerifications("acc_1", "2026-10-01T00:00:00Z")).toEqual([recent, mid, old]);
        expect(await store.listVerifications("acc_1", NOW)).toEqual([]);
      });

      it("compares the since time as an instant", async () => {
        await store.addVerification("acc_1", verification({ receivedAt: "2026-10-06T10:00:00Z" }));
        expect(await store.listVerifications("acc_1", "2026-10-06T10:00:00.000Z")).toHaveLength(1);
        expect(await store.listVerifications("acc_1", "2026-10-06T11:00:00+02:00")).toHaveLength(1);
        expect(await store.listVerifications("acc_1", "2026-10-06T10:00:00.001Z")).toHaveLength(0);
      });

      it(`keeps the newest ${VERIFICATION_LIMIT}`, async () => {
        const base = Date.parse(T1);
        for (let i = 0; i < VERIFICATION_LIMIT + 3; i++) {
          await store.addVerification("acc_1", verification({ receivedAt: new Date(base + i * 1000).toISOString(), code: `${i}` }));
        }
        const list = await store.listVerifications("acc_1", "2000-01-01T00:00:00Z");
        expect(list).toHaveLength(VERIFICATION_LIMIT);
        expect(list[0].code).toBe(`${VERIFICATION_LIMIT + 2}`);
        expect(list[list.length - 1].code).toBe("3");
      });

      it("rejects an invalid since time", async () => {
        await expect(store.listVerifications("acc_1", "yesterday")).rejects.toBeInstanceOf(RangeError);
      });

      it("ignores verifications for an unknown account", async () => {
        await store.addVerification("nope", verification());
        expect(await store.listVerifications("nope", T1)).toEqual([]);
      });
    });

    describe("exportAccount", () => {
      it("returns everything stored for the account, as copies", async () => {
        const created = await store.createAccount(accountInput());
        await store.createAccount(accountInput({ id: "acc_2", alias: "r-other", keyHash: "hash-2" }));
        await store.updateAccount("acc_1", { programs: { usps_informed_delivery: "done" } }, NOW);
        await store.applyUpdates(
          "acc_1",
          [shipmentUpdate({ trackingNumber: "A", eventAt: T1 }), shipmentUpdate({ trackingNumber: "B", eventAt: T3 })],
          idSequence("a"),
        );
        await store.applyUpdates("acc_2", [shipmentUpdate({ trackingNumber: "C" })], idSequence("b"));
        const older = logEntry({ receivedAt: T1, note: "older" });
        const newer = logEntry({ receivedAt: T3, kind: "ignored", senderDomain: null, updates: 0 });
        for (const e of [older, newer]) await store.recordEmail("acc_1", e);
        await store.recordEmail("acc_2", logEntry());
        const v1 = verification({ receivedAt: T1, code: "111" });
        const v2 = verification({ receivedAt: T3, code: "333" });
        for (const v of [v2, v1]) await store.addVerification("acc_1", v);

        const exported = await store.exportAccount("acc_1");
        expect(exported).toEqual({
          account: { ...created, programs: { usps_informed_delivery: "done" } },
          shipments: await store.listShipments("acc_1"),
          emailLog: [newer, older],
          verifications: [v2, v1],
        });
        expect(exported?.shipments.map((s) => s.trackingNumber)).toEqual(["B", "A"]);

        exported!.account.programs.ups_my_choice = "done";
        exported!.shipments[0].hidden = true;
        exported!.emailLog[0].note = "changed";
        exported!.verifications[0].code = "changed";
        const again = await store.exportAccount("acc_1");
        expect(again?.account.programs).toEqual({ usps_informed_delivery: "done" });
        expect(again?.shipments[0].hidden).toBe(false);
        expect(again?.emailLog[0].note).toBeNull();
        expect(again?.verifications[0].code).toBe("333");
      });

      it("exports an empty account", async () => {
        const created = await store.createAccount(accountInput());
        expect(await store.exportAccount("acc_1")).toEqual({ account: created, shipments: [], emailLog: [], verifications: [] });
      });

      it("returns null for an unknown or deleted account", async () => {
        expect(await store.exportAccount("nope")).toBeNull();
        await store.createAccount(accountInput());
        await store.deleteAccount("acc_1");
        expect(await store.exportAccount("acc_1")).toBeNull();
      });
    });

    describe("purgeExpired", () => {
      const PURGE_NOW = "2026-12-31T12:00:00.000Z";
      const nowMs = Date.parse(PURGE_NOW);
      const DAY = 24 * 60 * 60 * 1000;
      const ago = (ms: number) => new Date(nowMs - ms).toISOString();

      beforeEach(async () => {
        await store.createAccount(accountInput());
        await store.createAccount(accountInput({ id: "acc_2", alias: "r-other", keyHash: "hash-2" }));
      });

      const trackingNumbers = async (accountId: string) =>
        (await store.listShipments(accountId)).map((s) => s.trackingNumber).sort();

      it("uses the retention windows from the architecture doc", () => {
        expect(DELIVERED_RETENTION_MS).toBe(30 * DAY);
        expect(STALE_SHIPMENT_RETENTION_MS).toBe(60 * DAY);
        expect(EMAIL_LOG_RETENTION_MS).toBe(90 * DAY);
        expect(VERIFICATION_RETENTION_MS).toBe(48 * 60 * 60 * 1000);
      });

      it("deletes delivered shipments 30 days after delivery and any shipment after 60 quiet days, in every account", async () => {
        const at = (days: number) => ago(days * DAY);
        await store.applyUpdates(
          "acc_1",
          [
            shipmentUpdate({ trackingNumber: "QUIET_59", status: "in_transit", eventAt: at(59) }),
            shipmentUpdate({ trackingNumber: "QUIET_61", status: "in_transit", eventAt: at(61) }),
            shipmentUpdate({ trackingNumber: "HIDDEN_45", status: "exception", eventAt: at(45) }),
            shipmentUpdate({ trackingNumber: "DELIVERED_29", status: "delivered", eventAt: at(29) }),
            shipmentUpdate({ trackingNumber: "DELIVERED_30", status: "delivered", eventAt: at(30) }),
            shipmentUpdate({ trackingNumber: "DELIVERED_31", status: "delivered", eventAt: at(31) }),
            // Delivered 31 days ago; a later email (29 days ago) repeated it. Delivery time counts.
            shipmentUpdate({ trackingNumber: "REPEATED", status: "delivered", deliveredAt: at(31), eventAt: at(31) }),
            shipmentUpdate({ trackingNumber: "REPEATED", status: "delivered", eventAt: at(29) }),
            // Same instant as 31 days ago, written with an offset: compared as an instant.
            shipmentUpdate({
              trackingNumber: "OFFSET",
              status: "delivered",
              eventAt: new Date(nowMs - 31 * DAY).toISOString().replace("Z", "+00:00"),
            }),
            shipmentUpdate({ trackingNumber: "MARKED_31", status: "in_transit", eventAt: at(31) }),
            shipmentUpdate({ trackingNumber: "MARKED_29", status: "in_transit", eventAt: at(29) }),
          ],
          idSequence("a"),
        );
        await store.applyUpdates(
          "acc_2",
          [
            shipmentUpdate({ trackingNumber: "OTHER_OLD", status: "delivered", eventAt: at(40) }),
            shipmentUpdate({ trackingNumber: "OTHER_NEW", status: "pre_transit", eventAt: at(1) }),
          ],
          idSequence("b"),
        );
        const byTn = new Map((await store.listShipments("acc_1")).map((s) => [s.trackingNumber, s.id]));
        await store.setShipmentFlags("acc_1", byTn.get("MARKED_31")!, { userMarkedDelivered: true });
        await store.setShipmentFlags("acc_1", byTn.get("MARKED_29")!, { userMarkedDelivered: true });
        await store.setShipmentFlags("acc_1", byTn.get("HIDDEN_45")!, { hidden: true });

        const result = await store.purgeExpired(PURGE_NOW);
        expect(result).toEqual({ shipments: 6, emailLog: 0, verifications: 0 });
        expect(await trackingNumbers("acc_1")).toEqual(["DELIVERED_29", "DELIVERED_30", "HIDDEN_45", "MARKED_29", "QUIET_59"]);
        expect(await trackingNumbers("acc_2")).toEqual(["OTHER_NEW"]);

        // Nothing left to purge.
        expect(await store.purgeExpired(PURGE_NOW)).toEqual({ shipments: 0, emailLog: 0, verifications: 0 });
      });

      it("deletes email log rows older than 90 days but keeps the email count and feeds", async () => {
        await store.recordEmail("acc_1", logEntry({ receivedAt: ago(91 * DAY), kind: "usps_digest", note: "91" }));
        await store.recordEmail("acc_1", logEntry({ receivedAt: ago(90 * DAY), note: "90" }));
        await store.recordEmail("acc_1", logEntry({ receivedAt: ago(89 * DAY), note: "89" }));
        await store.recordEmail("acc_2", logEntry({ receivedAt: ago(100 * DAY), note: "100" }));
        const statsBefore = await store.getEmailStats("acc_1");

        expect(await store.purgeExpired(PURGE_NOW)).toEqual({ shipments: 0, emailLog: 2, verifications: 0 });
        expect((await store.listEmailLog("acc_1")).map((e) => e.note)).toEqual(["89", "90"]);
        expect(await store.listEmailLog("acc_2")).toEqual([]);
        expect(await store.getEmailStats("acc_1")).toEqual(statsBefore);
        expect((await store.getEmailStats("acc_2")).count).toBe(1);
      });

      it("deletes forwarding confirmations after 48 hours", async () => {
        const HOUR = 60 * 60 * 1000;
        await store.addVerification("acc_1", verification({ receivedAt: ago(49 * HOUR), code: "49" }));
        await store.addVerification("acc_1", verification({ receivedAt: ago(48 * HOUR), code: "48" }));
        await store.addVerification("acc_1", verification({ receivedAt: ago(1 * HOUR), code: "1" }));
        await store.addVerification("acc_2", verification({ receivedAt: ago(72 * HOUR), code: "72" }));

        expect(await store.purgeExpired(PURGE_NOW)).toEqual({ shipments: 0, emailLog: 0, verifications: 2 });
        const all = "2000-01-01T00:00:00.000Z";
        expect((await store.listVerifications("acc_1", all)).map((v) => v.code)).toEqual(["1", "48"]);
        expect(await store.listVerifications("acc_2", all)).toEqual([]);
      });

      it("rejects an invalid now", async () => {
        await expect(store.purgeExpired("soon")).rejects.toBeInstanceOf(RangeError);
      });
    });
  });
}
