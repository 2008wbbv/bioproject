/**
 * React state for the workspace: loads saved comparisons from IndexedDB and exposes
 * save / favorite / notes / delete / clear operations, keeping an in-memory mirror
 * sorted most-recent-first. The dashboard and the compare view both read from here.
 */
import { useCallback, useEffect, useState } from "react";
import type { PipelineResult } from "../api/pipeline.ts";
import type { StoredStructures, WorkspaceEntry } from "./types.ts";
import * as db from "./db.ts";

export function entryId(uniprot: string, pdbId: string, chain: string): string {
  return `${uniprot}:${pdbId}:${chain}`;
}

/** Build a fresh entry from a pipeline result (annotations default empty). */
export function entryFromResult(query: string, data: PipelineResult): WorkspaceEntry {
  const r = data.result;
  const now = Date.now();
  return {
    id: entryId(r.uniprot, r.pdbId, data.chosenChain),
    uniprot: r.uniprot,
    proteinName: data.proteinName,
    pdbId: r.pdbId,
    chain: data.chosenChain,
    query,
    createdAt: now,
    updatedAt: now,
    favorite: false,
    notes: "",
    rmsd: r.rmsd,
    tmScore: r.tmScore,
    gdtTs: r.gdtTs,
    plddtErrorSpearman: r.plddtErrorSpearman,
    nMatched: r.nMatched,
    warnings: r.warnings,
    perResidue: r.perResidue,
  };
}

export interface Workspace {
  entries: WorkspaceEntry[];
  ready: boolean;
  saveResult: (query: string, data: PipelineResult) => Promise<WorkspaceEntry>;
  toggleFavorite: (id: string) => Promise<void>;
  setNotes: (id: string, notes: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  loadStructures: (id: string) => Promise<StoredStructures | undefined>;
}

export function useWorkspace(): Workspace {
  const [entries, setEntries] = useState<WorkspaceEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    db.getAllEntries().then((all) => {
      if (!cancelled) {
        setEntries(all);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const upsertLocal = useCallback((entry: WorkspaceEntry) => {
    setEntries((prev) => {
      const without = prev.filter((e) => e.id !== entry.id);
      return [entry, ...without].sort((a, b) => b.updatedAt - a.updatedAt);
    });
  }, []);

  const saveResult = useCallback(
    async (query: string, data: PipelineResult) => {
      const fresh = entryFromResult(query, data);
      // Preserve favorite/notes/createdAt if this comparison was saved before.
      const existing = await db.getEntry(fresh.id);
      const entry: WorkspaceEntry = existing
        ? { ...fresh, favorite: existing.favorite, notes: existing.notes, createdAt: existing.createdAt }
        : fresh;
      await db.putEntry(entry);
      await db.putStructures({
        id: entry.id,
        afPdbText: data.afPdbText,
        expCifText: data.expCifText,
        superposition: data.superposition,
      });
      upsertLocal(entry);
      return entry;
    },
    [upsertLocal],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const e = await db.getEntry(id);
      if (!e) return;
      const updated = { ...e, favorite: !e.favorite, updatedAt: e.updatedAt };
      await db.putEntry(updated);
      upsertLocal(updated);
    },
    [upsertLocal],
  );

  const setNotes = useCallback(
    async (id: string, notes: string) => {
      const e = await db.getEntry(id);
      if (!e) return;
      const updated = { ...e, notes };
      await db.putEntry(updated);
      upsertLocal(updated);
    },
    [upsertLocal],
  );

  const remove = useCallback(async (id: string) => {
    await db.deleteEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clear = useCallback(async () => {
    await db.clearAll();
    setEntries([]);
  }, []);

  const loadStructures = useCallback((id: string) => db.getStructures(id), []);

  return { entries, ready, saveResult, toggleFavorite, setNotes, remove, clear, loadStructures };
}
