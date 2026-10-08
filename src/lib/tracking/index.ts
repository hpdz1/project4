/**
 * Carrier detection, check digits, tracking URLs and text/URL extraction.
 * See docs/ARCHITECTURE.md ("src/lib/tracking").
 */
export { CARRIER_NAMES, trackingUrl } from "./carriers";
export { normalizeTrackingNumber } from "./normalize";
export { detectTrackingNumber } from "./formats";
export { findTrackingNumbers, type FindOptions } from "./extract";
