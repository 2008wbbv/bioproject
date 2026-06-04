import { describe, it, expect } from "vitest";
import { bindingSiteResidues, bindingSiteImpact } from "./bindingSite.ts";
import type { HetAtom, ResidueRecord } from "./types.ts";

function res(uniprotNum: number, xyz: [number, number, number]): ResidueRecord {
  return { uniprotNum, authNum: uniprotNum, chain: "A", resName: "ALA", caXyz: xyz, bFactor: 0 };
}

describe("bindingSiteResidues", () => {
  const het: HetAtom[] = [{ resName: "ATP", xyz: [0, 0, 0] }];

  it("flags residues within the cutoff of a ligand atom", () => {
    const residues = [res(1, [3, 0, 0]), res(2, [10, 0, 0]), res(3, [0, 4, 0])];
    const site = bindingSiteResidues(residues, het, 5);
    expect([...site].sort()).toEqual([1, 3]); // 3Å and 4Å in; 10Å out
  });

  it("returns empty when there are no ligand atoms", () => {
    expect(bindingSiteResidues([res(1, [0, 0, 0])], [], 5).size).toBe(0);
  });
});

describe("bindingSiteImpact", () => {
  it("splits deviation into site vs rest means", () => {
    const per = [
      { uniprotNum: 1, deviation: 8 },
      { uniprotNum: 2, deviation: 1 },
      { uniprotNum: 3, deviation: 0.5 },
    ];
    const impact = bindingSiteImpact(per, new Set([1]));
    expect(impact.siteCount).toBe(1);
    expect(impact.siteMeanDeviation).toBe(8);
    expect(impact.restCount).toBe(2);
    expect(impact.restMeanDeviation).toBeCloseTo(0.75, 6);
  });
});
