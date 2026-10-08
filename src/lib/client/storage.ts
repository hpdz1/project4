/**
 * Safe localStorage access. Every call is wrapped in try/catch and returns a
 * neutral value on the server, in private windows, with storage blocked or
 * full, so callers never need their own guards. Only per-browser
 * conveniences belong here (the typed address, the chosen email provider);
 * anything that must survive lives on the server.
 */

/** The browser's localStorage, or null when it isn't available. */
export function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readString(key: string, storage: Storage | null = getStorage()): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** Returns false when the value couldn't be stored. */
export function writeString(
  key: string,
  value: string,
  storage: Storage | null = getStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string, storage: Storage | null = getStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // nothing to do
  }
}

/** Parse a stored JSON value and check its shape; anything else reads as null. */
export function readJson<T>(
  key: string,
  guard: (value: unknown) => value is T,
  storage: Storage | null = getStorage(),
): T | null {
  const raw = readString(key, storage);
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return guard(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeJson(
  key: string,
  value: unknown,
  storage: Storage | null = getStorage(),
): boolean {
  let raw: string;
  try {
    raw = JSON.stringify(value);
  } catch {
    return false;
  }
  return writeString(key, raw, storage);
}
