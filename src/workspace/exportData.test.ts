import { describe, it, expect } from "vitest";
import { perResidueCsv, entriesCsv, toCsv } from "./csv.ts";
import { summarySheet, perResidueSheet, comparisonsSheet } from "./exportData.ts";
import type { WorkspaceEntry } from "./types.ts";

function entry(p: Partial<WorkspaceEntry> = {}): WorkspaceEntry {
  return {
    id: "P04637:2OCJ:A",
    uniprot: "P04637",
    proteinName: "Cellular tumor antigen p53",
    pdbId: "2OCJ",
    chain: "A",
    query: "p53",
    source: "database",
    createdAt: 0,
    updatedAt: 1700000000000,
    favorite: false,
    notes: "",
    rmsd: 0.5061,
    tmScore: 0.99088,
    gdtTs: 0.98842,
    plddtErrorSpearman: -0.5622,
    nMatched: 194,
    warnings: [],
    perResidue: [
      { uniprotNum: 97, deviation: 0.7, plddt: 88 },
      { uniprotNum: 96, deviation: 0.337, plddt: 90 },
    ],
    ...p,
  };
}

describe("toCsv", () => {
  it("escapes commas, quotes, and newlines", () => {
    const csv = toCsv(["a", "b"], [["x,y", 'he said "hi"'], ["line\nbreak", 1]]);
    expect(csv).toBe('a,b\r\n"x,y","he said ""hi"""\r\n"line\nbreak",1');
  });
});

describe("perResidueCsv", () => {
  it("sorts by residue and rounds", () => {
    const csv = perResidueCsv(entry());
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("uniprot_residue,plddt,deviation_angstrom,lddt,exp_bfactor");
    expect(lines[1]).toBe("96,90,0.337,,");
    expect(lines[2]).toBe("97,88,0.7,,");
  });
});

describe("entriesCsv", () => {
  it("emits one row per comparison with rounded metrics", () => {
    const csv = entriesCsv([entry({ favorite: true, notes: "looks good" })]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toContain("uniprot,protein,pdb_id");
    expect(lines[1]).toContain("P04637");
    expect(lines[1]).toContain("0.506"); // rmsd rounded to 3dp
    expect(lines[1]).toContain("yes"); // favorite
    expect(lines[1]).toContain("looks good");
  });
});

describe("sheet builders", () => {
  it("summarySheet lists key metrics", () => {
    const s = summarySheet(entry());
    expect(s.name).toBe("Summary");
    expect(s.rows).toContainEqual(["RMSD (Å)", 0.506]);
    expect(s.rows).toContainEqual(["Matched residues", 194]);
  });

  it("perResidueSheet has a header then sorted rows", () => {
    const s = perResidueSheet(entry());
    expect(s.rows[0]).toEqual(["UniProt residue", "pLDDT", "Deviation (Å)"]);
    expect(s.rows[1]).toEqual([96, 90, 0.337]);
  });

  it("comparisonsSheet renders NaN Spearman as n/a", () => {
    const s = comparisonsSheet([entry({ plddtErrorSpearman: Number.NaN })]);
    expect(s.rows[1]).toContain("n/a");
  });
});
