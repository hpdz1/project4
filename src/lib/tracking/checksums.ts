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

/** DHL Express: the serial read as a decimal number, mod 7 (check digit is 0–6). */
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
 * USPS (Pub 199 §4.6, also the 20-digit and legacy 91 formats): counting from
 * the right, the digit next to the check digit is weighted 3, then 1, 3, 1, ...
 * `serial` is every digit of the PIC except the check digit (no 420+ZIP prefix).
 */
export function uspsCheckDigit(serial: string): number {
  let sum = 0;
  for (let i = serial.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) {
    sum += charValue(serial[i]) * w;
  }
  return (10 - (sum % 10)) % 10;
}
