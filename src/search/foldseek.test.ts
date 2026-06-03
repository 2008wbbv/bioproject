import { describe, it, expect } from "vitest";
import { parseTargetAccession, parseTargetDescription, parseResults, normalizeStatus } from "./foldseek.ts";

describe("parseTargetAccession", () => {
  it("extracts the UniProt accession from an AlphaFold-DB target", () => {
    expect(parseTargetAccession("AF-P0CG48-F1-model_v6 Polyubiquitin-C")).toBe("P0CG48");
    expect(parseTargetAccession("AF-A0AAV8UQ62-F1-model_v6 something")).toBe("A0AAV8UQ62");
  });

  it("returns null for non-AlphaFold targets (e.g. PDB hits)", () => {
    expect(parseTargetAccession("1abc_A something")).toBeNull();
    expect(parseTargetAccession("")).toBeNull();
  });
});

describe("parseTargetDescription", () => {
  it("returns the text after the model token", () => {
    expect(parseTargetDescription("AF-P0CG48-F1-model_v6 Polyubiquitin-C")).toBe("Polyubiquitin-C");
  });
  it("returns the whole token when there is no description", () => {
    expect(parseTargetDescription("AF-P0CG48-F1-model_v6")).toBe("AF-P0CG48-F1-model_v6");
  });
});

describe("parseResults", () => {
  const json = {
    results: [
      {
        alignments: [
          [
            { target: "AF-P0CG48-F1-model_v6 Polyubiquitin-C", prob: 1, eval: 0, score: 3676, seqId: 97.1, alnLength: 533, taxName: "Homo sapiens" },
            { target: "AF-Q9XYZ1-F1-model_v6 Some protein", prob: 0.8, eval: 1e-5, score: 900, seqId: 40, alnLength: 70, taxName: "E. coli" },
          ],
        ],
      },
    ],
  };

  it("flattens the array-of-arrays and maps fields", () => {
    const hits = parseResults(json);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ accession: "P0CG48", description: "Polyubiquitin-C", prob: 1, score: 3676 });
  });

  it("sorts by probability then e-value, and applies the limit", () => {
    const hits = parseResults(json, 1);
    expect(hits).toHaveLength(1);
    expect(hits[0].accession).toBe("P0CG48"); // highest prob
  });

  it("tolerates missing fields and empty results", () => {
    expect(parseResults({})).toEqual([]);
    expect(parseResults({ results: [{ alignments: [[{}]] }] })[0].accession).toBeNull();
  });
});

describe("normalizeStatus", () => {
  it("passes through known statuses and maps the rest to UNKNOWN", () => {
    expect(normalizeStatus("RUNNING")).toBe("RUNNING");
    expect(normalizeStatus("COMPLETE")).toBe("COMPLETE");
    expect(normalizeStatus("weird")).toBe("UNKNOWN");
    expect(normalizeStatus(undefined)).toBe("UNKNOWN");
  });
});
