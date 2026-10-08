/**
 * ISO-8601 helpers. Timestamps arrive in mixed shapes ("...Z", "....000Z",
 * "+02:00" offsets), so they are compared as instants, never as strings.
 */

/** Milliseconds since the epoch, or NaN when `iso` is not a parseable date. */
export function isoToMs(iso: string): number {
  return Date.parse(iso);
}

/** Like `isoToMs`, but unparseable values sort as the oldest possible time. */
export function isoToSortMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Compares two ISO-8601 timestamps as instants (negative when `a` is earlier).
 * Falls back to string order when either side is unparseable.
 */
export function compareIso(a: string, b: string): number {
  const ma = Date.parse(a);
  const mb = Date.parse(b);
  if (Number.isNaN(ma) || Number.isNaN(mb)) return a < b ? -1 : a > b ? 1 : 0;
  return ma - mb;
}

/** The later of two timestamps (the first one on a tie). */
export function maxIso(a: string, b: string): string {
  return compareIso(b, a) > 0 ? b : a;
}

/** The earlier of two timestamps (the first one on a tie). */
export function minIso(a: string, b: string): string {
  return compareIso(b, a) < 0 ? b : a;
}
