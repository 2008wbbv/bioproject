import { describe, it, expect } from "vitest";
import { serializeWorkspace, parseWorkspace } from "./backup.ts";
import type { WorkspaceEntry } from "./types.ts";

function entry(id: string): WorkspaceEntry {
  return {
    id,
    uniprot: "P04637",
    proteinName: "p53",
    pdbId: "2OCJ",
    chain: "A",
    query: "p53",
    source: "database",
    createdAt: 1,
    updatedAt: 2,
    favorite: true,
    notes: "note",
    rmsd: 0.5,
    tmScore: 0.99,
    gdtTs: 0.98,
    plddtErrorSpearman: -0.5,
    nMatched: 194,
    warnings: ["w"],
    perResidue: [{ uniprotNum: 96, deviation: 0.3, plddt: 90 }],
  };
}

describe("serialize/parse workspace round-trip", () => {
  it("round-trips entries", () => {
    const entries = [entry("a"), entry("b")];
    const parsed = parseWorkspace(serializeWorkspace(entries));
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ id: "a", favorite: true, notes: "note", nMatched: 194 });
    expect(parsed[0].perResidue[0]).toEqual({ uniprotNum: 96, deviation: 0.3, plddt: 90 });
  });

  it("preserves NaN Spearman as NaN", () => {
    const e = { ...entry("a"), plddtErrorSpearman: Number.NaN };
    const parsed = parseWorkspace(serializeWorkspace([e]));
    expect(Number.isNaN(parsed[0].plddtErrorSpearman)).toBe(true);
  });

  it("rejects non-OpenFoldUI JSON", () => {
    expect(() => parseWorkspace('{"foo":1}')).toThrow(/OpenFoldUI/);
    expect(() => parseWorkspace("not json")).toThrow(/JSON/);
  });

  it("skips entries without an id and defaults missing fields", () => {
    const json = JSON.stringify({ app: "openfoldui-workspace", version: 1, entries: [{ pdbId: "X" }, { id: "ok" }] });
    const parsed = parseWorkspace(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ id: "ok", source: "database", favorite: false });
  });
});
