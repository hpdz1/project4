import { describe, expect, it } from "vitest";
import {
  isCarrierId,
  isEmailKind,
  isProgramId,
  isSourceKind,
  patchPrograms,
  sanitizePrograms,
} from "./guards";

describe("isCarrierId", () => {
  it("accepts carriers from every region and the fallbacks", () => {
    for (const id of ["usps", "royal_mail", "dhl_paket", "japan_post", "fourpx", "correios", "israel_post", "intl_post", "unknown"]) {
      expect(isCarrierId(id)).toBe(true);
    }
  });

  it("rejects anything else, including inherited object keys", () => {
    for (const id of ["", "owl", "USPS", "toString", "__proto__", "constructor"]) expect(isCarrierId(id)).toBe(false);
  });
});

describe("isSourceKind / isEmailKind", () => {
  it("knows carrier alerts", () => {
    expect(isSourceKind("carrier_alert")).toBe(true);
    expect(isEmailKind("carrier_alert")).toBe(true);
  });

  it("keeps the non-source email kinds apart", () => {
    expect(isSourceKind("ignored")).toBe(false);
    expect(isEmailKind("ignored")).toBe(true);
    expect(isEmailKind("forwarding_verification")).toBe(true);
    expect(isEmailKind("pigeon")).toBe(false);
  });
});

describe("isProgramId", () => {
  it("accepts 2-64 lowercase letters, digits and underscores", () => {
    for (const id of ["usps_informed_delivery", "jp", "royal_mail_2", "a".repeat(64)]) expect(isProgramId(id)).toBe(true);
  });

  it("rejects other shapes", () => {
    for (const id of ["", "x", "a".repeat(65), "UPS_my_choice", "ups-my-choice", "ups my choice", "ups.choice", "__proto__"]) {
      expect(isProgramId(id)).toBe(false);
    }
  });
});

describe("sanitizePrograms", () => {
  it("keeps only program-id keys with a done/skipped value", () => {
    const parsed: unknown = JSON.parse(
      '{"ups_my_choice":"done","postnl_app":"skipped","usps_informed_delivery":"maybe","Bad":"done","__proto__":"done"}',
    );
    const programs = sanitizePrograms(parsed);
    expect(programs).toEqual({ ups_my_choice: "done", postnl_app: "skipped" });
    expect(Object.getPrototypeOf(programs)).toBe(Object.prototype);
  });

  it("returns an empty map for non-objects", () => {
    for (const value of [null, "done", 3, ["done"]]) expect(sanitizePrograms(value)).toEqual({});
  });
});

describe("patchPrograms", () => {
  it("sets, deletes and ignores entries without touching the input", () => {
    const current = { ups_my_choice: "done" as const, usps_informed_delivery: "skipped" as const };
    const next = patchPrograms(current, {
      ups_my_choice: null,
      royal_mail_app: "done",
      "Not An Id": "done",
      dpd_predict: "maybe" as unknown as "done",
    });
    expect(next).toEqual({ usps_informed_delivery: "skipped", royal_mail_app: "done" });
    expect(current).toEqual({ ups_my_choice: "done", usps_informed_delivery: "skipped" });
  });
});
