/**
 * Characters that are stripped from a tracking number: whitespace (including
 * NBSP and thin spaces), ASCII and Unicode dashes, dots, and the invisible
 * characters email templates insert to stop phone-number auto-linking.
 */
const STRIP_RE = /[\s.\-‐-―−​-‍⁠﻿­]+/g;

/**
 * Canonical form of a tracking number as typed or printed: uppercase, with
 * whitespace, dashes and dots removed.
 *
 * @example normalizeTrackingNumber("1z 5r8-939.03") // "1Z5R893903"
 */
export function normalizeTrackingNumber(raw: string): string {
  return raw.replace(STRIP_RE, "").toUpperCase();
}
