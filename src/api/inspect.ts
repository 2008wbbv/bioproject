/**
 * AlphaFold model inspection — works on ANY protein, no experimental structure
 * needed. Resolve a name/accession to a UniProt id, fetch its AlphaFold model + PAE,
 * and extract per-residue pLDDT. This is the "companion" path: just look at what
 * AlphaFold predicted and how confident it was.
 */
import { parsePdb } from "../engine/parse.ts";
import { assignUniprotFromAuth } from "../engine/sifts.ts";
import { resolveUniprot } from "./uniprot.ts";
import { fetchAlphaFold } from "./alphafold.ts";

export interface ModelResidue {
  uniprotNum: number;
  plddt: number;
}

export interface InspectResult {
  accession: string;
  name: string;
  /** Raw model PDB text (for the 3D viewer + download). */
  pdbText: string;
  modelUrl: string;
  paeUrl?: string;
  residues: ModelResidue[];
}

export async function inspectModel(query: string): Promise<InspectResult> {
  const resolved = await resolveUniprot(query);
  const af = await fetchAlphaFold(resolved.accession);
  const parsed = parsePdb(af.pdbText);
  assignUniprotFromAuth(parsed.residues);
  const residues: ModelResidue[] = parsed.residues
    .filter((r) => r.caXyz)
    .map((r) => ({ uniprotNum: r.uniprotNum ?? r.authNum, plddt: r.bFactor }));
  return {
    accession: resolved.accession,
    name: resolved.name,
    pdbText: af.pdbText,
    modelUrl: af.modelUrl,
    paeUrl: af.paeUrl,
    residues,
  };
}
