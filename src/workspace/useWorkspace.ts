/**
 * React state for the workspace: loads saved comparisons from IndexedDB and exposes
 * save / favorite / notes / delete / clear operations, keeping an in-memory mirror
 * sorted most-recent-first. The dashboard and the compare view both read from here.
 */
import { useCallback, useEffect, useState } from "react";
import type { PipelineResult } from "../api/pipeline.ts";
import { normalizeStored, type StoredStructures, type WorkspaceEntry } from "./types.ts";
import { APP_VERSION } from "../version.ts";
import * as db from "./db.ts";

export function entryId(uniprot: string, pdbId: string, chain: string, source: string): string {
  const base = `${uniprot}:${pdbId}:${chain}`;
  return source === "upload" ? `custom:${base}` : base;
}

/** Build a fresh entry from a pipeline result (annotations default empty). */
export function entryFromResult(query: string, data: PipelineResult): WorkspaceEntry {
  const r = data.result;
  const now = Date.now();
  return {
    id: entryId(r.uniprot, r.pdbId, data.chosenChain, data.source),
    uniprot: r.uniprot,
    proteinName: data.proteinName,
    pdbId: r.pdbId,
    chain: data.chosenChain,
    query,
    source: data.source,
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
    provenance: {
      appVersion: APP_VERSION,
      modelSource: data.modelSource,
      refSource: data.refSource,
    },
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
  importEntries: (entries: WorkspaceEntry[]) => Promise<number>;
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
        modelText: data.modelText,
        modelFormat: data.modelFormat,
        refText: data.refText,
        refFormat: data.refFormat,
        modelCaPdb: data.modelCaPdb,
        refCaPdb: data.refCaPdb,
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

  const importEntries = useCallback(async (incoming: WorkspaceEntry[]) => {
    await db.putEntries(incoming);
    const all = await db.getAllEntries();
    setEntries(all);
    return incoming.length;
  }, []);

  const loadStructures = useCallback(async (id: string) => {
    const s = await db.getStructures(id);
    return s ? normalizeStored(s) : undefined;
  }, []);

  return { entries, ready, saveResult, toggleFavorite, setNotes, remove, clear, importEntries, loadStructures };
}
