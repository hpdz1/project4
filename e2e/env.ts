/** Server settings for the e2e run, shared by playwright.config.ts and the specs. */
export const E2E_INBOUND_SECRET = "e2e-secret";
export const E2E_INBOUND_DOMAIN = "inbound.test";
/** Throwaway SQLite file, deleted before the server starts so every run begins empty. */
export const E2E_DATABASE_PATH = ".data/e2e.db";
/** The browser's (and so each new account's) time zone. */
export const E2E_TIMEZONE = "America/Chicago";
