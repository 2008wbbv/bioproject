/**
 * Fetch the experimental structure file. SPEC §2.
 *
 * Prefers PDBe's "updated" mmCIF, which annotates every atom with its UniProt
 * residue number via the SIFTS xref columns — so numbering reconciliation is free
 * (see docs/PHASE0.md). Falls back to plain RCSB/PDBe mmCIF if the updated file is
 * unavailable (with the SIFTS-segment path picking up numbering in that case).
 *
 * Order matters: RCSB's own CDN was intermittently 504ing during Phase 0, so the
 * PDBe mirror is tried first.
 */
import { fetchTextWithFallback } from "./http.ts";

export interface ExperimentalStructure {
  /** mmCIF text. */
  text: string;
  /** True when the file is PDBe-updated (carries per-atom UniProt numbers). */
  hasSiftsXref: boolean;
  /** Where it came from, for display/debugging. */
  source: string;
}

export async function fetchExperimentalStructure(pdbId: string): Promise<ExperimentalStructure> {
  const id = pdbId.toLowerCase();
  const updated = `https://www.ebi.ac.uk/pdbe/entry-files/download/${id}_updated.cif`;

  // 1. PDBe updated mmCIF (preferred): per-atom UniProt numbers.
  try {
    const text = await fetchTextWithFallback([{ url: updated, source: "PDBe (updated cif)" }]);
    return { text: text.text, hasSiftsXref: true, source: text.source };
  } catch {
    // fall through to plain mmCIF
  }

  // 2. Plain mmCIF from PDBe, then RCSB. No SIFTS xref columns — numbering will be
  //    resolved via the SIFTS-segment fallback in the pipeline.
  const plain = await fetchTextWithFallback([
    { url: `https://www.ebi.ac.uk/pdbe/entry-files/download/${id}.cif`, source: "PDBe (cif)" },
    { url: `https://files.rcsb.org/download/${id.toUpperCase()}.cif`, source: "RCSB (cif)" },
  ]);
  return { text: plain.text, hasSiftsXref: false, source: plain.source };
}
