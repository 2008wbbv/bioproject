import { describe, it, expect } from "vitest";
import { needlemanWunsch, threeToOne, assignBySequenceAlignment } from "./seqalign.ts";
import type { ResidueRecord } from "./types.ts";

function res(resName: string, authNum: number): ResidueRecord {
  return { uniprotNum: null, authNum, chain: "A", resName, caXyz: [0, 0, 0], bFactor: 50 };
}
const seq = (s: string) => [...s].map((c, i) => res(ONE_TO_THREE[c], i + 1));
const ONE_TO_THREE: Record<string, string> = { A: "ALA", C: "CYS", D: "ASP", E: "GLU", G: "GLY", K: "LYS", W: "TRP" };

describe("threeToOne", () => {
  it("maps standard and modified residues, X for unknown", () => {
    expect(threeToOne("ALA")).toBe("A");
    expect(threeToOne("MSE")).toBe("M"); // selenomethionine
    expect(threeToOne("XYZ")).toBe("X");
  });
});

describe("needlemanWunsch", () => {
  it("aligns identical sequences with all matches", () => {
    const pairs = needlemanWunsch("ACGK", "ACGK");
    expect(pairs).toEqual([[0, 0], [1, 1], [2, 2], [3, 3]]);
  });

  it("inserts a gap for an insertion in the second sequence", () => {
    // a = ACK, b = ACGK -> a has a gap where G is.
    const pairs = needlemanWunsch("ACK", "ACGK");
    expect(pairs).toContainEqual([null, 2]); // G in b unmatched
    expect(pairs.filter(([i, j]) => i !== null && j !== null)).toHaveLength(3);
  });
});

describe("assignBySequenceAlignment", () => {
  it("gives matched residues shared synthetic numbers regardless of input numbering", () => {
    // Same sequence, totally different authNum schemes.
    const model = seq("ACGK");
    const ref = seq("ACGK");
    ref.forEach((r, i) => (r.authNum = 500 + i)); // different numbering
    const matched = assignBySequenceAlignment(model, ref);
    expect(matched).toBe(4);
    expect(model.map((r) => r.uniprotNum)).toEqual([1, 2, 3, 4]);
    expect(ref.map((r) => r.uniprotNum)).toEqual([1, 2, 3, 4]);
  });

  it("leaves an inserted residue unmatched (null)", () => {
    const model = seq("ACK");
    const ref = seq("ACGK");
    const matched = assignBySequenceAlignment(model, ref);
    expect(matched).toBe(3);
    expect(ref.find((r) => r.resName === "GLY")!.uniprotNum).toBeNull();
  });
});
