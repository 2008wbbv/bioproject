import { describe, it, expect } from "vitest";
import {
  applySifts,
  assignUniprotFromAuth,
  extractSiftsSegments,
  segmentsFromBestStructure,
  type SiftsSegment,
} from "./sifts.ts";
import type { ResidueRecord } from "./types.ts";

function res(authNum: number, chain = "A"): ResidueRecord {
  return {
    uniprotNum: null,
    authNum,
    chain,
    resName: "ALA",
    caXyz: [0, 0, 0],
    bFactor: 0,
  };
}

describe("applySifts", () => {
  it("maps author numbering to UniProt via a constant offset", () => {
    // Author 94..96 maps to UniProt 94..96 (offset 0).
    const seg: SiftsSegment = { chain: "A", authStart: 94, authEnd: 96, unpStart: 94, unpEnd: 96 };
    const residues = [res(94), res(95), res(96)];
    const { assigned, unmapped } = applySifts(residues, [seg]);
    expect(assigned).toBe(3);
    expect(unmapped).toBe(0);
    expect(residues.map((r) => r.uniprotNum)).toEqual([94, 95, 96]);
  });

  it("applies a nonzero offset", () => {
    // Author 1..3 maps to UniProt 25..27 (offset +24).
    const seg: SiftsSegment = { chain: "A", authStart: 1, authEnd: 3, unpStart: 25, unpEnd: 27 };
    const residues = [res(1), res(2), res(3)];
    applySifts(residues, [seg]);
    expect(residues.map((r) => r.uniprotNum)).toEqual([25, 26, 27]);
  });

  it("leaves residues outside any segment unmapped (null)", () => {
    const seg: SiftsSegment = { chain: "A", authStart: 10, authEnd: 20, unpStart: 10, unpEnd: 20 };
    const residues = [res(9), res(15), res(21)];
    const { assigned, unmapped } = applySifts(residues, [seg]);
    expect(assigned).toBe(1);
    expect(unmapped).toBe(2);
    expect(residues[0].uniprotNum).toBeNull();
    expect(residues[1].uniprotNum).toBe(15);
    expect(residues[2].uniprotNum).toBeNull();
  });

  it("matches segments by chain", () => {
    const seg: SiftsSegment = { chain: "B", authStart: 1, authEnd: 5, unpStart: 1, unpEnd: 5 };
    const residues = [res(3, "A"), res(3, "B")];
    applySifts(residues, [seg]);
    expect(residues[0].uniprotNum).toBeNull(); // chain A not covered
    expect(residues[1].uniprotNum).toBe(3); // chain B covered
  });
});

describe("assignUniprotFromAuth (AlphaFold)", () => {
  it("sets uniprotNum equal to the author number", () => {
    const residues = [res(1), res(2), res(3)];
    assignUniprotFromAuth(residues);
    expect(residues.map((r) => r.uniprotNum)).toEqual([1, 2, 3]);
  });
});

describe("extractSiftsSegments (PDBe /mappings shape)", () => {
  it("parses a fully-populated segment", () => {
    const json = {
      "2xyz": {
        UniProt: {
          P12345: {
            mappings: [
              {
                chain_id: "A",
                unp_start: 94,
                unp_end: 312,
                start: { author_residue_number: 94, author_insertion_code: "", residue_number: 1 },
                end: { author_residue_number: 312, author_insertion_code: "", residue_number: 219 },
              },
            ],
          },
        },
      },
    };
    const segs = extractSiftsSegments(json, "2XYZ");
    expect(segs).toEqual([{ chain: "A", authStart: 94, authEnd: 312, unpStart: 94, unpEnd: 312 }]);
  });

  it("recovers a null author end from the residue_number span (real PDBe case)", () => {
    // Mirrors the observed 1tup/2ocj response: authStart present, authEnd null.
    const json = {
      "2ocj": {
        UniProt: {
          P04637: {
            mappings: [
              {
                chain_id: "A",
                unp_start: 94,
                unp_end: 312,
                start: { author_residue_number: 94, residue_number: 1 },
                end: { author_residue_number: null, residue_number: 219 },
              },
            ],
          },
        },
      },
    };
    const segs = extractSiftsSegments(json, "2ocj");
    // span = 219 - 1 = 218 -> authEnd = 94 + 218 = 312.
    expect(segs).toEqual([{ chain: "A", authStart: 94, authEnd: 312, unpStart: 94, unpEnd: 312 }]);
  });

  it("recovers a null author start from the populated end", () => {
    const json = {
      abcd: {
        UniProt: {
          Q00001: {
            mappings: [
              {
                chain_id: "B",
                unp_start: 50,
                unp_end: 60,
                start: { author_residue_number: null, residue_number: 1 },
                end: { author_residue_number: 60, residue_number: 11 },
              },
            ],
          },
        },
      },
    };
    const segs = extractSiftsSegments(json, "abcd");
    // span = 10 -> authStart = 60 - 10 = 50.
    expect(segs).toEqual([{ chain: "B", authStart: 50, authEnd: 60, unpStart: 50, unpEnd: 60 }]);
  });

  it("skips a segment where both author ends are null (needs best_structures fallback)", () => {
    const json = {
      abcd: {
        UniProt: {
          Q00001: {
            mappings: [
              {
                chain_id: "A",
                unp_start: 1,
                unp_end: 10,
                start: { author_residue_number: null, residue_number: 1 },
                end: { author_residue_number: null, residue_number: 10 },
              },
            ],
          },
        },
      },
    };
    expect(extractSiftsSegments(json, "abcd")).toEqual([]);
  });

  it("returns empty for an unrelated/missing pdb id", () => {
    expect(extractSiftsSegments({}, "9zzz")).toEqual([]);
  });
});

describe("segmentsFromBestStructure (fallback)", () => {
  it("builds one segment from a best_structures hit", () => {
    const segs = segmentsFromBestStructure({
      pdb_id: "9r2q",
      chain_id: "K",
      unp_start: 1,
      unp_end: 393,
      start: 25,
      end: 417,
    });
    expect(segs).toEqual([{ chain: "K", authStart: 25, authEnd: 417, unpStart: 1, unpEnd: 393 }]);
  });

  it("the built segment applied to a residue gives the right UniProt number", () => {
    const segs = segmentsFromBestStructure({
      pdb_id: "9r2q",
      chain_id: "K",
      unp_start: 1,
      unp_end: 393,
      start: 25,
      end: 417,
    });
    const r = res(25, "K");
    applySifts([r], segs);
    expect(r.uniprotNum).toBe(1); // author 25 -> UniProt 1
  });
});
