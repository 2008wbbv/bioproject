/**
 * Pure shaping of workspace data into spreadsheet rows (SPEC §10). Kept separate
 * from the DOM download code (export.ts) so it's unit-testable.
 */
import type { WorkspaceEntry } from "./types.ts";
import type { Sheet, Cell } from "./xlsx.ts";

const r = (v: number, dp: number): Cell => (Number.isFinite(v) ? Number(v.toFixed(dp)) : "");

/** Key/value metrics for one comparison. */
export function summarySheet(entry: WorkspaceEntry): Sheet {
  const rows: Cell[][] = [
    ["Field", "Value"],
    ["UniProt", entry.uniprot],
    ["Protein", entry.proteinName],
    ["PDB id", entry.pdbId],
    ["Chain", entry.chain],
    ["RMSD (Å)", r(entry.rmsd, 3)],
    ["TM-score", r(entry.tmScore, 4)],
    ["GDT-TS", r(entry.gdtTs, 4)],
    ["pLDDT–error Spearman", Number.isNaN(entry.plddtErrorSpearman) ? "n/a" : r(entry.plddtErrorSpearman, 4)],
    ["Matched residues", entry.nMatched],
    ["Favorite", entry.favorite ? "yes" : "no"],
    ["Notes", entry.notes],
    ["Warnings", entry.warnings.join(" | ")],
    ["Saved", new Date(entry.updatedAt).toISOString()],
  ];
  return { name: "Summary", rows };
}

/** Per-residue data points: residue, pLDDT, deviation. */
export function perResidueSheet(entry: WorkspaceEntry): Sheet {
  const rows: Cell[][] = [["UniProt residue", "pLDDT", "Deviation (Å)"]];
  for (const p of [...entry.perResidue].sort((a, b) => a.uniprotNum - b.uniprotNum)) {
    rows.push([p.uniprotNum, r(p.plddt, 2), r(p.deviation, 3)]);
  }
  return { name: "Per-residue", rows };
}

/** One row per saved comparison — the dashboard as a sheet. */
export function comparisonsSheet(entries: WorkspaceEntry[]): Sheet {
  const rows: Cell[][] = [
    ["UniProt", "Protein", "PDB", "Chain", "RMSD (Å)", "TM-score", "GDT-TS", "pLDDT–error ρ", "Matched", "Favorite", "Notes", "Saved"],
  ];
  for (const e of entries) {
    rows.push([
      e.uniprot,
      e.proteinName,
      e.pdbId,
      e.chain,
      r(e.rmsd, 3),
      r(e.tmScore, 4),
      r(e.gdtTs, 4),
      Number.isNaN(e.plddtErrorSpearman) ? "n/a" : r(e.plddtErrorSpearman, 4),
      e.nMatched,
      e.favorite ? "yes" : "",
      e.notes,
      new Date(e.updatedAt).toISOString(),
    ]);
  }
  return { name: "Comparisons", rows };
}
