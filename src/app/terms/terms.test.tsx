import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseOperator, type OperatorInfo } from "@/lib/site";
import { TermsOfUse } from "./TermsOfUse";

const CONTACT = "hello@packageradar.example";

function render(operator: OperatorInfo, showPlaceholders = false): string {
  return renderToStaticMarkup(
    <TermsOfUse operator={operator} showPlaceholders={showPlaceholders} contactEmail={CONTACT} />,
  );
}

function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:)])/g, "$1")
    .trim();
}

const CONFIGURED = parseOperator({ name: "Example Labs Ltd", country: "DE" }, CONTACT);
const BARE = parseOperator({}, CONTACT);

describe("terms of use", () => {
  it("takes the governing law from NEXT_PUBLIC_OPERATOR_COUNTRY", () => {
    const text = textOf(render(CONFIGURED));
    expect(text).toContain("These terms are governed by the laws of Germany.");
    expect(text).toContain("Package Radar is provided by Example Labs Ltd");
  });

  it("marks a missing country as a placeholder in development only", () => {
    const dev = render(BARE, true);
    expect(dev).toContain("data-dev-placeholder");
    expect(dev).toContain("NEXT_PUBLIC_OPERATOR_COUNTRY");
    expect(dev).toContain("NEXT_PUBLIC_OPERATOR_NAME");

    const prod = render(BARE, false);
    expect(prod).not.toContain("data-dev-placeholder");
    expect(prod).not.toContain("NEXT_PUBLIC_");
    const text = textOf(prod);
    expect(text).toContain("governed by the laws of the country where we are established");
    expect(text).toContain("Package Radar is provided by its operator");
  });

  it("keeps consumer rights and worldwide availability caveats", () => {
    const text = textOf(render(CONFIGURED));
    expect(text).toContain(
      "nothing in these terms affects the rights you have under the mandatory consumer protection laws of the country where you live",
    );
    expect(text).toContain("Availability varies by country and carrier");
    expect(text).toContain("at least 16 years old");
  });

  it("only allows forwarding mail the user owns and may process", () => {
    const text = textOf(render(CONFIGURED));
    expect(text).toContain(
      "You may only forward email from email accounts that you own or are authorized to manage, and only email that you are allowed to process and share with us.",
    );
  });

  it("makes no US-only assumptions", () => {
    const text = textOf(render(CONFIGURED));
    expect(text).not.toMatch(/\b(USPS|ZIP)\b/);
    expect(text).toContain("not affiliated with, endorsed by or sponsored by any postal service, carrier or retailer");
    expect(text).toContain("cannot look up packages by address");
  });
});
