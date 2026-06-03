import { describe, it, expect } from "vitest";
import { looksLikeAccession, extractUniprotHits, rankUniprotHits } from "./uniprot.ts";

describe("looksLikeAccession", () => {
  it("accepts valid UniProt accessions (6- and 10-char forms)", () => {
    for (const acc of ["P04637", "Q29537", "O95786", "A0A024R1R8", "P0CG48"]) {
      expect(looksLikeAccession(acc)).toBe(true);
    }
  });

  it("rejects names, gene symbols, and PDB ids", () => {
    for (const q of ["p53", "hemoglobin", "TP53", "1TUP", "BRCA1", ""]) {
      expect(looksLikeAccession(q)).toBe(false);
    }
  });

  it("is case-insensitive and trims", () => {
    expect(looksLikeAccession("  p04637 ")).toBe(true);
  });
});

describe("extractUniprotHits", () => {
  it("pulls accession, name, organism, reviewed, length from the nested JSON", () => {
    const json = {
      results: [
        {
          primaryAccession: "P04637",
          uniProtkbId: "P53_HUMAN",
          entryType: "UniProtKB reviewed (Swiss-Prot)",
          sequence: { length: 393 },
          organism: { scientificName: "Homo sapiens" },
          proteinDescription: { recommendedName: { fullName: { value: "Cellular tumor antigen p53" } } },
        },
      ],
    };
    expect(extractUniprotHits(json)).toEqual([
      {
        accession: "P04637",
        entryId: "P53_HUMAN",
        proteinName: "Cellular tumor antigen p53",
        organism: "Homo sapiens",
        reviewed: true,
        length: 393,
      },
    ]);
  });

  it("falls back to submission names and tolerates missing fields", () => {
    const json = {
      results: [
        {
          primaryAccession: "X1",
          entryType: "UniProtKB unreviewed (TrEMBL)",
          proteinDescription: { submissionNames: [{ fullName: { value: "Putative kinase" } }] },
        },
      ],
    };
    const hits = extractUniprotHits(json);
    expect(hits[0]).toMatchObject({ accession: "X1", proteinName: "Putative kinase", reviewed: false, length: 0 });
  });
});

describe("rankUniprotHits", () => {
  it("puts reviewed (Swiss-Prot) hits first, then longer sequences", () => {
    const hits = [
      { accession: "A", entryId: "A", proteinName: "", organism: "", reviewed: false, length: 500 },
      { accession: "B", entryId: "B", proteinName: "", organism: "", reviewed: true, length: 100 },
      { accession: "C", entryId: "C", proteinName: "", organism: "", reviewed: true, length: 300 },
    ];
    expect(rankUniprotHits(hits).map((h) => h.accession)).toEqual(["C", "B", "A"]);
  });
});
