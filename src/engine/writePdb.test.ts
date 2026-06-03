import { describe, it, expect } from "vitest";
import { caPdbFromResidues } from "./writePdb.ts";
import type { ResidueRecord } from "./types.ts";

function res(chain: string, authNum: number, caXyz: [number, number, number] | null): ResidueRecord {
  return { uniprotNum: authNum, authNum, chain, resName: "ALA", caXyz, bFactor: 50 };
}

describe("caPdbFromResidues", () => {
  it("emits one ATOM CA line per residue with a CA, plus TER/END", () => {
    const pdb = caPdbFromResidues([res("A", 10, [1, 2, 3]), res("A", 11, [4, 5, 6])]);
    const lines = pdb.trim().split("\n");
    expect(lines.filter((l) => l.startsWith("ATOM"))).toHaveLength(2);
    expect(lines.at(-2)).toBe("TER");
    expect(lines.at(-1)).toBe("END");
  });

  it("places coordinates in the correct fixed columns", () => {
    const line = caPdbFromResidues([res("A", 10, [12.345, -6.789, 0.5])]).split("\n")[0];
    expect(line.slice(12, 16).trim()).toBe("CA");
    expect(Number.parseFloat(line.slice(30, 38))).toBeCloseTo(12.345, 3);
    expect(Number.parseFloat(line.slice(38, 46))).toBeCloseTo(-6.789, 3);
    expect(Number.parseInt(line.slice(22, 26), 10)).toBe(10);
  });

  it("skips residues without a CA", () => {
    const pdb = caPdbFromResidues([res("A", 1, null), res("A", 2, [0, 0, 0])]);
    expect(pdb.split("\n").filter((l) => l.startsWith("ATOM"))).toHaveLength(1);
  });

  it("filters to a single chain when requested", () => {
    const pdb = caPdbFromResidues([res("A", 1, [0, 0, 0]), res("B", 1, [9, 9, 9])], "B");
    const atoms = pdb.split("\n").filter((l) => l.startsWith("ATOM"));
    expect(atoms).toHaveLength(1);
    expect(atoms[0][21]).toBe("B");
  });
});
