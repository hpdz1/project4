import { describe, expect, it } from "vitest";
import { parseLocation } from "@/lib/location";
import { getCoverage } from "@/lib/programs";
import {
  SETUP_STEPS,
  checkAddress,
  checklistPrograms,
  checklistProgress,
  forwardingProgramIds,
  initialStep,
  locationSummary,
  stepFromHash,
  stepIndex,
  withProgramState,
} from "./setup";

describe("steps", () => {
  it("has four steps in order", () => {
    expect(SETUP_STEPS.map((s) => s.id)).toEqual(["address", "carriers", "forward", "done"]);
    expect(stepIndex("forward")).toBe(2);
  });

  it("reads a step from the fragment", () => {
    expect(stepFromHash("#forward")).toBe("forward");
    expect(stepFromHash("#FORWARD")).toBe("forward");
    expect(stepFromHash("carriers")).toBe("carriers");
    expect(stepFromHash("#key=abc")).toBeNull();
    expect(stepFromHash("")).toBeNull();
  });

  it("starts at the address step without an account", () => {
    expect(initialStep(false, "#forward")).toBe("address");
    expect(initialStep(true, "#forward")).toBe("forward");
    expect(initialStep(true, "#address")).toBe("address");
    expect(initialStep(true, "")).toBe("carriers");
  });
});

describe("checklist", () => {
  const us = getCoverage("US", "IL");

  it("lists address programs, then account programs", () => {
    expect(checklistPrograms(us).map((p) => p.id)).toEqual([
      "usps_informed_delivery",
      "ups_my_choice",
      "fedex_delivery_manager",
      "amazon_orders",
    ]);
  });

  it("counts progress", () => {
    const programs = checklistPrograms(us);
    expect(
      checklistProgress(programs, { usps_informed_delivery: "done", ups_my_choice: "skipped", dhl_on_demand: "done" }),
    ).toEqual({ done: 1, skipped: 1, todo: 2, total: 4 });
  });

  it("forwards every program not skipped, plus per-package programs that email", () => {
    expect(forwardingProgramIds(us, { ups_my_choice: "skipped" })).toEqual([
      "usps_informed_delivery",
      "fedex_delivery_manager",
      "amazon_orders",
      "dhl_on_demand",
    ]);
    // OnTrac only texts, so it never appears.
    expect(forwardingProgramIds(us, {})).not.toContain("ontrac_notifyme");
  });
});

describe("checkAddress", () => {
  it("accepts a US address with a ZIP", () => {
    expect(checkAddress(parseLocation("1060 W Addison St, Chicago, IL 60613", "US"))).toEqual({
      ok: true,
      country: "US",
      postalCode: "60613",
      region: "IL",
    });
  });

  it("asks for a ZIP when there isn't one", () => {
    const result = checkAddress(parseLocation("1060 W Addison St, Chicago", "US"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/ZIP/);
  });

  it("needs nothing for Other", () => {
    expect(checkAddress(parseLocation("", "ZZ"))).toMatchObject({ ok: true, country: "ZZ" });
  });
});

describe("locationSummary", () => {
  it("says what the server stores", () => {
    expect(locationSummary({ country: "US", postalCode: "60613", region: "IL" }, "United States")).toBe(
      "ZIP 60613 · IL · United States",
    );
    expect(locationSummary({ country: "GB", postalCode: "SW1A 1AA", region: null }, "United Kingdom")).toBe(
      "SW1A 1AA · United Kingdom",
    );
    expect(locationSummary({ country: "ZZ", postalCode: null, region: null }, null)).toBe("ZZ");
  });
});

describe("withProgramState", () => {
  it("sets and clears one program without touching the input", () => {
    const states = { usps_informed_delivery: "done" as const };
    expect(withProgramState(states, "ups_my_choice", "skipped")).toEqual({
      usps_informed_delivery: "done",
      ups_my_choice: "skipped",
    });
    expect(withProgramState(states, "usps_informed_delivery", null)).toEqual({});
    expect(states).toEqual({ usps_informed_delivery: "done" });
  });
});
