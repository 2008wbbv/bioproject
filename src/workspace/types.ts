/**
 * Workspace persistence model (SPEC §9, extended into a notes/favorites workspace).
 *
 * Each successful comparison is saved to history. The lightweight summary +
 * per-residue data lives in the `comparisons` store (browsed in the dashboard, shown
 * in the data sheet, exported). The heavy raw structure text lives in a separate
 * `structures` store, loaded lazily only when the 3D viewer is opened.
 */
import type { PerResidue, Superposition } from "../engine/types.ts";

/** A saved comparison: metrics + annotations + per-residue data. */
export interface WorkspaceEntry {
  /** Stable key: `${uniprot}:${pdbId}:${chain}`. */
  id: string;
  uniprot: string;
  proteinName: string;
  pdbId: string;
  chain: string;
  /** What the user typed to produce this. */
  query: string;
  createdAt: number;
  updatedAt: number;

  // Annotations.
  favorite: boolean;
  notes: string;

  // Summary metrics (for the dashboard table + export).
  rmsd: number;
  tmScore: number;
  gdtTs: number;
  plddtErrorSpearman: number;
  nMatched: number;
  warnings: string[];

  // Full per-residue series (data sheet, charts, export).
  perResidue: PerResidue[];
}

/** Heavy raw structures for re-opening the 3D viewer without refetching. */
export interface StoredStructures {
  id: string;
  afPdbText: string;
  expCifText: string;
  superposition: Superposition;
}
