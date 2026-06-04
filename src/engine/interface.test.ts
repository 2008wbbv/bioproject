import { describe, it, expect } from "vitest";
import { mappedChains, interfaceResidues } from "./interface.ts";
import type { ResidueRecord } from "./types.ts";

function res(chain: string, uniprotNum: number | null, xyz: [number, number, number] | null): ResidueRecord {
  return { uniprotNum, authNum: uniprotNum ?? 0, chain, resName: "ALA", caXyz: xyz, bFactor: 0 };
}

describe("mappedChains", () => {
  it("lists chains with enough UniProt-mapped CA residues", () => {
    const residues = [
      ...Array.from({ length: 6 }, (_, i) => res("A", i + 1, [i, 0, 0])),
      ...Array.from({ length: 6 }, (_, i) => res("B", i + 1, [i, 10, 0])),
      res("C", 1, [0, 0, 0]), // only 1 -> excluded
    ];
    expect(mappedChains(residues, 5)).toEqual(["A", "B"]);
  });
});

describe("interfaceResidues", () => {
  it("flags chain-A residues near chain B", () => {
    const residues = [
      res("A", 1, [0, 0, 0]),
      res("A", 2, [0, 3, 0]), // 3 Å from B:11 -> interface
      res("A", 3, [0, 50, 0]), // far -> not interface
      res("B", 11, [0, 5, 0]),
    ];
    const iface = interfaceResidues(residues, "A", 8);
    expect([...iface].sort()).toEqual([1, 2]); // res1 is 5Å from B:11, res2 is 2Å
    expect(iface.has(3)).toBe(false);
  });

  it("returns empty for a single-chain structure", () => {
    expect(interfaceResidues([res("A", 1, [0, 0, 0])], "A").size).toBe(0);
  });
});
