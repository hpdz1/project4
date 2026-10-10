/** Email log rows kept per account (newest first). */
export const EMAIL_LOG_LIMIT = 200;

/** Forwarding verifications kept per account (newest first). */
export const VERIFICATION_LIMIT = 20;

// Retention windows enforced by Store.purgeExpired (docs/ARCHITECTURE.md "Retention").

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** A delivered shipment is deleted this long after delivery. */
export const DELIVERED_RETENTION_MS = 30 * DAY_MS;

/** Any shipment is deleted this long after its newest fact. */
export const STALE_SHIPMENT_RETENTION_MS = 60 * DAY_MS;

/** Email log rows are deleted this long after the email. */
export const EMAIL_LOG_RETENTION_MS = 90 * DAY_MS;

/** Forwarding confirmations (codes, links) are deleted this long after they arrived. */
export const VERIFICATION_RETENTION_MS = 48 * HOUR_MS;
