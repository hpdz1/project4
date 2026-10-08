import { describe, expect, it } from "vitest";
import { resolveAdMode } from "./ad-mode";

const CLIENT = "ca-pub-1234567890123456";

describe("resolveAdMode", () => {
  it("shows a real ad only when enabled with a client and a slot", () => {
    expect(
      resolveAdMode({ slot: "1234567890", client: CLIENT, enabled: true, placeholders: false }),
    ).toBe("ad");
  });

  it("renders nothing without a slot, a client or the production flag", () => {
    expect(
      resolveAdMode({ slot: undefined, client: CLIENT, enabled: true, placeholders: false }),
    ).toBe("none");
    expect(
      resolveAdMode({ slot: "  ", client: CLIENT, enabled: true, placeholders: false }),
    ).toBe("none");
    expect(
      resolveAdMode({ slot: "1234567890", client: null, enabled: true, placeholders: false }),
    ).toBe("none");
    expect(
      resolveAdMode({ slot: "1234567890", client: CLIENT, enabled: false, placeholders: false }),
    ).toBe("none");
  });

  it("shows placeholders in development even without a slot", () => {
    expect(
      resolveAdMode({ slot: undefined, client: null, enabled: false, placeholders: true }),
    ).toBe("placeholder");
  });
});
