# Package Radar — architecture

## What the product does (and doesn't)

Package Radar answers one question: **"Is anything on the way to my home?"** It does
this without the user ever typing a tracking number.

Nobody outside the carriers can look up "all packages going to address X". Carriers
only show that to a verified resident, through their own free programs: USPS
Informed Delivery, UPS My Choice, FedEx Delivery Manager and others. Each of those
programs **emails** the resident about packages headed to their address, including
packages they didn't order.

So Package Radar:

1. Takes the user's address (it parses it in the browser and only stores
   country + ZIP/postcode + state) and shows which carrier programs cover it.
2. Walks them through a **one-time setup**:
   - turn on each carrier's free program, with email alerts enabled;
   - add an email filter that auto-forwards those carriers' emails to a personal
     inbound address (`r-xxxxxxxxxxxx@<INBOUND_DOMAIN>`).
3. Ingests the forwarded emails, extracts shipments (carrier, tracking number,
   shipper, status, expected date) and shows **one dashboard for every carrier**.

It never asks for carrier passwords, never scrapes carrier sites, and never claims
it can look up arbitrary addresses. That honesty is also required for Google
AdSense (misrepresentation policy) and keeps it away from the "enter your address
to track your package" phishing pattern.

## Stack

- Next.js 16 (App Router, TypeScript, React 19, Tailwind CSS v4).
- Storage: SQLite via Node's built-in `node:sqlite` (`DatabaseSync`), behind a
  `Store` interface (`src/lib/store`). An in-memory store is used in tests.
  Production needs a host with a persistent disk (Railway, Fly.io, Render, a VPS).
  A Postgres implementation of `Store` is the path to serverless hosts such as Vercel.
- Inbound email: any provider that can POST to a webhook. Built-in adapters:
  - Postmark inbound webhook → `POST /api/inbound/postmark` (HTTP basic auth).
  - Generic JSON (e.g. from the Cloudflare Email Worker in `workers/inbound-email`)
    → `POST /api/inbound/raw` (`Authorization: Bearer <INBOUND_SECRET>`).
- Tests: Vitest (unit, `src/**/*.test.ts`, `npm test`), Playwright (e2e smoke, `e2e/`,
  `npm run test:e2e`: builds, then runs `next start` with `DEMO_MODE=1`, an inbound secret and a
  fresh SQLite file at `.data/e2e.db`).

## Directory map

```
src/
  lib/
    types.ts              shared domain types (the contract between modules)
    site.ts               public (NEXT_PUBLIC_*) settings: site URL, contact email, AdSense ids
    tracking/             carrier detection, check digits, tracking URLs, text/URL extraction
    ingest/               inbound email normalization, forwarding helpers, classification, carrier parsers
    store/                Store interface, merge rules, memory + sqlite implementations
    dashboard.ts          pure: stored shipments -> DashboardResponse pieces
    location/             parse ZIP/postcode/state from free text; ZIP3 -> state table
    programs/             carrier program data, coverage by country/state, email-filter builders
    server/               route-handler helpers: env config (config.ts), session cookies, rate limiting,
                          origin checks, JSON errors, the shared inbound pipeline
    client/               browser-side helpers: typed API client, localStorage, formatting
  app/
    page.tsx              landing (address -> coverage -> "Set up my radar")
    setup/                one-time setup wizard (client)
    dashboard/            the answer page (client, polls /api/dashboard)
    signin/               sign in on another device with a personal key
    guides/               guide articles (SEO + AdSense publisher content)
    about, privacy, terms, contact
    api/…                 route handlers (see "HTTP API")
    ads.txt/route.ts      AdSense ads.txt generated from env
    sitemap.ts, robots.ts
  components/             UI components (site chrome, AdSlot, etc.)
  content/guides/         guide article content
workers/inbound-email/    optional Cloudflare Email Worker that forwards raw mail to /api/inbound/raw
e2e/                      Playwright smoke tests
```

## Module contracts

All shared types live in `src/lib/types.ts`. Module public APIs:

### `src/lib/tracking`

```ts
export const CARRIER_NAMES: Record<CarrierId, string>;              // "usps" -> "USPS"
export function trackingUrl(carrier: CarrierId, trackingNumber: string): string | null;
export function normalizeTrackingNumber(raw: string): string;          // uppercase, strip spaces/dashes
export function detectTrackingNumber(raw: string): DetectedTrackingNumber | null;
/** Find tracking numbers in free text and in tracking links (carrier URLs). Deduped; checksum-invalid candidates dropped when the format has a check digit. */
export function findTrackingNumbers(text: string, opts?: { carrierHint?: CarrierId }): DetectedTrackingNumber[];
```

### `src/lib/ingest`

```ts
export function fromPostmark(payload: unknown, receivedAt?: Date): InboundEmail;  // throws InboundPayloadError on bad input
export function fromRawJson(payload: unknown, receivedAt?: Date): InboundEmail;   // generic JSON shape (see route)
export function findInboundAlias(email: InboundEmail, inboundDomain: string): string | null;  // "r-xxxx"
/** Pure; never throws. Pass the account's time zone so "today"/"tomorrow" resolve at the delivery address. */
export function parseEmail(email: InboundEmail, opts?: { timezone?: string }): ParsedEmail;
export function htmlToText(html: string): string;
```

### `src/lib/store`

```ts
export interface Store { … }        // see src/lib/store/types.ts
export function mergeShipment(existing: StoredShipment | null, update: ShipmentUpdate, id: string): StoredShipment;
export function dedupeKey(update: Pick<ShipmentUpdate, "carrier" | "trackingNumber" | "orderRef">): string | null;
export function getStore(): Store;  // process-wide singleton (sqlite at DATABASE_PATH)
```

### `src/lib/dashboard.ts`

```ts
export function buildDashboard(input: {
  account: AccountView; shipments: StoredShipment[]; feeds: { source: SourceKind; lastSeenAt: string }[];
  verifications: ForwardingVerification[]; emailsReceived: number; lastEmailAt: string | null; now: Date;
  demoMode: boolean;
}): DashboardResponse;
```

### `src/lib/location` and `src/lib/programs`

```ts
export function parseLocation(input: string, countryHint?: string): ParsedLocation;
export function zipToState(zip5: string): string | null;
export const PROGRAMS: Program[];
export function getCoverage(country: string, region: string | null): Coverage;
export function buildFilterInstructions(
  provider: EmailProvider, inboundAddress: string, programIds: ProgramId[],
  options?: { country?: string; extraSenders?: string[] },
): FilterInstructions;
```

## HTTP API

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /api/account` | none (rate-limited) | Create an account → sets session cookie, returns `{ account, accountKey }` (key shown once) |
| `GET /api/account` | session | `{ account: AccountView, demoMode }` (`AccountResponse`) |
| `PATCH /api/account` | session | Update postal code / region / timezone / program checklist |
| `DELETE /api/account` | session | Delete the account and all its data → `{ ok: true }` |
| `POST /api/account/key` | session | Rotate the sign-in key (old key stops working) → `{ account, accountKey, demoMode }` |
| `POST /api/session` | none (rate-limited) | Sign in with an account key → sets cookie |
| `DELETE /api/session` | none | Sign out on this device → `{ ok: true }` (works without a session) |
| `GET /api/dashboard` | session | `DashboardResponse` |
| `PATCH /api/shipments/[id]` | session | `{ hidden?, delivered? }` → `{ shipment: StoredShipment }` |
| `DELETE /api/shipments/[id]` | session | Delete one shipment permanently → `{ ok: true }` |
| `GET /api/account/export` | session | Download everything we hold about the account (`AccountExport`, JSON attachment) |
| `POST /api/inbound/postmark` | basic auth | Postmark inbound webhook |
| `POST /api/inbound/raw` | bearer | Generic JSON inbound email |
| `POST /api/demo/seed` | session, `DEMO_MODE=1` only | Inject sample carrier emails into the current account → `{ added, updates }` |

State-changing browser endpoints require a same-origin `Origin` header; those that take input
need a JSON body (`Content-Type: application/json`). Behind a reverse proxy set `TRUST_PROXY=1`, or
rate limits are shared by all clients and the origin check may fail. Every env var is documented in
`.env.example`.
Inbound endpoints always answer 200 for well-formed-but-unroutable mail, so providers
don't retry it forever.

## Security & privacy

- Session = random 256-bit account key, stored only as a SHA-256 hash; sent as an
  `httpOnly`, `SameSite=Lax` cookie (`Secure` in production).
- Inbound aliases have ≥60 bits of entropy and only let someone *send* email into an
  account, never read it.
- We store only extracted shipment fields. Raw email bodies are never persisted.
- Street addresses never leave the browser; the server stores country, ZIP/postcode and state.
- Rate limits: account creation and sign-in per IP; inbound mail per alias.

## Ads & SEO

- AdSense is off unless `NEXT_PUBLIC_ADSENSE_CLIENT` is set. Manual responsive units
  (`<AdSlot>`) only on pages with real publisher content (landing, guides, dashboard below
  the answer). Never on error/404/empty pages, never next to buttons.
- `ads.txt` is generated from the publisher ID. The privacy policy carries the disclosures
  AdSense requires. Consent for EEA/UK/CH visitors uses Google's own "Privacy & messaging" CMP,
  configured in the AdSense dashboard (no code here).
- Metadata API, `sitemap.ts`, `robots.ts`, Article JSON-LD on guides. Private pages
  (`/dashboard`, `/setup`, `/signin`) are `noindex`.

## Worldwide

Package Radar is for users in any country. The UI is English only, written so browser
translation works well: `<html lang="en">`, real text (no text in images), unambiguous
dates ("Tue, Oct 13"), and `translate="no"` on values that must not be translated
(inbound address, filter queries, tracking numbers, confirmation codes, brand name).

- `CarrierId` covers national posts and major couriers worldwide; UPU S10 items from
  posts we don't name are `intl_post` (with `originCountry`).
- `ProgramId` is a string: programs are data in `src/lib/programs`, per country, and the
  API validates ids against `PROGRAMS`.
- `parseEmail(email, ctx)` takes the account's `timezone` and `country` to resolve
  relative dates and dd/mm vs mm/dd. Status keywords and month names are multilingual.
- Item descriptions are never stored (they can reveal sensitive purchases such as
  pharmacy orders). We keep carrier, tracking number / order reference, shipper, status
  and dates only.

## Retention

Enforced by `Store.purgeExpired(now)` (run opportunistically, at most hourly):
delivered shipments are deleted 30 days after delivery, shipments with no news for
60 days are deleted, the email log keeps 90 days (and at most 200 rows), and
forwarding confirmations are deleted after 48 hours. Users can delete one shipment
or their whole account at any time and download a JSON export of their data.
