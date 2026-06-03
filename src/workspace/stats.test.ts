import { describe, it, expect } from "vitest";
import { workspaceStats, allTags } from "./stats.ts";
import type { WorkspaceEntry } from "./types.ts";

function entry(p: Partial<WorkspaceEntry>): WorkspaceEntry {
  return {
    id: Math.random().toString(),
    uniprot: "P1",
    proteinName: "x",
    pdbId: "1ABC",
    chain: "A",
    query: "q",
    source: "database",
    createdAt: 0,
    updatedAt: 0,
    favorite: false,
    notes: "",
    rmsd: 1,
    tmScore: 0.9,
    gdtTs: 0.8,
    plddtErrorSpearman: -0.5,
    nMatched: 100,
    warnings: [],
    perResidue: [],
    ...p,
  };
}

describe("workspaceStats", () => {
  it("aggregates counts, means, median, and best/worst by TM-score", () => {
    const entries = [
      entry({ id: "a", tmScore: 0.9, rmsd: 1, favorite: true }),
      entry({ id: "b", tmScore: 0.3, rmsd: 5, source: "upload" }),
      entry({ id: "c", tmScore: 0.6, rmsd: 2 }),
    ];
    const s = workspaceStats(entries);
    expect(s.count).toBe(3);
    expect(s.favorites).toBe(1);
    expect(s.uploads).toBe(1);
    expect(s.medianTm).toBeCloseTo(0.6, 6);
    expect(s.meanRmsd).toBeCloseTo(8 / 3, 6);
    expect(s.fractionGoodFold).toBeCloseTo(2 / 3, 6); // 0.9 and 0.6 are >= 0.5
    expect(s.best?.id).toBe("a");
    expect(s.worst?.id).toBe("b");
  });

  it("ignores NaN Spearman in the mean", () => {
    const s = workspaceStats([entry({ plddtErrorSpearman: -0.4 }), entry({ plddtErrorSpearman: Number.NaN })]);
    expect(s.meanSpearman).toBeCloseTo(-0.4, 6);
  });

  it("handles an empty workspace", () => {
    const s = workspaceStats([]);
    expect(s).toMatchObject({ count: 0, meanTm: 0, best: null, worst: null });
  });
});

describe("allTags", () => {
  it("collects distinct tags with counts, sorted", () => {
    const entries = [
      entry({ tags: ["kinase", "paper"] }),
      entry({ tags: ["kinase"] }),
      entry({ tags: [] }),
    ];
    expect(allTags(entries)).toEqual([
      { tag: "kinase", count: 2 },
      { tag: "paper", count: 1 },
    ]);
  });
});
