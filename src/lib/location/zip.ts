/**
 * US ZIP code -> state, from the first three digits (the "ZIP3" sectional
 * center prefix). Prefix assignments are long-standing USPS allocations;
 * prefix 969 is shared by several Pacific islands, so those are resolved by
 * the full five digits.
 */

/** [firstPrefix, lastPrefix, state], inclusive, ascending. Unassigned prefixes are absent. */
const ZIP3_RANGES: readonly (readonly [number, number, string])[] = [
  [5, 5, "NY"],
  [6, 7, "PR"],
  [8, 8, "VI"],
  [9, 9, "PR"],
  [10, 27, "MA"],
  [28, 29, "RI"],
  [30, 38, "NH"],
  [39, 49, "ME"],
  [50, 54, "VT"],
  [55, 55, "MA"],
  [56, 59, "VT"],
  [60, 69, "CT"],
  [70, 89, "NJ"],
  [90, 99, "AE"],
  [100, 149, "NY"],
  [150, 196, "PA"],
  [197, 199, "DE"],
  [200, 200, "DC"],
  [201, 201, "VA"],
  [202, 205, "DC"],
  [206, 219, "MD"],
  [220, 246, "VA"],
  [247, 268, "WV"],
  [270, 289, "NC"],
  [290, 299, "SC"],
  [300, 319, "GA"],
  [320, 339, "FL"],
  [340, 340, "AA"],
  [341, 349, "FL"],
  [350, 369, "AL"],
  [370, 385, "TN"],
  [386, 397, "MS"],
  [398, 399, "GA"],
  [400, 427, "KY"],
  [430, 459, "OH"],
  [460, 479, "IN"],
  [480, 499, "MI"],
  [500, 528, "IA"],
  [530, 549, "WI"],
  [550, 567, "MN"],
  [569, 569, "DC"],
  [570, 577, "SD"],
  [580, 588, "ND"],
  [590, 599, "MT"],
  [600, 629, "IL"],
  [630, 658, "MO"],
  [660, 679, "KS"],
  [680, 693, "NE"],
  [700, 714, "LA"],
  [716, 729, "AR"],
  [730, 732, "OK"],
  [733, 733, "TX"],
  [734, 749, "OK"],
  [750, 799, "TX"],
  [800, 816, "CO"],
  [820, 831, "WY"],
  [832, 838, "ID"],
  [840, 847, "UT"],
  [850, 865, "AZ"],
  [870, 884, "NM"],
  [885, 885, "TX"],
  [889, 898, "NV"],
  [900, 961, "CA"],
  [962, 966, "AP"],
  [967, 968, "HI"],
  [970, 979, "OR"],
  [980, 994, "WA"],
  [995, 999, "AK"],
];

/** Five-digit ZIPs in prefixes shared between territories (969xx) or carved out of another state (96799). */
function specialZip(zip: number): string | null {
  if (zip === 96799) return "AS";
  if (zip >= 96910 && zip <= 96932) return "GU";
  if (zip === 96939 || zip === 96940) return "PW";
  if (zip >= 96941 && zip <= 96944) return "FM";
  if (zip >= 96950 && zip <= 96952) return "MP";
  if (zip === 96960 || zip === 96970) return "MH";
  return null;
}

/**
 * The USPS state (or territory / military code) a ZIP code belongs to, e.g.
 * "60614" -> "IL", "09012" -> "AE". Accepts ZIP5 or ZIP+4; returns null for
 * malformed input and unassigned prefixes. A handful of ZIPs straddle state
 * lines, so treat a mismatch with a typed state as a soft signal.
 */
export function zipToState(zip5: string): string | null {
  const match = /^\s*(\d{5})(?:[-\s]?\d{4})?\s*$/.exec(zip5);
  if (!match) return null;
  const zip = Number(match[1]);
  const special = specialZip(zip);
  if (special) return special;
  const prefix = Math.floor(zip / 100);
  if (prefix === 969) return null;
  for (const [first, last, state] of ZIP3_RANGES) {
    if (prefix < first) return null;
    if (prefix <= last) return state;
  }
  return null;
}
