import { it } from "vitest";
import type { CarrierId } from "@/lib/types";
import { findTrackingNumbers } from "./extract";

const cases: [string, CarrierId][] = [
  ["DHL Express Deutschland +49 (0)30 99095145", "dhl"],
  ["DHL Express UK +44 (0)20 4752 7720", "dhl"],
  ["DHL Express Berlin 030 60450186", "dhl"],
  ["DHL Express mobile 0151 1911564", "dhl"],
  ["DHL Express UK 07700 253072", "dhl"],
  ["DHL Express France 01 92 98 97 53", "dhl"],
  ["DHL Express NL 06 17747034", "dhl"],
  ["DHL Express Milano 02 9860 1295", "dhl"],
  ["DHL Express Zürich 044 171 66 34", "dhl"],
  ["Hermes Germany 0049 30 86668811", "hermes"],
  ["Hermes UK 0044 20 4115 4081", "hermes"],
  ["DHL Express India 98046 36822", "dhl"],
  ["Hermes Bank: GB29 NWBK 7767 9361 7304 86", "hermes"], ["Hermes Sendung 77679361730486", "hermes"],
  ["DHL Express BE 0526.698.572", "dhl"],
  ["DHL Express Tracking 0526.698.572", "dhl"],
];
it("decoys", () => {
  for (const [text, hint] of cases) {
    const a = findTrackingNumbers(text).map((r) => `${r.carrier}:${r.trackingNumber}`);
    const b = findTrackingNumbers(text, { carrierHint: hint }).map((r) => `${r.carrier}:${r.trackingNumber}`);
    process.stderr.write(`${JSON.stringify(text)} -> ${JSON.stringify(a)} hint ${JSON.stringify(b)}\n`);
  }
});
