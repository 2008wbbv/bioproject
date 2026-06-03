import { describe, it, expect } from "vitest";
import { pickBestChain } from "./pipeline.ts";
import type { ResidueRecord } from "../engine/types.ts";

function res(chain: string, uniprotNum: number | null, hasCa = true): ResidueRecord {
  return {
    uniprotNum,
    authNum: uniprotNum ?? 0,
    chain,
    resName: "ALA",
    caXyz: hasCa ? [0, 0, 0] : null,
    bFactor: 0,
  };
}

describe("pickBestChain", () => {
  it("picks the chain with the most UniProt-mapped CA residues", () => {
    const residues = [
      res("A", 1), res("A", 2),
      res("B", 1), res("B", 2), res("B", 3),
    ];
    expect(pickBestChain(residues)).toBe("B");
  });

  it("ignores residues without a UniProt number or without a CA", () => {
    const residues = [
      res("A", 1), res("A", 2), res("A", 3),
      res("B", null), res("B", 5, false), res("B", 6),
    ];
    expect(pickBestChain(residues)).toBe("A");
  });

  it("breaks ties deterministically by chain id", () => {
    const residues = [res("B", 1), res("A", 1)];
    expect(pickBestChain(residues)).toBe("A");
  });

  it("returns null when nothing is mappable", () => {
    expect(pickBestChain([res("A", null), res("B", 1, false)])).toBeNull();
  });
});
