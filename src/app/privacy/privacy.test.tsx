import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LOCAL_KEYS } from "@/lib/client/saved-location";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/server/session";
import { parseOperator, type OperatorInfo } from "@/lib/site";
import {
  DELIVERED_RETENTION_MS,
  EMAIL_LOG_LIMIT,
  EMAIL_LOG_RETENTION_MS,
  STALE_SHIPMENT_RETENTION_MS,
  VERIFICATION_RETENTION_MS,
} from "@/lib/store/limits";
import { PRIVACY_SECTIONS, PrivacyPolicy, RETENTION } from "./PrivacyPolicy";

const FULL_OPERATOR: OperatorInfo = parseOperator(
  {
    name: "Example Labs Ltd",
    address: "1 Sample Street, London EC1A 1AA, United Kingdom",
    country: "GB",
    euRepresentative: "Rep Co GmbH, Musterstraße 1, 10115 Berlin, Germany",
    ukRepresentative: "UK Rep Ltd, 2 Test Road, Leeds LS1 1AA",
    privacyEmail: "privacy@packageradar.example",
  },
  "hello@packageradar.example",
);

const BARE_OPERATOR: OperatorInfo = parseOperator({}, "hello@packageradar.example");

function render(operator: OperatorInfo, showPlaceholders = false): string {
  return renderToStaticMarkup(
    <PrivacyPolicy operator={operator} showPlaceholders={showPlaceholders} />,
  );
}

/** Visible text: tags removed, entities and whitespace normalized. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:)])/g, "$1")
    .trim();
}

/** The HTML from the heading with `id` up to the next <h2>. */
function section(html: string, id: string): string {
  const start = html.indexOf(`<h2 id="${id}">`);
  expect(start, `section #${id}`).toBeGreaterThanOrEqual(0);
  const next = html.indexOf("<h2", start + 1);
  return html.slice(start, next < 0 ? undefined : next);
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe("privacy policy: retention", () => {
  const html = render(FULL_OPERATOR);
  const retention = textOf(section(html, "retention"));

  it("publishes the schedule from ARCHITECTURE 'Retention'", () => {
    expect(retention).toContain("A delivered shipment 30 days after delivery");
    expect(retention).toContain("Any shipment with no news 60 days after its latest update");
    expect(retention).toContain("The email log 90 days (and at most the newest 200 entries)");
    expect(retention).toContain("Forwarding confirmations (codes and links) 48 hours");
    expect(retention).toMatch(/Your account[^.]*Until you delete it/);
  });

  it("derives the numbers from the limits the store purge enforces", () => {
    expect(RETENTION).toEqual({
      deliveredDays: DELIVERED_RETENTION_MS / DAY_MS,
      staleDays: STALE_SHIPMENT_RETENTION_MS / DAY_MS,
      emailLogDays: EMAIL_LOG_RETENTION_MS / DAY_MS,
      emailLogRows: EMAIL_LOG_LIMIT,
      verificationHours: VERIFICATION_RETENTION_MS / (60 * 60 * 1000),
    });
  });

  it("repeats the schedule in the short version", () => {
    const short = textOf(section(html, "short-version"));
    expect(short).toContain("delivered shipments 30 days after delivery");
    expect(short).toContain("shipments with no news after 60 days");
    expect(short).toContain("the email log after 90 days");
    expect(short).toContain("forwarding confirmations after 48 hours");
  });
});

describe("privacy policy: AdSense disclosures", () => {
  const html = render(FULL_OPERATOR);
  const ads = section(html, "advertising");
  const text = textOf(ads);

  it("carries the statements Google requires", () => {
    expect(text).toContain(
      "Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this website or other websites.",
    );
    expect(text).toContain(
      "Google's use of advertising cookies enables it and its partners to serve ads to you based on your visits to this site and/or other sites on the Internet.",
    );
    expect(text).toMatch(
      /third parties, including Google, may place and read cookies on your browser, or use web beacons or IP addresses/,
    );
  });

  it("links the opt-outs and Google's partner-sites page", () => {
    expect(ads).toContain('href="https://adssettings.google.com"');
    expect(ads).toContain('href="https://www.aboutads.info"');
    expect(ads).toContain('href="https://policies.google.com/technologies/partner-sites"');
  });

  it("covers consent in the EEA/UK/CH and the US state opt-out", () => {
    expect(text).toContain("European Economic Area, the United Kingdom or Switzerland");
    expect(text).toContain("Do Not Sell or Share My Personal Information");
  });

  it("lists the session cookie, browser storage keys and Google cookies", () => {
    const cookies = section(html, "cookies");
    expect(cookies).toContain(SESSION_COOKIE);
    expect(textOf(cookies)).toContain(
      `Up to ${SESSION_MAX_AGE_SECONDS / 86_400} days, or until you sign out`,
    );
    for (const key of LOCAL_KEYS) expect(cookies).toContain(key);
    expect(textOf(cookies)).toContain("Google advertising cookies");
  });

  it("states how it responds to GPC and Do Not Track", () => {
    const gpc = textOf(section(html, "gpc-dnt"));
    expect(gpc).toContain("Global Privacy Control");
    expect(gpc).toContain("Do Not Track");
  });
});

describe("privacy policy: rights", () => {
  const html = render(FULL_OPERATOR);
  const rights = textOf(section(html, "your-rights"));

  it("points to the self-service tools", () => {
    expect(rights).toContain("Download my data");
    expect(rights).toContain("Delete my data");
    expect(rights).toContain("privacy@packageradar.example");
  });

  it("covers the GDPR rights and the right to complain", () => {
    for (const right of [
      "access",
      "data portability",
      "rectification",
      "erasure",
      "restriction of processing",
      "to object",
      "withdraw consent",
      "supervisory authority",
    ]) {
      expect(rights).toContain(right);
    }
  });

  it("has a subsection per region", () => {
    for (const region of ["LGPD", "PIPEDA", "Law 25", "Privacy Act 1988", "APPI", "PIPA", "Digital Personal Data Protection Act", "California"]) {
      expect(rights).toContain(region);
    }
  });

  it("names legal bases", () => {
    const bases = textOf(section(html, "legal-bases"));
    for (const basis of ["Contract", "Legitimate interests", "Consent", "Legal obligation"]) {
      expect(bases).toContain(basis);
    }
  });

  it("sets the minimum age at 16", () => {
    expect(textOf(section(html, "children"))).toContain("at least 16 years old");
  });
});

describe("privacy policy: what is never stored", () => {
  const html = render(FULL_OPERATOR);
  const text = textOf(html);

  it("never claims to store item descriptions", () => {
    const sentences = text.split(/(?<=[.!?:;])\s+/);
    const mentions = sentences.filter((s) => /\bdescriptions?\b/i.test(s));
    expect(mentions.length).toBeGreaterThan(0);
    for (const sentence of mentions) {
      expect(sentence, sentence).toMatch(/\b(never|not|no|don't|doesn't)\b/i);
    }
    const collected = textOf(section(html, "what-we-collect"));
    expect(collected).not.toMatch(/\bdescriptions?\b|item names?/i);
    expect(text).toContain("our software never saves item names or descriptions");
  });

  it("discloses what arrives in forwarded email but isn't kept", () => {
    const notKept = textOf(section(html, "not-kept"));
    expect(notKept).toContain("Your email address.");
    expect(notKept).toContain("Names and addresses.");
    expect(notKept).toContain("Images of your mail.");
    expect(notKept).toContain("We don't store email bodies, attachments or images.");
  });

  it("names the processors and hedges transfer safeguards", () => {
    const sharing = textOf(section(html, "sharing"));
    expect(sharing).toContain("hosting provider");
    expect(sharing).toMatch(/Postmark|Cloudflare/);
    expect(sharing).toContain("Google");
    const transfers = textOf(section(html, "transfers"));
    expect(transfers).toContain("Standard Contractual Clauses");
    expect(transfers).toContain("where the provider participates, the EU-U.S. Data Privacy Framework");
  });

  it("has a table of contents that matches the sections", () => {
    for (const s of PRIVACY_SECTIONS) {
      expect(html).toContain(`href="#${s.id}"`);
      expect(html).toContain(`<h2 id="${s.id}">`);
    }
  });
});

describe("privacy policy: operator identity", () => {
  it("shows every configured detail without placeholders", () => {
    const html = render(FULL_OPERATOR, true);
    const who = textOf(section(html, "who-we-are"));
    expect(who).toContain("Example Labs Ltd");
    expect(who).toContain("1 Sample Street, London EC1A 1AA, United Kingdom");
    expect(who).toContain("Established in United Kingdom");
    expect(who).toContain("Representative in the EU Rep Co GmbH");
    expect(who).toContain("Representative in the UK UK Rep Ltd");
    expect(html).not.toContain("data-dev-placeholder");
    expect(html).toContain('<span translate="no">Example Labs Ltd</span>');
  });

  it("marks missing details as placeholders in development", () => {
    const html = render(BARE_OPERATOR, true);
    const who = section(html, "who-we-are");
    expect(who).toContain("data-dev-placeholder");
    expect(who).toContain("NEXT_PUBLIC_OPERATOR_ADDRESS");
    expect(who).toContain("NEXT_PUBLIC_OPERATOR_NAME");
    expect(who).toContain("NEXT_PUBLIC_OPERATOR_COUNTRY");
    expect(textOf(who)).toContain("Privacy contact hello@packageradar.example");
  });

  it("renders only what is set in production", () => {
    const html = render(BARE_OPERATOR, false);
    expect(html).not.toContain("data-dev-placeholder");
    expect(html).not.toContain("NEXT_PUBLIC_");
    const who = textOf(section(html, "who-we-are"));
    expect(who).toContain("Operator (controller) The operator of Package Radar");
    expect(who).not.toContain("Postal address");
    expect(who).not.toContain("Representative in");
  });

  it("keeps the brand, forwarding address and emails out of translation", () => {
    const html = render(FULL_OPERATOR);
    expect(html).toContain('<span translate="no">Package Radar</span>');
    expect(html).toContain('<code translate="no">r-k3j9x2m4q8w1@…</code>');
    expect(html).toMatch(/<a href="mailto:privacy@packageradar\.example" translate="no">/);
  });

  it("shows the effective date unambiguously", () => {
    const html = render(FULL_OPERATOR);
    expect(html).toContain('<time dateTime="2026-10-10">October 10, 2026</time>');
  });
});
