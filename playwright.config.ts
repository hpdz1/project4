import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_PATH, E2E_INBOUND_DOMAIN, E2E_INBOUND_SECRET, E2E_TIMEZONE } from "./e2e/env";

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Fixed so "today" / "tomorrow" on the dashboard match what the specs compute.
    timezoneId: E2E_TIMEZONE,
    locale: "en-US",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Fresh database, then a production build served by `next start`.
    command: `node e2e/reset-db.mjs ${E2E_DATABASE_PATH} && npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Always our own server: a reused one may have another database, env or spent rate limits.
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      DEMO_MODE: "1",
      INBOUND_SECRET: E2E_INBOUND_SECRET,
      INBOUND_DOMAIN: E2E_INBOUND_DOMAIN,
      DATABASE_PATH: E2E_DATABASE_PATH,
      // Pin ads off even if the shell or a .env file sets them (/ads.txt must 404).
      NEXT_PUBLIC_ADSENSE_CLIENT: "",
      NEXT_PUBLIC_SHOW_AD_PLACEHOLDERS: "",
      NODE_OPTIONS: "--disable-warning=ExperimentalWarning",
    },
  },
});
