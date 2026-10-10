import { it } from "vitest";
import { findTrackingNumbers } from "./extract";

function time(label: string, text: string, hint?: Parameters<typeof findTrackingNumbers>[1]) {
  const t0 = performance.now();
  const r = findTrackingNumbers(text, hint);
  const ms = performance.now() - t0;
  process.stderr.write([label, text.length, "chars", ms.toFixed(1), "ms", (ms * 1000 / text.length).toFixed(2), "us/char", r.length, "results"].join(" ") + "\n");
}
function rng(seed: number) {
  let x = seed;
  return (n: number) => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x % n;
  };
}
it("perf", () => {
  const next = rng(1);
  const rd = (n: number) => Array.from({ length: n }, () => String(next(10))).join("");
  time("1 1 1", "1 ".repeat(50000));
  time("random single digits", Array.from({ length: 50000 }, () => rd(1)).join(" "));
  time("random 2-4 groups", Array.from({ length: 30000 }, () => rd(2 + next(3))).join(" ").slice(0, 100000));
  time("random 2-4 groups hint dhl", Array.from({ length: 30000 }, () => rd(2 + next(3))).join(" ").slice(0, 100000), { carrierHint: "dhl" });
  time("random 2-4 groups w/ keywords", Array.from({ length: 30000 }, (_, i) => (i % 5 === 0 ? "Sendungsnummer DHL GLS " : "") + rd(2 + next(3))).join(" ").slice(0, 100000));
  time("random 12 digits w/ keywords", Array.from({ length: 8000 }, () => "tracking " + rd(12)).join(" ").slice(0, 100000));
  time("random 12 digits w/ DHL", Array.from({ length: 8000 }, () => "DHL " + rd(12)).join(" ").slice(0, 100000));
  time("A 1 A 1", "A 1 ".repeat(25000));
  time("AB 12 AB 12", "AB 12 ".repeat(16666));
  time("JJD 1", "JJD 1 ".repeat(16666));
  time("japanese", "追跡番号 ".repeat(5000) + Array.from({ length: 5000 }, () => rd(4) + "-" + rd(4) + "-" + rd(4)).join(" "));
});
