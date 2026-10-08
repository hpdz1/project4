/**
 * Small, SSR-safe wrappers around browser globals, so components and tests
 * don't each repeat the `typeof window` checks.
 */

/** The viewer's IANA time zone, e.g. "America/Chicago" (undefined if the browser won't say). */
export function browserTimeZone(): string | undefined {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof zone === "string" && zone ? zone : undefined;
  } catch {
    return undefined;
  }
}

/** "https://example.com", or "" on the server. */
export function currentOrigin(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}

/** The current URL fragment including "#", or "" on the server. */
export function currentHash(): string {
  return typeof window === "undefined" ? "" : window.location.hash;
}

/** Replace the URL fragment without adding a history entry (null removes it). */
export function replaceHash(hash: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const { pathname, search } = window.location;
    const next = hash ? `${pathname}${search}#${hash.replace(/^#/, "")}` : `${pathname}${search}`;
    window.history.replaceState(window.history.state, "", next);
  } catch {
    // history can throw in sandboxed frames; the fragment just stays
  }
}
