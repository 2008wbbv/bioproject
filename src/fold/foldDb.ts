/**
 * Persistent storage for folding jobs (IndexedDB via idb) so the queue survives
 * navigation and reloads, and folded structures aren't lost.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { BackendId } from "./backends.ts";

export type FoldStatus = "queued" | "folding" | "done" | "error";

export interface FoldJob {
  id: string;
  name: string;
  seq: string;
  backend: BackendId;
  status: FoldStatus;
  createdAt: number;
  pdb?: string;
  plddt?: number;
  error?: string;
}

interface FoldDB extends DBSchema {
  jobs: { key: string; value: FoldJob };
}

let dbPromise: Promise<IDBPDatabase<FoldDB>> | null = null;
function getDB(): Promise<IDBPDatabase<FoldDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FoldDB>("openfoldui-fold", 1, {
      upgrade(db) {
        db.createObjectStore("jobs", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export async function putJob(job: FoldJob): Promise<void> {
  (await getDB()).put("jobs", job);
}
export async function allJobs(): Promise<FoldJob[]> {
  const all = await (await getDB()).getAll("jobs");
  return all.sort((a, b) => b.createdAt - a.createdAt);
}
export async function deleteJob(id: string): Promise<void> {
  (await getDB()).delete("jobs", id);
}
export async function clearJobs(): Promise<void> {
  (await getDB()).clear("jobs");
}
