/**
 * AlphaFold model + metadata (SPEC §2). The metadata endpoint returns the exact
 * file URLs, so we read those rather than hardcoding a version (Phase 0 found the
 * live version is now v6, up from the spec's v4).
 */
import { fetchJson, fetchText } from "./http.ts";
import { NotFoundError } from "./errors.ts";

interface PredictionMeta {
  pdbUrl?: string;
  cifUrl?: string;
  paeDocUrl?: string;
  uniprotStart?: number;
  uniprotEnd?: number;
  modelCreatedDate?: string;
  latestVersion?: number;
}

export interface AlphaFoldModel {
  /** The .pdb text of the model (numbered by full UniProt sequence). */
  pdbText: string;
  /** URL the PAE JSON can be fetched from (lazy; not fetched here). */
  paeUrl?: string;
  modelUrl: string;
  uniprotStart?: number;
  uniprotEnd?: number;
}

/** Fetch the AlphaFold model for an accession. Throws NotFoundError if none exists. */
export async function fetchAlphaFold(accession: string): Promise<AlphaFoldModel> {
  const metaUrl = `https://alphafold.ebi.ac.uk/api/prediction/${accession}`;
  const meta = await fetchJson<PredictionMeta[]>(metaUrl, "AlphaFold");
  if (!Array.isArray(meta) || meta.length === 0 || !meta[0].pdbUrl) {
    throw new NotFoundError("AlphaFold", `No AlphaFold model for ${accession}.`);
  }
  const m = meta[0];
  const pdbText = await fetchText(m.pdbUrl!, "AlphaFold");
  return {
    pdbText,
    paeUrl: m.paeDocUrl,
    modelUrl: m.pdbUrl!,
    uniprotStart: m.uniprotStart,
    uniprotEnd: m.uniprotEnd,
  };
}
