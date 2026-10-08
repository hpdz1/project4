import { z } from "zod";
import { normalizeCountryCode } from "@/lib/location";
import { PROGRAMS_BY_ID } from "@/lib/programs";
import type { ProgramId } from "@/lib/types";

/**
 * zod schemas for the browser-facing API payloads in src/lib/types.ts
 * (CreateAccountRequest, UpdateAccountRequest, UpdateShipmentRequest, sign-in).
 */

/** Used when the browser sends no time zone, or one this server doesn't know. */
export const DEFAULT_TIMEZONE = "America/New_York";

/** The canonical IANA name of `tz` (e.g. "america/chicago" -> "America/Chicago"), or null if unknown. */
export function canonicalTimeZone(tz: unknown): string | null {
  if (typeof tz !== "string") return null;
  const trimmed = tz.trim();
  if (!trimmed || trimmed.length > 64) return null;
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

const PROGRAM_IDS = Object.keys(PROGRAMS_BY_ID) as [ProgramId, ...ProgramId[]];

const country = z
  .string()
  .max(8)
  .refine((s) => normalizeCountryCode(s) !== null, "Use a two-letter country code, e.g. \"US\".")
  .transform((s) => normalizeCountryCode(s) ?? s);

/** Optional uppercase token: "" and null mean "not given". */
function optionalCode(pattern: RegExp, max: number, message: string) {
  return z
    .string()
    .trim()
    .max(max, message)
    .transform((s) => s.replace(/\s+/g, " ").toUpperCase())
    .refine((s) => s === "" || pattern.test(s), message)
    .transform((s) => (s === "" ? null : s))
    .nullable()
    .optional();
}

/** ZIP / postcode: letters, digits, spaces and dashes (e.g. "94107", "SW1A 1AA", "1012 AB"). */
const postalCode = optionalCode(/^[A-Z0-9][A-Z0-9 -]{0,15}$/, 16, "That doesn't look like a ZIP or postcode.");

/** State / province code, e.g. "CA", "ON", "NSW". */
const region = optionalCode(/^[A-Z0-9][A-Z0-9-]{0,5}$/, 6, "Use a short state or province code, e.g. \"CA\".");

/** POST /api/account. An unknown or missing time zone falls back to DEFAULT_TIMEZONE. */
export const createAccountSchema = z.object({
  country,
  postalCode,
  region,
  timezone: z
    .unknown()
    .optional()
    .transform((tz) => canonicalTimeZone(tz) ?? DEFAULT_TIMEZONE),
});

/** PATCH /api/account. Here an unknown time zone is an error. */
export const updateAccountSchema = z.object({
  country: country.optional(),
  postalCode,
  region,
  timezone: z
    .string()
    .refine((tz) => canonicalTimeZone(tz) !== null, "Unknown time zone.")
    .transform((tz) => canonicalTimeZone(tz) ?? tz)
    .optional(),
  programs: z.partialRecord(z.enum(PROGRAM_IDS), z.enum(["done", "skipped"]).nullable()).optional(),
});

/** PATCH /api/shipments/[id]: at least one flag. */
export const updateShipmentSchema = z
  .object({
    hidden: z.boolean().optional(),
    delivered: z.boolean().optional(),
  })
  .refine((v) => v.hidden !== undefined || v.delivered !== undefined, "Send hidden and/or delivered.");

/** POST /api/session. */
export const signInSchema = z.object({
  accountKey: z.string().max(512),
});
