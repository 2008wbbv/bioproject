/**
 * PDBe: best experimental structures for a UniProt accession, and (fallback) SIFTS
 * mappings. SPEC §2.
 *
 * best_structures returns structures ranked by coverage/resolution. We re-rank to
 * prefer X-ray, then higher UniProt coverage, then better (lower) resolution, while
 * keeping the full list so the UI can offer an override (SPEC §2). Apo-over-holo
 * preference (SPEC §8) needs the structure file itself, so it is applied later in
 * the pipeline, not here.
 */
import { fetchJson } from "./http.ts";
import { NotFoundError } from "./errors.ts";
import type { BestStructureHit } from "../engine/sifts.ts";

/** A best_structures hit with the ranking metadata PDBe provides. */
export interface RankedStructure extends BestStructureHit {
  experimental_method?: string;
  resolution?: number | null;
  coverage?: number;
}

const isXray = (method?: string): boolean =>
  (method ?? "").toLowerCase().includes("x-ray") || (method ?? "").toLowerCase().includes("diffraction");

/** Re-rank PDBe hits: X-ray first, then higher coverage, then better resolution. */
export function rankStructures(hits: RankedStructure[]): RankedStructure[] {
  return [...hits].sort((a, b) => {
    const ax = isXray(a.experimental_method) ? 1 : 0;
    const bx = isXray(b.experimental_method) ? 1 : 0;
    if (ax !== bx) return bx - ax;
    const ac = a.coverage ?? 0;
    const bc = b.coverage ?? 0;
    if (Math.abs(ac - bc) > 0.05) return bc - ac; // meaningfully better coverage wins
    const ar = a.resolution ?? Infinity;
    const br = b.resolution ?? Infinity;
    return ar - br; // lower resolution number = sharper
  });
}

/** Fetch and rank the best experimental structures for an accession. */
export async function fetchBestStructures(accession: string): Promise<RankedStructure[]> {
  const url = `https://www.ebi.ac.uk/pdbe/api/mappings/best_structures/${accession}`;
  const json = await fetchJson<Record<string, RankedStructure[]>>(url, "PDBe");
  const hits = json[accession] ?? json[accession.toUpperCase()] ?? [];
  if (hits.length === 0) {
    throw new NotFoundError("PDBe", `No experimental structures mapped to ${accession}.`);
  }
  return rankStructures(hits);
}

/** Fetch raw SIFTS mappings for a PDB id (segment-fallback numbering path). */
export async function fetchSiftsMappings(pdbId: string): Promise<unknown> {
  const url = `https://www.ebi.ac.uk/pdbe/api/mappings/${pdbId.toLowerCase()}`;
  return fetchJson<unknown>(url, "PDBe");
}
