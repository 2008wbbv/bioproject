/**
 * Trigger downloads of workspace data as .xlsx or .csv (SPEC §10). The data shaping
 * is pure (exportData.ts / csv.ts); this module only turns it into a file the
 * browser saves.
 */
import { buildXlsx } from "./xlsx.ts";
import { summarySheet, perResidueSheet, comparisonsSheet } from "./exportData.ts";
import { perResidueCsv, entriesCsv } from "./csv.ts";
import { serializeWorkspace } from "./backup.ts";
import { replicationLog } from "./log.ts";
import { zipStore } from "../zip.ts";
import type { WorkspaceEntry } from "./types.ts";

function download(filename: string, data: string | Uint8Array, mime: string): void {
  // Cast: Uint8Array is a valid BlobPart at runtime; the lib type is over-strict
  // about ArrayBufferLike possibly being a SharedArrayBuffer.
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the click has had a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (e: WorkspaceEntry): string => `${e.uniprot}_${e.pdbId}_${e.chain}`;

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** One comparison → .xlsx with a Summary sheet and a Per-residue sheet. */
export function exportEntryXlsx(entry: WorkspaceEntry): void {
  const bytes = buildXlsx([summarySheet(entry), perResidueSheet(entry)]);
  download(`${slug(entry)}.xlsx`, bytes, XLSX_MIME);
}

/** One comparison → per-residue .csv. */
export function exportEntryCsv(entry: WorkspaceEntry): void {
  download(`${slug(entry)}_per-residue.csv`, perResidueCsv(entry), "text/csv;charset=utf-8");
}

/** Many comparisons → .xlsx with one Comparisons sheet. */
export function exportEntriesXlsx(entries: WorkspaceEntry[], name = "comparisons"): void {
  download(`${name}.xlsx`, buildXlsx([comparisonsSheet(entries)]), XLSX_MIME);
}

/** Many comparisons → summary .csv. */
export function exportEntriesCsv(entries: WorkspaceEntry[], name = "comparisons"): void {
  download(`${name}.csv`, entriesCsv(entries), "text/csv;charset=utf-8");
}

/** Full workspace → portable JSON backup (re-importable). */
export function downloadWorkspaceBackup(entries: WorkspaceEntry[]): void {
  const date = new Date().toISOString().slice(0, 10);
  download(`openfoldui-workspace-${date}.json`, serializeWorkspace(entries), "application/json");
}

/** One comparison → replication log (provenance + metrics + methods text). */
export function exportEntryLog(entry: WorkspaceEntry): void {
  download(`${slug(entry)}_log.json`, JSON.stringify(replicationLog(entry), null, 2), "application/json");
}

/** Many comparisons → an array of replication logs. */
export function exportEntriesLogs(entries: WorkspaceEntry[], name = "logs"): void {
  const logs = entries.map(replicationLog);
  download(`openfoldui-${name}.json`, JSON.stringify({ app: "OpenFoldUI", logs }, null, 2), "application/json");
}

/**
 * Export EVERYTHING as a single .zip: the JSON backup, an Excel workbook, a CSV,
 * replication logs, and one per-residue CSV per comparison.
 */
export function exportEverything(entries: WorkspaceEntry[]): void {
  const enc = new TextEncoder();
  const text = (name: string, t: string) => ({ name, data: enc.encode(t) });
  const files = [
    text("README.txt", `OpenFoldUI export — ${new Date().toISOString()}\n${entries.length} comparisons.\n\n` +
      `workspace.json   re-importable backup (Dashboard > Import)\ncomparisons.xlsx summary workbook\n` +
      `comparisons.csv  summary table\nlogs.json        replication logs (provenance + methods)\n` +
      `per-residue/     one CSV of per-residue pLDDT + deviation per comparison\n`),
    text("workspace.json", serializeWorkspace(entries)),
    { name: "comparisons.xlsx", data: buildXlsx([comparisonsSheet(entries)]) },
    text("comparisons.csv", entriesCsv(entries)),
    text("logs.json", JSON.stringify({ app: "OpenFoldUI", logs: entries.map(replicationLog) }, null, 2)),
    ...entries.map((e) => text(`per-residue/${slug(e)}.csv`, perResidueCsv(e))),
  ];
  const date = new Date().toISOString().slice(0, 10);
  download(`openfoldui-export-${date}.zip`, zipStore(files), "application/zip");
}
