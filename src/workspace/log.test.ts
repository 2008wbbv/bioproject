import { describe, it, expect } from "vitest";
import { replicationLog, methodsText } from "./log.ts";
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
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    favorite: false,
    notes: "",
    rmsd: 0.506,
    tmScore: 0.9909,
    gdtTs: 0.9884,
    plddtErrorSpearman: -0.5622,
    nMatched: 194,
    warnings: ["holo"],
    perResidue: [],
    provenance: { appVersion: "0.1.0", modelSource: "AlphaFold DB: http://x/AF.pdb", refSource: "PDBe: 2OCJ" },
    ...p,
  };
}

describe("replicationLog", () => {
  it("captures provenance, metrics, and a methods paragraph", () => {
    const log = replicationLog(entry());
    expect(log.app).toBe("OpenFoldUI");
    expect(log.comparison.modelSource).toContain("AlphaFold DB");
    expect(log.comparison.uniprot).toBe("P04637");
    expect(log.metrics.rmsd).toBe(0.506);
    expect(log.metrics.nMatched).toBe(194);
    expect(log.methods).toContain("RMSD 0.51");
    expect(log.methods).toContain("TM-score 0.991");
  });

  it("renders NaN Spearman as null in metrics and n/a in methods", () => {
    const log = replicationLog(entry({ plddtErrorSpearman: Number.NaN }));
    expect(log.metrics.plddtErrorSpearman).toBeNull();
    expect(log.methods).toContain("ρ = n/a");
  });

  it("methodsText falls back gracefully when provenance is missing", () => {
    const t = methodsText(entry({ provenance: undefined }));
    expect(t).toContain("OpenFoldUI");
    expect(t).toContain("Cellular tumor antigen p53");
  });
});
