/**
 * Check-digit algorithms used by carrier tracking numbers.
 *
 * Semantics follow jkeen/tracking_number_data v2.0.0 (`checksum_validations.rb`
 * in the reference gem), USPS Publication 199 §4.6 and the UPU S10 rule as
 * described in the research notes. Every function takes the *serial* (the
 * characters the check digit is computed over) and returns the expected check
 * digit, so callers compare it with the printed one.
 */

/**
 * Numeric value of one character for the UPS-style mod 10: digits are
 * themselves, letters are `(charCode - 3) % 10` (A=2, B=3, ... I=0, ... Z=7).
 */
export function charValue(c: string): number {
  const code = c.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48;
  return (code - 3) % 10;
}

/**
 * tracking_number_data `mod10`: multiply characters at even 0-based indexes
 * by `evens` and odd ones by `odds`, sum, and return `(10 - sum % 10) % 10`.
 * No digit folding (this is not Luhn). Letters use {@link charValue}.
 */
export function mod10CheckDigit(serial: string, evens: number, odds: number): number {
  let sum = 0;
  for (let i = 0; i < serial.length; i++) {
    sum += charValue(serial[i]) * (i % 2 === 0 ? evens : odds);
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Weighted sum mod 11, then mod 10 (FedEx Express 12 / 34 / ASTRA / GSN):
 * `(Σ digit[i] * weights[i]) % 11 % 10`, pairing from the left.
 */
export function weightedMod11CheckDigit(serial: string, weights: readonly number[]): number {
  let sum = 0;
  const n = Math.min(serial.length, weights.length);
  for (let i = 0; i < n; i++) sum += charValue(serial[i]) * weights[i];
  return (sum % 11) % 10;
}

/** DHL Express: the serial read as a decimal number, mod 7 (check digit is 0-6). */
export function mod7CheckDigit(serial: string): number {
  let r = 0;
  for (let i = 0; i < serial.length; i++) r = (r * 10 + charValue(serial[i])) % 7;
  return r;
}

const S10_WEIGHTS = [8, 6, 4, 2, 3, 5, 9, 7] as const;

/**
 * UPU S10 (international mail, e.g. RB123456785US): weights 8,6,4,2,3,5,9,7
 * over the 8 serial digits, `11 - sum % 11`, with 10 -> 0 and 11 -> 5.
 */
export function s10CheckDigit(serial: string): number {
  let sum = 0;
  for (let i = 0; i < S10_WEIGHTS.length; i++) sum += charValue(serial[i]) * S10_WEIGHTS[i];
  const check = 11 - (sum % 11);
  if (check === 10) return 0;
  if (check === 11) return 5;
  return check;
}

/**
 * GS1 mod 10 (SSCC/NVE, GTIN; also USPS Pub 199 §4.6): counting from the
 * right, the digit next to the check digit is weighted 3, then 1, 3, 1, ...
 * Used by DHL Paket SSCCs, Hermes 14, Canada Post 16, Bring/PostNord/Posti
 * SSCCs and the Colissimo key.
 */
export function gs1CheckDigit(serial: string): number {
  let sum = 0;
  for (let i = serial.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) {
    sum += charValue(serial[i]) * w;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * USPS (Pub 199 §4.6, also the 20-digit and legacy 91 formats): the GS1 rule.
 * `serial` is every digit of the PIC except the check digit (no 420+ZIP prefix).
 */
export function uspsCheckDigit(serial: string): number {
  return gs1CheckDigit(serial);
}

/** DHL Paket 12-digit Identcode: weights 4, 9, 4, 9, ... from the left over 11 digits, `(10 - sum % 10) % 10`. */
export function identcodeCheckDigit(serial: string): number {
  let sum = 0;
  for (let i = 0; i < serial.length; i++) sum += charValue(serial[i]) * (i % 2 === 0 ? 4 : 9);
  return (10 - (sum % 10)) % 10;
}

/**
 * Luhn (Purolator 12): from the right of the serial, double every other digit
 * starting with the one next to the check digit (subtract 9 above 9), then
 * `(10 - sum % 10) % 10`.
 */
export function luhnCheckDigit(serial: string): number {
  let sum = 0;
  for (let i = serial.length - 1, double = true; i >= 0; i--, double = !double) {
    let d = charValue(serial[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

/** GLS 12: like GS1 (weights 3, 1, ... from the right) but the sum starts at 1. */
export function glsCheckDigit(serial: string): number {
  return (gs1CheckDigit(serial) + 9) % 10;
}

/**
 * Evri 16: characters valued like UPS ({@link charValue}), weights 2, 1, 2, ...
 * from the left over the 15-character serial, and the check is `sum % 10`
 * (no complement).
 */
export function evriCheckDigit(serial: string): number {
  let sum = 0;
  for (let i = 0; i < serial.length; i++) sum += charValue(serial[i]) * (i % 2 === 0 ? 2 : 1);
  return sum % 10;
}

/**
 * SF Express: `digits` is the 12-digit number or the 13 digits after "SF",
 * check digit included. The first 3 digits (area code) and the check digit
 * are skipped; the rest is read from the right with weights 1, 3, 5, 7, ...,
 * and each product contributes its tens digit plus its units digit.
 */
export function sfCheckDigit(digits: string): number {
  const core = digits.slice(3, -1);
  let sum = 0;
  for (let i = core.length - 1, w = 1; i >= 0; i--, w += 2) {
    const p = charValue(core[i]) * w;
    sum += (Math.floor(p / 10) % 10) + (p % 10);
  }
  return (10 - (sum % 10)) % 10;
}

const ALNUM36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * ISO/IEC 7064 MOD 37,36 check character (DPD, Chronopost, La Poste 86x-88x):
 * p = 36; for each character s = (p + value) % 36 (0 -> 36), p = 2s % 37;
 * the check character is the one whose value is (37 - p) % 36.
 */
export function iso7064Mod3736CheckChar(serial: string): string {
  let p = 36;
  for (const c of serial) {
    let s = (p + ALNUM36.indexOf(c)) % 36;
    if (s === 0) s = 36;
    p = (2 * s) % 37;
  }
  return ALNUM36[(37 - p) % 36];
}

const CORREOS_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

/** Correos (Spain) check letter: sum of the character codes of the serial, mod 23, into "TRWAGMYF...". */
export function correosCheckLetter(serial: string): string {
  let sum = 0;
  for (let i = 0; i < serial.length; i++) sum += serial.charCodeAt(i);
  return CORREOS_LETTERS[sum % 23];
}
