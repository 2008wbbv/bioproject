import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import * as db from "./db.ts";
import type { StoredStructures, WorkspaceEntry } from "./types.ts";

function entry(id: string, updatedAt: number, fav = false): WorkspaceEntry {
  return {
    id,
    uniprot: id.split(":")[0],
    proteinName: "Test",
    pdbId: id.split(":")[1],
    chain: "A",
    query: "q",
    source: "database",
    createdAt: updatedAt,
    updatedAt,
    favorite: fav,
    notes: "",
    rmsd: 1,
    tmScore: 0.9,
    gdtTs: 0.8,
    plddtErrorSpearman: -0.5,
    nMatched: 100,
    warnings: [],
    perResidue: [{ uniprotNum: 1, deviation: 0.5, plddt: 90 }],
  };
}

describe("workspace db (IndexedDB via fake-indexeddb)", () => {
  beforeEach(() => {
    // Fresh database for each test.
    globalThis.indexedDB = new IDBFactory();
    db._resetDbForTests();
  });

  it("puts and gets an entry", async () => {
    await db.putEntry(entry("P1:1ABC:A", 100));
    const got = await db.getEntry("P1:1ABC:A");
    expect(got?.uniprot).toBe("P1");
  });

  it("returns all entries sorted most-recent-first", async () => {
    await db.putEntry(entry("A:1:A", 100));
    await db.putEntry(entry("B:2:A", 300));
    await db.putEntry(entry("C:3:A", 200));
    const all = await db.getAllEntries();
    expect(all.map((e) => e.id)).toEqual(["B:2:A", "C:3:A", "A:1:A"]);
  });

  it("upserts on the same id rather than duplicating", async () => {
    await db.putEntry(entry("A:1:A", 100));
    await db.putEntry({ ...entry("A:1:A", 500), notes: "edited" });
    const all = await db.getAllEntries();
    expect(all).toHaveLength(1);
    expect(all[0].notes).toBe("edited");
  });

  it("deletes an entry and its structures together", async () => {
    await db.putEntry(entry("A:1:A", 100));
    const s: StoredStructures = {
      id: "A:1:A",
      modelText: "AF",
      modelFormat: "pdb",
      refText: "CIF",
      refFormat: "cif",
      superposition: { rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], centroidP: [0, 0, 0], centroidQ: [0, 0, 0] },
    };
    await db.putStructures(s);
    await db.deleteEntry("A:1:A");
    expect(await db.getEntry("A:1:A")).toBeUndefined();
    expect(await db.getStructures("A:1:A")).toBeUndefined();
  });

  it("stores and retrieves heavy structures separately", async () => {
    await db.putStructures({
      id: "A:1:A",
      modelText: "ATOM ...",
      modelFormat: "pdb",
      refText: "data_...",
      refFormat: "cif",
      superposition: { rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], centroidP: [0, 0, 0], centroidQ: [0, 0, 0] },
    });
    const got = await db.getStructures("A:1:A");
    expect(got?.modelText).toBe("ATOM ...");
  });

  it("clears everything", async () => {
    await db.putEntry(entry("A:1:A", 100));
    await db.clearAll();
    expect(await db.getAllEntries()).toHaveLength(0);
  });
});
