/**
 * CSV builders (SPEC §10 export). Pure string work — no DOM — so they're testable
 * and reused for both the per-residue data and the dashboard summary. CSV opens
 * directly in Excel/Sheets; the .xlsx writer (xlsx.ts) is the richer alternative.
 */
import type { WorkspaceEntry } from "./types.ts";

type Cell = string | number;

function escapeCell(value: Cell): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV string from a header row + data rows. */
export function toCsv(header: string[], rows: Cell[][]): string {
  const lines = [header, ...rows].map((r) => r.map(escapeCell).join(","));
  return lines.join("\r\n");
}

/** Per-residue data points for one comparison: residue, pLDDT, deviation. */
export function perResidueCsv(entry: WorkspaceEntry): string {
  const rows = entry.perResidue
    .slice()
    .sort((a, b) => a.uniprotNum - b.uniprotNum)
    .map((r) => [r.uniprotNum, round(r.plddt, 2), round(r.deviation, 3)]);
  return toCsv(["uniprot_residue", "plddt", "deviation_angstrom"], rows);
}

/** One row per saved comparison — the dashboard, as CSV. */
export function entriesCsv(entries: WorkspaceEntry[]): string {
  const rows = entries.map((e) => [
    e.uniprot,
    e.proteinName,
    e.pdbId,
    e.chain,
    round(e.rmsd, 3),
    round(e.tmScore, 4),
    round(e.gdtTs, 4),
    Number.isNaN(e.plddtErrorSpearman) ? "" : round(e.plddtErrorSpearman, 4),
    e.nMatched,
    e.favorite ? "yes" : "",
    e.notes,
    new Date(e.updatedAt).toISOString(),
  ]);
  return toCsv(
    ["uniprot", "protein", "pdb_id", "chain", "rmsd", "tm_score", "gdt_ts", "plddt_error_spearman", "n_matched", "favorite", "notes", "updated"],
    rows,
  );
}

function round(v: number, dp: number): number {
  return Number.isFinite(v) ? Number(v.toFixed(dp)) : 0;
}
