/**
 * Back up / share a workspace as JSON (the comparison records: metrics, notes,
 * favorites, per-residue data). Raw structures aren't included — imported entries
 * show metrics/charts/sheet/export immediately; the 3D viewer + TM-align validation
 * become available again after a re-run. Pure (serialize/parse) + testable.
 */
import type { ComparisonSource, WorkspaceEntry } from "./types.ts";

const MAGIC = "openfoldui-workspace";
const FORMAT_VERSION = 1;

export function serializeWorkspace(entries: WorkspaceEntry[]): string {
  return JSON.stringify({ app: MAGIC, version: FORMAT_VERSION, exportedAt: Date.now(), entries }, null, 2);
}

function asNum(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function asStr(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/** Parse + validate a backup file into entries. Throws on a non-OpenFoldUI file. */
export function parseWorkspace(text: string): WorkspaceEntry[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Not valid JSON.");
  }
  const obj = data as { app?: string; entries?: unknown[] };
  if (obj.app !== MAGIC || !Array.isArray(obj.entries)) {
    throw new Error("Not an OpenFoldUI workspace file.");
  }
  const out: WorkspaceEntry[] = [];
  for (const raw of obj.entries) {
    const e = raw as Record<string, unknown>;
    if (typeof e.id !== "string") continue;
    const now = Date.now();
    out.push({
      id: e.id,
      uniprot: asStr(e.uniprot, "(uploaded)"),
      proteinName: asStr(e.proteinName, e.id),
      pdbId: asStr(e.pdbId),
      chain: asStr(e.chain, "A"),
      query: asStr(e.query),
      source: (e.source === "upload" ? "upload" : "database") as ComparisonSource,
      createdAt: asNum(e.createdAt, now),
      updatedAt: asNum(e.updatedAt, now),
      favorite: e.favorite === true,
      notes: asStr(e.notes),
      rmsd: asNum(e.rmsd),
      tmScore: asNum(e.tmScore),
      gdtTs: asNum(e.gdtTs),
      plddtErrorSpearman: typeof e.plddtErrorSpearman === "number" ? e.plddtErrorSpearman : Number.NaN,
      nMatched: asNum(e.nMatched),
      warnings: Array.isArray(e.warnings) ? e.warnings.filter((w): w is string => typeof w === "string") : [],
      perResidue: Array.isArray(e.perResidue)
        ? (e.perResidue as Record<string, unknown>[]).map((p) => ({
            uniprotNum: asNum(p.uniprotNum),
            deviation: asNum(p.deviation),
            plddt: asNum(p.plddt),
          }))
        : [],
      provenance:
        e.provenance && typeof e.provenance === "object"
          ? {
              appVersion: asStr((e.provenance as Record<string, unknown>).appVersion),
              modelSource: asStr((e.provenance as Record<string, unknown>).modelSource),
              refSource: asStr((e.provenance as Record<string, unknown>).refSource),
            }
          : undefined,
    });
  }
  return out;
}
