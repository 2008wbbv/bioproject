/**
 * Workspace persistence model (SPEC §9, extended into a notes/favorites workspace).
 *
 * Each successful comparison is saved to history. The lightweight summary +
 * per-residue data lives in the `comparisons` store (browsed in the dashboard, shown
 * in the data sheet, exported). The heavy raw structure text lives in a separate
 * `structures` store, loaded lazily only when the 3D viewer is opened.
 */
import type { PerResidue, Superposition } from "../engine/types.ts";

/** Where a comparison came from: a database lookup or user-uploaded files. */
export type ComparisonSource = "database" | "upload";

/** Provenance for reproducing a comparison (exported in the replication log). */
export interface Provenance {
  appVersion: string;
  /** Where the predicted model came from (AlphaFold URL or uploaded filename). */
  modelSource: string;
  /** Where the reference came from (PDBe/RCSB source label or uploaded filename). */
  refSource: string;
}

/** Structure file format. */
export type StructFormat = "pdb" | "cif";

/** A saved comparison: metrics + annotations + per-residue data. */
export interface WorkspaceEntry {
  /** Stable key: `${uniprot}:${pdbId}:${chain}` (database) or `custom:…` (upload). */
  id: string;
  uniprot: string;
  proteinName: string;
  pdbId: string;
  chain: string;
  /** What the user typed to produce this (or the uploaded file names). */
  query: string;
  /** "database" (UniProt/PDBe/AlphaFold) or "upload" (user files). */
  source: ComparisonSource;
  createdAt: number;
  updatedAt: number;

  // Annotations.
  favorite: boolean;
  notes: string;
  /** Free-form tags for organizing studies (e.g. "kinases", "paper-2026"). */
  tags?: string[];
  /** Optional single-value collection/project grouping. */
  project?: string;
  /** Pinned residues with a note. */
  annotations?: Array<{ residue: number; text: string }>;

  // Summary metrics (for the dashboard table + export).
  rmsd: number;
  tmScore: number;
  gdtTs: number;
  /** Global lDDT in [0,1] (superposition-free local accuracy). */
  lddt?: number;
  plddtErrorSpearman: number;
  nMatched: number;
  warnings: string[];

  // Full per-residue series (data sheet, charts, export).
  perResidue: PerResidue[];

  /** How this comparison was produced, for the replication log. */
  provenance?: Provenance;
}

/**
 * Heavy raw structures for re-opening the 3D viewer / re-validating without
 * refetching. Formats are tracked so the viewer parses correctly, and CA-only PDBs
 * are precomputed so TM-align validation never has to guess a format.
 *
 * Legacy entries (before formats) used `afPdbText`/`expCifText`; `normalizeStored`
 * maps them forward. New fields are optional for back-compat.
 */
export interface StoredStructures {
  id: string;
  /** Predicted-model file text (AlphaFold or uploaded). */
  modelText: string;
  modelFormat: StructFormat;
  /** Reference/experimental file text. */
  refText: string;
  refFormat: StructFormat;
  superposition: Superposition;
  /** CA-only PDB of the model, for TM-align validation (format-safe). */
  modelCaPdb?: string;
  /** CA-only PDB of the reference chain, for TM-align validation. */
  refCaPdb?: string;
  /** AlphaFold PAE JSON URL (database/AlphaFold entries only). */
  paeUrl?: string;
  /** Matched Cα coordinates for per-domain / per-region re-superposition. */
  matched?: { uniprotNums: number[]; p: number[]; q: number[] };

  // --- legacy fields (read-only back-compat) ---
  afPdbText?: string;
  expCifText?: string;
}

/** Map any stored record (incl. legacy) to the current shape. */
export function normalizeStored(s: StoredStructures): StoredStructures {
  if (s.modelText) return s;
  return {
    ...s,
    modelText: s.afPdbText ?? "",
    modelFormat: "pdb",
    refText: s.expCifText ?? "",
    refFormat: "cif",
  };
}
