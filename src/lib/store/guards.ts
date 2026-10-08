import type {
  CarrierId,
  ForwardingVerification,
  ParsedEmail,
  ProgramId,
  ProgramState,
  ShipmentStatus,
  SourceKind,
} from "@/lib/types";

// Record<Union, true> makes the compiler flag a value added to the union but not here.
const SOURCE_KINDS: Record<SourceKind, true> = {
  usps_digest: true,
  usps_alert: true,
  ups: true,
  fedex: true,
  amazon: true,
  dhl: true,
  generic: true,
};

const CARRIERS: Record<CarrierId, true> = {
  usps: true,
  ups: true,
  fedex: true,
  dhl: true,
  amazon: true,
  ontrac: true,
  unknown: true,
};

const STATUSES: Record<ShipmentStatus, true> = {
  pre_transit: true,
  in_transit: true,
  out_for_delivery: true,
  available_for_pickup: true,
  delivered: true,
  exception: true,
  return_to_sender: true,
  unknown: true,
};

const VERIFICATION_PROVIDERS: Record<ForwardingVerification["provider"], true> = {
  gmail: true,
  yahoo: true,
  icloud: true,
  outlook: true,
  other: true,
};

const has = (table: object, value: string): boolean => Object.prototype.hasOwnProperty.call(table, value);

export function isSourceKind(value: string): value is SourceKind {
  return has(SOURCE_KINDS, value);
}

export function isCarrierId(value: string): value is CarrierId {
  return has(CARRIERS, value);
}

export function isShipmentStatus(value: string): value is ShipmentStatus {
  return has(STATUSES, value);
}

export function isVerificationProvider(value: string): value is ForwardingVerification["provider"] {
  return has(VERIFICATION_PROVIDERS, value);
}

export function isEmailKind(value: string): value is ParsedEmail["kind"] {
  return value === "forwarding_verification" || value === "ignored" || isSourceKind(value);
}

export function isProgramState(value: unknown): value is ProgramState {
  return value === "done" || value === "skipped";
}

/**
 * Applies a programs patch (`null` deletes a key) to a copy of `current`.
 * Values that are not a ProgramState are ignored.
 */
export function patchPrograms(
  current: Partial<Record<ProgramId, ProgramState>>,
  patch: Partial<Record<ProgramId, ProgramState | null>>,
): Partial<Record<ProgramId, ProgramState>> {
  const next: Partial<Record<ProgramId, ProgramState>> = { ...current };
  for (const [id, state] of Object.entries(patch) as [ProgramId, ProgramState | null | undefined][]) {
    if (state === null) delete next[id];
    else if (isProgramState(state)) next[id] = state;
  }
  return next;
}
