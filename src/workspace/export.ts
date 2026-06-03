/**
 * Trigger downloads of workspace data as .xlsx or .csv (SPEC §10). The data shaping
 * is pure (exportData.ts / csv.ts); this module only turns it into a file the
 * browser saves.
 */
import { buildXlsx } from "./xlsx.ts";
import { summarySheet, perResidueSheet, comparisonsSheet } from "./exportData.ts";
import { perResidueCsv, entriesCsv } from "./csv.ts";
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
