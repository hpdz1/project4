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
  carrier_alert: true,
  generic: true,
};

const CARRIERS: Record<CarrierId, true> = {
  // North America
  usps: true,
  ups: true,
  fedex: true,
  dhl: true,
  dhl_ecommerce: true,
  amazon: true,
  ontrac: true,
  canada_post: true,
  purolator: true,
  estafeta: true,
  // Europe
  dhl_paket: true,
  hermes: true,
  royal_mail: true,
  parcelforce: true,
  evri: true,
  dpd: true,
  gls: true,
  an_post: true,
  postnl: true,
  bpost: true,
  la_poste: true,
  chronopost: true,
  swiss_post: true,
  austrian_post: true,
  correos: true,
  poste_italiane: true,
  ctt: true,
  inpost: true,
  poczta_polska: true,
  packeta: true,
  postnord: true,
  posten_bring: true,
  posti: true,
  ptt: true,
  // Asia-Pacific
  australia_post: true,
  nz_post: true,
  japan_post: true,
  yamato: true,
  sagawa: true,
  korea_post: true,
  cj_logistics: true,
  china_post: true,
  cainiao: true,
  sf_express: true,
  yunexpress: true,
  yanwen: true,
  fourpx: true,
  hongkong_post: true,
  singpost: true,
  india_post: true,
  delhivery: true,
  blue_dart: true,
  // Latin America, Middle East & Africa
  correios: true,
  aramex: true,
  emirates_post: true,
  smsa: true,
  israel_post: true,
  // Fallbacks
  intl_post: true,
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

const PROGRAM_ID = /^[a-z0-9_]{2,64}$/;

/**
 * Whether `value` is shaped like a program id ("usps_informed_delivery").
 * Program ids are data (PROGRAMS in src/lib/programs, validated by the API);
 * the store only guards the shape, so a stored checklist never carries
 * arbitrary keys. "__proto__" fits the pattern but can't be a plain object key.
 */
export function isProgramId(value: string): value is ProgramId {
  return PROGRAM_ID.test(value) && value !== "__proto__";
}

/**
 * Keeps only well-formed entries (a program-id-shaped key with a ProgramState
 * value) of a programs map read from storage or JSON.
 */
export function sanitizePrograms(value: unknown): Partial<Record<ProgramId, ProgramState>> {
  const programs: Partial<Record<ProgramId, ProgramState>> = {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) return programs;
  for (const [id, state] of Object.entries(value)) {
    if (isProgramId(id) && isProgramState(state)) programs[id] = state;
  }
  return programs;
}

/**
 * Applies a programs patch (`null` deletes a key) to a copy of `current`.
 * Entries whose key is not program-id-shaped, or whose value is neither null
 * nor a ProgramState, are ignored.
 */
export function patchPrograms(
  current: Partial<Record<ProgramId, ProgramState>>,
  patch: Partial<Record<ProgramId, ProgramState | null>>,
): Partial<Record<ProgramId, ProgramState>> {
  const next = sanitizePrograms(current);
  for (const [id, state] of Object.entries(patch) as [ProgramId, ProgramState | null | undefined][]) {
    if (!isProgramId(id)) continue;
    if (state === null) delete next[id];
    else if (isProgramState(state)) next[id] = state;
  }
  return next;
}
