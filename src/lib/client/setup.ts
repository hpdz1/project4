/**
 * Pure logic for the /setup wizard: the steps, which carrier programs to walk
 * through, and which programs' senders go into the forwarding filter.
 */
import type { Coverage, Program } from "@/lib/programs";
import type { ParsedLocation } from "@/lib/location";
import type { ProgramId, ProgramState } from "@/lib/types";

export type SetupStepId = "address" | "carriers" | "forward" | "done";

export interface SetupStep {
  id: SetupStepId;
  /** Short label for the progress indicator. */
  label: string;
  /** The step's heading. */
  title: string;
}

export const SETUP_STEPS: readonly SetupStep[] = [
  { id: "address", label: "Address", title: "Your address" },
  { id: "carriers", label: "Carrier alerts", title: "Turn on your carriers' free alerts" },
  { id: "forward", label: "Forwarding", title: "Forward the alerts to Package Radar" },
  { id: "done", label: "Done", title: "You're set" },
];

export function stepIndex(id: SetupStepId): number {
  return SETUP_STEPS.findIndex((s) => s.id === id);
}

/** The step named by a "#forward"-style fragment, or null. */
export function stepFromHash(hash: string): SetupStepId | null {
  const id = hash.replace(/^#/, "").trim().toLowerCase();
  return SETUP_STEPS.some((s) => s.id === id) ? (id as SetupStepId) : null;
}

/**
 * Which step to open on load. Without an account only the address step makes
 * sense; with one, honour a valid fragment, else start at the carriers step.
 */
export function initialStep(hasAccount: boolean, hash: string): SetupStepId {
  if (!hasAccount) return "address";
  return stepFromHash(hash) ?? "carriers";
}

/** Programs the user signs up for in step 2: address-based ones first, then account-based. */
export function checklistPrograms(coverage: Coverage): Program[] {
  return [...coverage.addressPrograms, ...coverage.accountPrograms];
}

export interface ChecklistProgress {
  done: number;
  skipped: number;
  todo: number;
  total: number;
}

export function checklistProgress(
  programs: readonly Program[],
  states: Partial<Record<ProgramId, ProgramState>>,
): ChecklistProgress {
  let done = 0;
  let skipped = 0;
  for (const p of programs) {
    if (states[p.id] === "done") done++;
    else if (states[p.id] === "skipped") skipped++;
  }
  return { done, skipped, todo: programs.length - done - skipped, total: programs.length };
}

/** A copy of `states` with one program set (or cleared with null). */
export function withProgramState(
  states: Partial<Record<ProgramId, ProgramState>>,
  id: ProgramId,
  state: ProgramState | null,
): Partial<Record<ProgramId, ProgramState>> {
  const next = { ...states };
  if (state) next[id] = state;
  else delete next[id];
  return next;
}

/**
 * Program ids whose senders go into the forwarding filter: every checklist
 * program the user hasn't skipped (alerts may start after a mailed code
 * arrives), plus per-package programs that email (DHL), which need no
 * sign-up. Programs that send no email (OnTrac texts) are left out.
 */
export function forwardingProgramIds(
  coverage: Coverage,
  states: Partial<Record<ProgramId, ProgramState>>,
): ProgramId[] {
  const ids: ProgramId[] = [];
  for (const p of checklistPrograms(coverage)) {
    if (states[p.id] !== "skipped" && hasEmailAlerts(p)) ids.push(p.id);
  }
  for (const p of coverage.perPackage) {
    if (hasEmailAlerts(p) && !ids.includes(p.id)) ids.push(p.id);
  }
  return ids;
}

export function hasEmailAlerts(program: Program): boolean {
  return (
    program.emailAlerts.senders.length > 0 ||
    Object.values(program.emailAlerts.sendersByCountry ?? {}).some((list) => (list?.length ?? 0) > 0)
  );
}

/** What the address step can save, or a message explaining what's missing. */
export type AddressCheck =
  | { ok: true; country: string; postalCode: string | null; region: string | null }
  | { ok: false; message: string };

/**
 * Decide whether a parsed address is enough to set up a radar. A postcode is
 * required for the countries we have program data for (it decides coverage);
 * "Other" (ZZ) needs nothing.
 */
export function checkAddress(parsed: ParsedLocation, otherCountryCode = "ZZ"): AddressCheck {
  if (parsed.country === otherCountryCode) {
    return { ok: true, country: parsed.country, postalCode: parsed.postalCode, region: parsed.region };
  }
  if (!parsed.postalCode) {
    const hint = parsed.warnings[0];
    return {
      ok: false,
      message:
        hint ??
        (parsed.country === "US"
          ? "Add your ZIP code so we can show the right carriers."
          : "Add your postcode so we can show the right carriers."),
    };
  }
  return { ok: true, country: parsed.country, postalCode: parsed.postalCode, region: parsed.region };
}

/** "ZIP 60614 · IL · United States" style summary of what the server will store. */
export function locationSummary(
  location: { country: string; postalCode: string | null; region: string | null },
  countryName: string | null,
): string {
  const parts: string[] = [];
  if (location.postalCode) {
    parts.push(location.country === "US" ? `ZIP ${location.postalCode}` : location.postalCode);
  }
  if (location.region) parts.push(location.region);
  parts.push(countryName ?? location.country);
  return parts.join(" · ");
}
