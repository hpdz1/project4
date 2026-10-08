import { describe, expect, it } from "vitest";
import { buttonClasses, isInternalHref } from "./button-styles";
import { cx } from "./cx";

describe("isInternalHref", () => {
  it("treats site paths and anchors as internal", () => {
    expect(isInternalHref("/setup")).toBe(true);
    expect(isInternalHref("/#how-it-works")).toBe(true);
    expect(isInternalHref("#faq")).toBe(true);
  });

  it("treats absolute, protocol-relative and mailto links as external", () => {
    expect(isInternalHref("https://www.usps.com")).toBe(false);
    expect(isInternalHref("//evil.example")).toBe(false);
    expect(isInternalHref("mailto:hello@example.com")).toBe(false);
  });
});

describe("buttonClasses", () => {
  it("defaults to a primary medium button and appends custom classes", () => {
    const classes = buttonClasses({ className: "w-full" });
    expect(classes).toContain("bg-accent");
    expect(classes).toContain("min-h-11");
    expect(classes.endsWith("w-full")).toBe(true);
  });

  it("applies variants and sizes", () => {
    expect(buttonClasses({ variant: "danger", size: "sm" })).toContain("bg-danger");
    expect(buttonClasses({ variant: "secondary" })).toContain("border-border-strong");
    expect(buttonClasses({ size: "lg" })).toContain("min-h-12");
  });
});

describe("cx", () => {
  it("drops falsy parts", () => {
    expect(cx("a", false, null, undefined, "", "b")).toBe("a b");
  });
});
