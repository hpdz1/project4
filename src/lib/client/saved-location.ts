/**
 * What this browser remembers between the landing page, /setup and the
 * dashboard. The typed street address is stored here and nowhere else: the
 * server only ever receives country, ZIP/postcode and region.
 */
import type { EmailProvider } from "@/lib/programs";
import { readJson, readString, removeKey, writeJson, writeString } from "./storage";

/** localStorage key for the typed address and what we parsed from it. */
export const LOCATION_KEY = "pr.location";
/** localStorage key for the email provider picked in setup step 3. */
export const PROVIDER_KEY = "pr.provider";

/** Every key this app writes, for "Delete my data". */
export const LOCAL_KEYS: readonly string[] = [LOCATION_KEY, PROVIDER_KEY];

export interface SavedLocation {
  /** Exactly what the user typed (may include the street). */
  address: string;
  /** ISO 3166-1 alpha-2, or "ZZ" for Other. */
  country: string;
  postalCode: string | null;
  region: string | null;
  city: string | null;
  /** ISO-8601. */
  savedAt: string;
}

const MAX_ADDRESS_LENGTH = 300;

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function isSavedLocation(value: unknown): value is SavedLocation {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.address === "string" &&
    v.address.length <= MAX_ADDRESS_LENGTH &&
    typeof v.country === "string" &&
    /^[A-Z]{2}$/.test(v.country) &&
    isNullableString(v.postalCode) &&
    isNullableString(v.region) &&
    isNullableString(v.city) &&
    typeof v.savedAt === "string"
  );
}

export function loadSavedLocation(storage?: Storage | null): SavedLocation | null {
  return readJson(LOCATION_KEY, isSavedLocation, storage);
}

export function saveLocation(location: SavedLocation, storage?: Storage | null): boolean {
  const trimmed: SavedLocation = {
    ...location,
    address: location.address.trim().slice(0, MAX_ADDRESS_LENGTH),
  };
  return writeJson(LOCATION_KEY, trimmed, storage);
}

const PROVIDERS: readonly EmailProvider[] = ["gmail", "outlook", "yahoo", "icloud", "other"];

export function isEmailProvider(value: unknown): value is EmailProvider {
  return typeof value === "string" && (PROVIDERS as readonly string[]).includes(value);
}

export function loadProvider(storage?: Storage | null): EmailProvider | null {
  const raw = readString(PROVIDER_KEY, storage);
  return isEmailProvider(raw) ? raw : null;
}

export function saveProvider(provider: EmailProvider, storage?: Storage | null): boolean {
  return writeString(PROVIDER_KEY, provider, storage);
}

/** Forget everything this app stored in the browser. */
export function clearLocalData(storage?: Storage | null): void {
  for (const key of LOCAL_KEYS) removeKey(key, storage);
}
