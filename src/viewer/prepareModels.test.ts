import { describe, it, expect } from "vitest";
import { prepareViewerModels } from "./prepareModels.ts";
import type { Mat3, PerResidue, Superposition } from "../engine/types.ts";

const IDENTITY: Mat3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
const NO_TRANSFORM: Superposition = { rotation: IDENTITY, centroidP: [0, 0, 0], centroidQ: [0, 0, 0] };

/** A column-exact AlphaFold-style ATOM line (B-factor = pLDDT). */
function atom(resSeq: number, plddt: number): string {
  const buf = Array<string>(80).fill(" ");
  const put = (s: number, str: string) => {
    for (let i = 0; i < str.length; i++) buf[s + i] = str[i];
  };
  const putR = (s: number, e: number, str: string) => {
    const t = str.slice(0, e - s);
    for (let i = 0; i < t.length; i++) buf[s + (e - s - t.length) + i] = t[i];
  };
  put(0, "ATOM");
  put(13, "CA");
  put(17, "ALA");
  buf[21] = "A";
  putR(22, 26, String(resSeq));
  putR(30, 38, "1.000");
  putR(38, 46, "2.000");
  putR(46, 54, "3.000");
  putR(54, 60, "1.00");
  putR(60, 66, plddt.toFixed(2));
  return buf.join("");
}
const readB = (line: string): number => Number.parseFloat(line.slice(60, 66));

describe("prepareViewerModels", () => {
  const af = [atom(10, 90), atom(11, 40), atom(12, 70)].join("\n");
  const perResidue: PerResidue[] = [
    { uniprotNum: 10, deviation: 0.5, plddt: 90 },
    { uniprotNum: 11, deviation: 6.0, plddt: 40 },
    // residue 12 deliberately unmatched (no deviation entry)
  ];

  it("encodes deviation into the deviation-mode B-factor (fallback 0 for unmatched)", () => {
    const { afDeviationPdb } = prepareViewerModels(af, NO_TRANSFORM, perResidue);
    const lines = afDeviationPdb.split("\n");
    expect(readB(lines[0])).toBeCloseTo(0.5, 2);
    expect(readB(lines[1])).toBeCloseTo(6.0, 2);
    expect(readB(lines[2])).toBeCloseTo(0, 2); // unmatched -> fallback
  });

  it("encodes (100 - pLDDT) into the confidence-mode B-factor for every residue", () => {
    const { afConfidencePdb } = prepareViewerModels(af, NO_TRANSFORM, perResidue);
    const lines = afConfidencePdb.split("\n");
    expect(readB(lines[0])).toBeCloseTo(10, 2); // 100 - 90
    expect(readB(lines[1])).toBeCloseTo(60, 2); // 100 - 40
    expect(readB(lines[2])).toBeCloseTo(30, 2); // 100 - 70 (even though unmatched)
  });

  it("reports the max deviation for the colour domain", () => {
    const { maxDeviation } = prepareViewerModels(af, NO_TRANSFORM, perResidue);
    expect(maxDeviation).toBeCloseTo(6.0, 2);
  });
});
