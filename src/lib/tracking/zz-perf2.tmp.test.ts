import { it } from "vitest";
import { findTrackingNumbers } from "./extract";
function rng(seed: number) {
  let x = seed;
  return (n: number) => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x % n;
  };
}
it("what", () => {
  const next = rng(1);
  const rd = (n: number) => Array.from({ length: n }, () => String(next(10))).join("");
  for (const [label, text] of [
    ["groups", Array.from({ length: 30000 }, () => rd(2 + next(3))).join(" ").slice(0, 100000)],
    ["kw", Array.from({ length: 30000 }, (_, i) => (i % 5 === 0 ? "Sendungsnummer DHL GLS " : "") + rd(2 + next(3))).join(" ").slice(0, 100000)],
  ] as const) {
    const r = findTrackingNumbers(text);
    const counts: Record<string, number> = {};
    for (const x of r) counts[x.format] = (counts[x.format] ?? 0) + 1;
    process.stderr.write(label + " " + JSON.stringify(counts) + "\n");
  }
});
