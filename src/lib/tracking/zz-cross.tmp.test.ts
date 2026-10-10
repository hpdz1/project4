import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { detectAllNormalized } from "./formats";

const cases: { formatId: string; number: string; valid: boolean }[] = JSON.parse(
  readFileSync("/tmp/claude-0/-home-user-project4/d9edee54-90f5-5862-9a6c-b484f4757838/scratchpad/tn-verify/cases.json", "utf8"),
);
const MAP: Record<string, string[]> = {
  iso15: ["dpd_15_digit", "chronopost_15"],
  aramex_10: ["aramex"],
};
it("cross-check", () => {
  const bad: string[] = [];
  for (const c of cases) {
    const all = detectAllNormalized(c.number);
    const ids = c.formatId.startsWith("s10") ? ["s10"] : (MAP[c.formatId] ?? [c.formatId]);
    const m = all.filter((x) => ids.includes(x.formatId));
    if (m.length === 0) { bad.push(`${c.formatId} ${c.number}: no match (${all.map((x) => x.formatId).join(",")})`); continue; }
    for (const x of m) if (x.checksumValid !== c.valid) bad.push(`${c.formatId} ${c.number}: valid ${x.checksumValid} expected ${c.valid}`);
    if (c.formatId.startsWith("s10")) process.stderr.write(`${c.number} -> ${m[0].carrier} ${m[0].originCountry ?? "-"}\n`);
  }
  process.stderr.write(bad.join("\n") + "\nBAD " + bad.length + "\n");
  expect(bad).toEqual([]);
});
