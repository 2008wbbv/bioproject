/**
 * Reconcile PDB author numbering with UniProt numbering. SPEC.md §3-4.
 *
 * The experimental file is read in *author* numbering (the resSeq column). The
 * AlphaFold model is numbered directly by the full UniProt sequence. To inner-join
 * the two we must translate experimental author residues into UniProt residues,
 * which is exactly what SIFTS provides.
 *
 * A SIFTS segment is a contiguous run where author numbering maps linearly onto
 * UniProt numbering with a constant offset:
 *
 *     uniprotNum = authNum - authStart + unpStart      for authStart <= authNum <= authEnd
 *
 * Reality is messier than the spec implies in two ways, both handled here:
 *   1. PDBe's /mappings endpoint sometimes returns `author_residue_number: null`
 *      on one end of a segment. Since it always returns the `residue_number` span,
 *      we recover the missing author bound from the populated end + the span length.
 *   2. When BOTH author ends are null, /mappings is unusable on its own; the api
 *      layer falls back to the best_structures endpoint, whose author start/end are
 *      reliably populated. `segmentsFromBestStructure` builds a segment from that.
 *
 * Insertion codes are ignored in v1 (author numbering treated as integer); this is
 * noted as a known limitation in BUILD_PLAN.md.
 */
import type { ResidueRecord } from "./types.ts";

/** A normalized, linear author<->UniProt segment for one chain. */
export interface SiftsSegment {
  chain: string;
  authStart: number;
  authEnd: number;
  unpStart: number;
  unpEnd: number;
}

/**
 * Apply SIFTS segments to fill `uniprotNum` on experimental residues (mutates).
 * Residues not covered by any segment keep `uniprotNum = null` (dropped from the
 * comparison set but retained for display, per SPEC.md §3).
 *
 * Returns counts for diagnostics/warnings.
 */
export function applySifts(
  residues: ResidueRecord[],
  segments: SiftsSegment[],
): { assigned: number; unmapped: number } {
  let assigned = 0;
  let unmapped = 0;
  for (const res of residues) {
    const seg = segments.find(
      (s) =>
        s.chain === res.chain &&
        res.authNum >= s.authStart &&
        res.authNum <= s.authEnd,
    );
    if (seg) {
      res.uniprotNum = res.authNum - seg.authStart + seg.unpStart;
      assigned += 1;
    } else {
      res.uniprotNum = null;
      unmapped += 1;
    }
  }
  return { assigned, unmapped };
}

/**
 * AlphaFold case: the model is numbered by the full UniProt sequence, so the author
 * number IS the UniProt number. Mutates `uniprotNum = authNum`.
 */
export function assignUniprotFromAuth(residues: ResidueRecord[]): void {
  for (const res of residues) res.uniprotNum = res.authNum;
}

// ---------------------------------------------------------------------------
// Tolerant extractors for the two raw PDBe response shapes. These live here (not
// in src/api) because the null-author derivation is fiddly logic worth unit-testing
// headlessly; the api layer just fetches JSON and hands it over.
// ---------------------------------------------------------------------------

interface MappingEnd {
  author_residue_number: number | null;
  residue_number: number;
}
interface RawMapping {
  chain_id: string;
  unp_start: number;
  unp_end: number;
  start: MappingEnd;
  end: MappingEnd;
}

/**
 * Extract normalized segments from a PDBe `/mappings/{pdb}` response.
 *
 * Recovers a missing author bound from the populated end plus the `residue_number`
 * span (assumes contiguous author numbering within the segment). Segments where
 * both author ends are null are skipped — the caller should fall back to
 * `segmentsFromBestStructure`.
 */
export function extractSiftsSegments(
  mappingsResponse: unknown,
  pdbId: string,
): SiftsSegment[] {
  const out: SiftsSegment[] = [];
  const root = mappingsResponse as Record<string, { UniProt?: Record<string, { mappings?: RawMapping[] }> }>;
  const entry = root?.[pdbId.toLowerCase()] ?? root?.[pdbId.toUpperCase()] ?? root?.[pdbId];
  const unp = entry?.UniProt;
  if (!unp) return out;

  for (const acc of Object.keys(unp)) {
    const mappings = unp[acc].mappings ?? [];
    for (const m of mappings) {
      const span = m.end.residue_number - m.start.residue_number; // >= 0
      let authStart = m.start.author_residue_number;
      let authEnd = m.end.author_residue_number;

      if (authStart === null && authEnd === null) continue; // unusable; use fallback
      if (authStart === null && authEnd !== null) authStart = authEnd - span;
      if (authEnd === null && authStart !== null) authEnd = authStart + span;

      out.push({
        chain: m.chain_id,
        authStart: authStart as number,
        authEnd: authEnd as number,
        unpStart: m.unp_start,
        unpEnd: m.unp_end,
      });
    }
  }
  return out;
}

/** One entry from a PDBe `best_structures` response (author start/end reliable). */
export interface BestStructureHit {
  pdb_id: string;
  chain_id: string;
  unp_start: number;
  unp_end: number;
  /** Author residue number where the mapped region starts. */
  start: number;
  /** Author residue number where the mapped region ends. */
  end: number;
}

/** Build a single normalized segment from a best_structures hit (fallback path). */
export function segmentsFromBestStructure(hit: BestStructureHit): SiftsSegment[] {
  return [
    {
      chain: hit.chain_id,
      authStart: hit.start,
      authEnd: hit.end,
      unpStart: hit.unp_start,
      unpEnd: hit.unp_end,
    },
  ];
}
