import { describe, it, expect } from "vitest";
import { alignByUniprot } from "./align.ts";
import type { ResidueRecord } from "./types.ts";

function rec(
  uniprotNum: number | null,
  caXyz: [number, number, number] | null,
  bFactor = 50,
): ResidueRecord {
  return { uniprotNum, authNum: uniprotNum ?? 0, chain: "A", resName: "ALA", caXyz, bFactor };
}

describe("alignByUniprot", () => {
  it("inner-joins on UniProt number, keeping only shared residues", () => {
    const af = [rec(1, [0, 0, 0]), rec(2, [1, 1, 1]), rec(3, [2, 2, 2])];
    const exp = [rec(2, [10, 10, 10]), rec(3, [20, 20, 20]), rec(4, [30, 30, 30])];
    const al = alignByUniprot(af, exp);
    expect(al.nMatched).toBe(2);
    expect([...al.uniprotNums]).toEqual([2, 3]);
    // P comes from AF, Q from experimental.
    expect([...al.p.slice(0, 3)]).toEqual([1, 1, 1]);
    expect([...al.q.slice(0, 3)]).toEqual([10, 10, 10]);
  });

  it("drops residues lacking a CA on either side", () => {
    const af = [rec(1, null), rec(2, [1, 1, 1])];
    const exp = [rec(1, [9, 9, 9]), rec(2, null)];
    const al = alignByUniprot(af, exp);
    expect(al.nMatched).toBe(0);
  });

  it("drops residues with null UniProt number", () => {
    const af = [rec(null, [0, 0, 0]), rec(5, [1, 1, 1])];
    const exp = [rec(null, [9, 9, 9]), rec(5, [2, 2, 2])];
    const al = alignByUniprot(af, exp);
    expect(al.nMatched).toBe(1);
    expect([...al.uniprotNums]).toEqual([5]);
  });

  it("carries the AlphaFold pLDDT (B-factor) onto the matched residue", () => {
    const af = [rec(1, [0, 0, 0], 97.5)];
    const exp = [rec(1, [9, 9, 9], 25.0)]; // experimental B-factor must NOT leak in
    const al = alignByUniprot(af, exp);
    expect([...al.plddt]).toEqual([97.5]);
  });

  it("returns coordinates sorted ascending by UniProt number", () => {
    const af = [rec(10, [0, 0, 0]), rec(2, [1, 1, 1]), rec(7, [2, 2, 2])];
    const exp = [rec(7, [70, 0, 0]), rec(2, [20, 0, 0]), rec(10, [100, 0, 0])];
    const al = alignByUniprot(af, exp);
    expect([...al.uniprotNums]).toEqual([2, 7, 10]);
    expect([...al.q.slice(0, 3)]).toEqual([20, 0, 0]);
    expect([...al.q.slice(3, 6)]).toEqual([70, 0, 0]);
    expect([...al.q.slice(6, 9)]).toEqual([100, 0, 0]);
  });
});
