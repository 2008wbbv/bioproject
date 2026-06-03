/**
 * IndexedDB persistence via `idb` (SPEC §9). Two stores:
 *   - `comparisons`: WorkspaceEntry summaries (browsed, sheeted, exported)
 *   - `structures`:  StoredStructures (heavy raw files, lazy-loaded for the viewer)
 *
 * All access goes through this module so the rest of the app never touches idb
 * directly. The same code runs under fake-indexeddb in tests.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { StoredStructures, WorkspaceEntry } from "./types.ts";

interface WorkspaceDB extends DBSchema {
  comparisons: {
    key: string;
    value: WorkspaceEntry;
    indexes: { "by-updated": number; "by-favorite": number };
  };
  structures: {
    key: string;
    value: StoredStructures;
  };
}

const DB_NAME = "afve-workspace";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<WorkspaceDB>> | null = null;

function getDB(): Promise<IDBPDatabase<WorkspaceDB>> {
  if (!dbPromise) {
    dbPromise = openDB<WorkspaceDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const comparisons = db.createObjectStore("comparisons", { keyPath: "id" });
        comparisons.createIndex("by-updated", "updatedAt");
        // IndexedDB can't index booleans; favorite is mirrored as 0/1 at write time
        // would require a field — we instead filter in memory (small dataset).
        db.createObjectStore("structures", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

/** Reset the cached connection (tests reopen against a fresh fake-indexeddb). */
export function _resetDbForTests(): void {
  dbPromise = null;
}

export async function putEntry(entry: WorkspaceEntry): Promise<void> {
  const db = await getDB();
  await db.put("comparisons", entry);
}

export async function getEntry(id: string): Promise<WorkspaceEntry | undefined> {
  const db = await getDB();
  return db.get("comparisons", id);
}

/** All entries, most-recently-updated first. */
export async function getAllEntries(): Promise<WorkspaceEntry[]> {
  const db = await getDB();
  const all = await db.getAll("comparisons");
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDB();
  await Promise.all([db.delete("comparisons", id), db.delete("structures", id)]);
}

export async function clearAll(): Promise<void> {
  const db = await getDB();
  await Promise.all([db.clear("comparisons"), db.clear("structures")]);
}

export async function putStructures(s: StoredStructures): Promise<void> {
  const db = await getDB();
  await db.put("structures", s);
}

export async function getStructures(id: string): Promise<StoredStructures | undefined> {
  const db = await getDB();
  return db.get("structures", id);
}
