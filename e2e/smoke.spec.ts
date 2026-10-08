import { expect, test, type Page } from "@playwright/test";
import { E2E_INBOUND_DOMAIN, E2E_INBOUND_SECRET, E2E_TIMEZONE } from "./env";

/**
 * End-to-end smoke tests against a production build (`next start`) with
 * DEMO_MODE=1, an inbound secret and a fresh SQLite file (see playwright.config.ts).
 * Each test that needs a radar creates its own account, so tests are independent.
 */

const ADDRESS = "123 Main St, Springfield, IL 62701";
const SIGN_IN_LINK_RE = /\/signin#key=[A-Za-z0-9_-]{43}$/;

/** Walks the first setup step in the browser; resolves with the one-time sign-in link. */
async function createRadar(page: Page): Promise<string> {
  await page.goto("/setup");
  await expect(page.getByRole("heading", { name: "Your address" })).toBeVisible();
  await page.getByLabel("Your delivery address or ZIP code").fill(ADDRESS);
  await page.getByRole("button", { name: "Create my radar" }).click();
  await expect(page.getByText("Save your personal sign-in link")).toBeVisible();
  const link = page.getByRole("textbox", { name: "Your sign-in link" });
  await expect(link).toHaveValue(SIGN_IN_LINK_RE);
  return link.inputValue();
}

/** The signed-in account's forwarding address (r-…@inbound.test). */
async function inboundAddress(page: Page): Promise<string> {
  const res = await page.request.get("/api/account");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { account: { inboundAddress: string } };
  return body.account.inboundAddress;
}

/** e.g. "Friday 10/09/2026": the local date `days` from now in `timeZone`, as UPS prints it. */
function upsDate(days: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const date = new Date(Date.UTC(part("year"), part("month") - 1, part("day") + days));
  const weekday = date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${weekday} ${mm}/${dd}/${date.getUTCFullYear()}`;
}

// Any uncaught exception in the page (including React hydration errors) fails the test.
const pageErrors = new WeakMap<Page, Error[]>();
test.beforeEach(({ page }) => {
  const errors: Error[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error));
});
test.afterEach(({ page }) => {
  expect(pageErrors.get(page)?.map((e) => e.message) ?? []).toEqual([]);
});

test("landing: the address check shows USPS Informed Delivery for an Illinois address", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("#how-it-works")).toBeAttached();

  await page.getByLabel("Your delivery address or ZIP code").fill(ADDRESS);
  await page.getByRole("button", { name: "Check my coverage" }).click();

  await expect(page.getByRole("heading", { name: /Carrier coverage for ZIP 62701 · IL/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "USPS Informed Delivery", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "UPS My Choice", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Set up my radar — free, about 10 minutes" })).toHaveAttribute(
    "href",
    "/setup",
  );
});

test("setup: creates a radar, shows the sign-in link once, and the link signs in elsewhere", async ({
  page,
  browser,
}) => {
  const link = await createRadar(page);
  expect(new URL(link).origin).toBe(new URL(page.url()).origin);

  await page.getByRole("button", { name: "I've saved it — continue" }).click();
  await expect(page.getByRole("heading", { name: "Turn on your carriers' free alerts" })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Forward the alerts to Package Radar" })).toBeVisible();
  await expect(page.locator("code", { hasText: `@${E2E_INBOUND_DOMAIN}` })).toHaveText(
    new RegExp(`^r-[a-z0-9]{12,32}@${E2E_INBOUND_DOMAIN.replace(".", "\\.")}$`),
  );

  // Another device: opening the link signs in and lands on the dashboard; the key leaves the URL.
  const other = await browser.newContext();
  try {
    const otherPage = await other.newPage();
    await otherPage.goto(link);
    await expect(otherPage).toHaveURL(/\/dashboard$/);
    await expect(otherPage.getByRole("heading", { name: "No carrier emails yet" })).toBeVisible();
  } finally {
    await other.close();
  }
});

test("demo seed: the dashboard shows packages on the way and the Gmail confirmation", async ({ page }) => {
  await createRadar(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "No carrier emails yet" })).toBeVisible();
  // No ad on the empty state.
  await expect(page.getByRole("complementary", { name: "Advertisement" })).toHaveCount(0);

  await page.getByRole("button", { name: "Send sample emails" }).click();

  await expect(page.getByRole("heading", { level: 1, name: /^Yes — / })).toBeVisible();
  const onTheWay = page.getByRole("region", { name: /^On the way/ });
  await expect(onTheWay).toBeVisible();
  await expect(onTheWay.getByText("From NORTHWIND HOME GOODS")).toBeVisible();
  await expect(onTheWay.getByText(/Trailblazer Insulated Water Bottle/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Arriving today/ })).toBeVisible();

  // The sample Gmail confirmation is link-only, like Gmail's current emails.
  await expect(page.getByText("Confirm forwarding in Gmail")).toBeVisible();
  await expect(page.getByText(/^Gmail sent a confirmation link/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Open the confirmation link/ })).toHaveAttribute(
    "href",
    /^https:\/\/mail-settings\.google\.com\/mail\/vf-/,
  );
});

test("inbound: a forwarded carrier email and a Gmail confirmation code reach the dashboard", async ({
  page,
  request,
}) => {
  await createRadar(page);
  const to = await inboundAddress(page);
  expect(to.endsWith(`@${E2E_INBOUND_DOMAIN}`)).toBe(true);

  // Without the bearer secret the webhook refuses the email.
  const denied = await request.post("/api/inbound/raw", { data: { from: "mcinfo@ups.com", to } });
  expect(denied.status()).toBe(401);

  const auth = { Authorization: `Bearer ${E2E_INBOUND_SECRET}` };
  const ups = await request.post("/api/inbound/raw", {
    headers: auth,
    data: {
      from: "UPS <mcinfo@ups.com>",
      to: [to],
      subject: "UPS Update: Package Scheduled for Delivery Tomorrow",
      text: [
        "Hi Testy,",
        "Your package is arriving tomorrow.",
        "From E2E OUTDOOR SUPPLY",
        "Scheduled Delivery",
        upsDate(1, E2E_TIMEZONE),
        "UPS Ground",
        "1Z999AA10123456784",
      ].join("\n"),
      date: new Date().toISOString(),
    },
  });
  expect(ups.status()).toBe(200);
  expect(await ups.json()).toMatchObject({ ok: true, status: "stored", kind: "ups", updates: 1 });

  // Gmail's older confirmation format still carries a numeric code.
  const gmail = await request.post("/api/inbound/raw", {
    headers: auth,
    data: {
      from: "Gmail Team <forwarding-noreply@google.com>",
      to,
      subject: "(#59387283) Gmail Forwarding Confirmation - Receive Mail from sam@example.com",
      text: [
        `sam@example.com has requested to automatically forward mail to your email address ${to}.`,
        "Confirmation code: 59387283",
        "To allow sam@example.com to forward mail to your address automatically, please click the link below:",
        "https://mail-settings.google.com/mail/vf-%5BE2E-TOKEN%5D-e2eOnly",
      ].join("\n"),
      date: new Date().toISOString(),
    },
  });
  expect(gmail.status()).toBe(200);
  expect(await gmail.json()).toMatchObject({ ok: true, status: "stored", kind: "forwarding_verification" });

  // Mail for an alias nobody owns is accepted (so providers don't retry) but not stored.
  const stray = await request.post("/api/inbound/raw", {
    headers: auth,
    data: { from: "mcinfo@ups.com", to: `r-zzzzzzzzzzzzzzzz@${E2E_INBOUND_DOMAIN}`, text: "hello" },
  });
  expect(await stray.json()).toMatchObject({ ok: true, status: "unroutable" });

  await page.goto("/dashboard");
  const onTheWay = page.getByRole("region", { name: /^On the way/ });
  await expect(onTheWay.getByText("From E2E OUTDOOR SUPPLY")).toBeVisible();
  await expect(onTheWay.getByText("Expected tomorrow")).toBeVisible();
  await expect(onTheWay.getByRole("link", { name: /^1Z999AA10123456784 — track on UPS/ })).toHaveAttribute(
    "href",
    /ups\.com\/track\?.*1Z999AA10123456784/,
  );
  await expect(page.getByText(/Gmail sent a confirmation code: 59387283/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy code 59387283" })).toBeVisible();
});

test("guides: the index lists 8 guides and a guide renders with Article JSON-LD", async ({ page }) => {
  await page.goto("/guides");
  const cards = page.getByRole("main").locator('h3 a[href^="/guides/"]');
  await expect(cards).toHaveCount(8);

  await page.goto("/guides/usps-informed-delivery");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/USPS Informed Delivery/);
  await expect(page.locator("article.article h2").first()).toBeVisible();

  const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
  const graph = jsonLd
    .map((text) => JSON.parse(text) as { "@graph"?: Array<{ "@type": string; headline?: string }> })
    .flatMap((data) => data["@graph"] ?? []);
  const article = graph.find((node) => node["@type"] === "Article");
  expect(article?.headline).toMatch(/USPS Informed Delivery/);
  expect(graph.some((node) => node["@type"] === "BreadcrumbList")).toBe(true);
});

test("ads.txt is a 404 when no AdSense client is configured", async ({ request }) => {
  const res = await request.get("/ads.txt");
  expect(res.status()).toBe(404);
});

test("robots.txt keeps crawlers out of private pages, which are also noindex", async ({ page, request }) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  const robots = await res.text();
  for (const path of ["/dashboard", "/setup", "/signin", "/api/"]) {
    expect(robots).toContain(`Disallow: ${path}`);
  }
  expect(robots).toMatch(/Sitemap: \S+\/sitemap\.xml/);

  await page.goto("/dashboard");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("unknown pages render the 404 page without ads", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Nothing on the radar here" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to the home page" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Advertisement" })).toHaveCount(0);
});
