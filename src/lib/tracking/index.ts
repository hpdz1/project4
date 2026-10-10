/**
 * Carrier detection, check digits, tracking URLs and text/URL extraction.
 * See docs/ARCHITECTURE.md ("src/lib/tracking").
 */
export {
  CARRIER_NAMES,
  trackingPage,
  trackingUrl,
  type TrackingOptions,
  type TrackingPage,
} from "./carriers";
export { normalizeTrackingNumber } from "./normalize";
export { detectTrackingNumber, type DetectTrackingOptions } from "./formats";
export { findTrackingNumbers, type FindOptions } from "./extract";
