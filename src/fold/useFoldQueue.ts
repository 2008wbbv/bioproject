/**
 * A real, persistent folding queue. Jobs live in IndexedDB and are processed with
 * bounded concurrency; the loop auto-resumes any queued jobs on load (so it survives
 * reloads). Supports retry, remove, and clear.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import * as db from "./foldDb.ts";
import type { FoldJob } from "./foldDb.ts";
import { foldWith, loadFoldConfig, type BackendId } from "./backends.ts";
import { meanPlddt, FoldError } from "./esmfold.ts";
import type { SeqRecord } from "./parseFasta.ts";

const CONCURRENCY = 2;

export interface FoldQueue {
  jobs: FoldJob[];
  running: number;
  enqueue: (records: SeqRecord[], backend: BackendId) => Promise<void>;
  retry: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
}

export function useFoldQueue(): FoldQueue {
  const [jobs, setJobs] = useState<FoldJob[]>([]);
  const [running, setRunning] = useState(0);
  const activeIds = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => setJobs(await db.allJobs()), []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Pump: whenever jobs change and capacity is free, start queued jobs.
  useEffect(() => {
    const queued = jobs.filter((j) => j.status === "queued" && !activeIds.current.has(j.id));
    const free = CONCURRENCY - activeIds.current.size;
    if (free <= 0 || queued.length === 0) return;

    const config = loadFoldConfig();
    for (const job of queued.slice(0, free)) {
      activeIds.current.add(job.id);
      setRunning(activeIds.current.size);
      void (async () => {
        await db.putJob({ ...job, status: "folding" });
        await refresh();
        try {
          const pdb = await foldWith(job.seq, job.backend, config);
          await db.putJob({ ...job, status: "done", pdb, plddt: meanPlddt(pdb) });
        } catch (e) {
          const msg = e instanceof FoldError ? e.message : (e as Error).message;
          await db.putJob({ ...job, status: "error", error: msg });
        } finally {
          activeIds.current.delete(job.id);
          setRunning(activeIds.current.size);
          await refresh();
        }
      })();
    }
  }, [jobs, refresh]);

  const enqueue = useCallback(
    async (records: SeqRecord[], backend: BackendId) => {
      const now = Date.now();
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        await db.putJob({
          id: `${now}-${i}-${Math.random().toString(36).slice(2, 7)}`,
          name: r.name,
          seq: r.seq,
          backend,
          status: "queued",
          createdAt: now - i, // preserve order
        });
      }
      await refresh();
    },
    [refresh],
  );

  const retry = useCallback(
    async (id: string) => {
      const job = (await db.allJobs()).find((j) => j.id === id);
      if (job) {
        await db.putJob({ ...job, status: "queued", error: undefined, pdb: undefined, plddt: undefined });
        await refresh();
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await db.deleteJob(id);
      await refresh();
    },
    [refresh],
  );

  const clear = useCallback(async () => {
    await db.clearJobs();
    await refresh();
  }, [refresh]);

  return { jobs, running, enqueue, retry, remove, clear };
}
