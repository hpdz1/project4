import { it } from "vitest";
import { findTrackingNumbers } from "./extract";
import { detectAllNormalized } from "./formats";
it("dbg", () => {
  for (const t of ["Hermes GB29 NWBK 2671 8614 2159 58", "Hermes 2671 8614 2159 58", "Hermes Sendungsnummer 26718614215958", "Hermes NWBK 2671 8614 2159 58"]) {
    process.stderr.write(`${t} -> ${JSON.stringify(findTrackingNumbers(t))}\n`);
  }
  process.stderr.write(JSON.stringify(detectAllNormalized("26718614215958")) + "\n");
});
