/**
 * The end-to-end comparison pipeline (SPEC §1): an id/name in, a ComparisonResult
 * (plus everything the viewer needs) out. This is the one place the api layer and
 * the engine meet; components call `runComparison` and render the result.
 */
import { parsePdb } from "../engine/parse.ts";
import { parseCif } from "../engine/parseCif.ts";
import {
  applySifts,
  assignUniprotFromAuth,
  extractSiftsSegments,
  segmentsFromBestStructure,
} from "../engine/sifts.ts";
import { alignByUniprot } from "../engine/align.ts";
import { computeComparison } from "../engine/compare.ts";
import type { ComparisonResult, ResidueRecord, Superposition } from "../engine/types.ts";
import { resolveUniprot, type UniprotHit } from "./uniprot.ts";
import { fetchAlphaFold } from "./alphafold.ts";
import { fetchBestStructures, fetchSiftsMappings, type RankedStructure } from "./pdbe.ts";
import { fetchExperimentalStructure } from "./structure.ts";

export interface PipelineResult {
  result: ComparisonResult;
  superposition: Superposition;
  /** Raw AlphaFold model text (.pdb), for the viewer. */
  afPdbText: string;
  /** Raw experimental mmCIF text, for the viewer. */
  expCifText: string;
  /** Resolved protein display name. */
  proteinName: string;
  /** The experimental structure that was used. */
  chosenStructure: RankedStructure;
  /** Chain of the experimental structure that was compared. */
  chosenChain: string;
  /** All ranked structures, so the UI can offer an override. */
  alternatives: RankedStructure[];
  /** UniProt disambiguation candidates (empty if resolved from an accession). */
  candidates: UniprotHit[];
}

/** Choose the experimental chain with the most UniProt-mapped CA residues. */
export function pickBestChain(residues: ResidueRecord[]): string | null {
  const counts = new Map<string, number>();
  for (const r of residues) {
    if (r.uniprotNum !== null && r.caXyz) counts.set(r.chain, (counts.get(r.chain) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = -1;
  // Deterministic: highest count, then lexicographically smallest chain id.
  for (const [chain, n] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (n > bestN) {
      best = chain;
      bestN = n;
    }
  }
  return best;
}

export interface RunOptions {
  /** Override the auto-picked experimental structure with a specific PDB id. */
  pdbId?: string;
}

export async function runComparison(query: string, opts: RunOptions = {}): Promise<PipelineResult> {
  // 1. Resolve to a UniProt accession.
  const resolved = await resolveUniprot(query);
  const accession = resolved.accession;

  // 2. Best experimental structures (ranked), then pick.
  const alternatives = await fetchBestStructures(accession);
  const chosen =
    (opts.pdbId && alternatives.find((s) => s.pdb_id.toLowerCase() === opts.pdbId!.toLowerCase())) ||
    alternatives[0];

  // 3. Fetch AlphaFold model and the experimental file in parallel.
  const [af, exp] = await Promise.all([
    fetchAlphaFold(accession),
    fetchExperimentalStructure(chosen.pdb_id),
  ]);

  // 4. Parse. AlphaFold: numbered directly by UniProt.
  const afParsed = parsePdb(af.pdbText);
  assignUniprotFromAuth(afParsed.residues);

  // Experimental: prefer per-atom SIFTS xref from the updated cif; else segments.
  const expParsed = parseCif(exp.text, { uniprotAcc: accession });
  const warnings: string[] = [];
  if (!exp.hasSiftsXref || expParsed.residues.every((r) => r.uniprotNum === null)) {
    let segments = [] as ReturnType<typeof extractSiftsSegments>;
    try {
      segments = extractSiftsSegments(await fetchSiftsMappings(chosen.pdb_id), chosen.pdb_id);
    } catch {
      // mappings unavailable; fall through to best_structures-derived segment
    }
    if (segments.length === 0) segments = segmentsFromBestStructure(chosen);
    applySifts(expParsed.residues, segments);
    warnings.push("UniProt numbering resolved via SIFTS segments (no per-atom xref).");
  }

  // 5. Best-chain selection, then restrict experimental residues to that chain.
  const chosenChain = pickBestChain(expParsed.residues) ?? expParsed.residues[0]?.chain ?? "A";
  const chainResidues = expParsed.residues.filter((r) => r.chain === chosenChain);

  // 6. Align + compare. Reference length = monomer length (unique UniProt residues).
  const alignment = alignByUniprot(afParsed.residues, chainResidues);
  const referenceLength = new Set(
    chainResidues.filter((r) => r.uniprotNum !== null && r.caXyz).map((r) => r.uniprotNum),
  ).size;
  const metrics = computeComparison(alignment, { referenceLength });

  // 7. Warnings: holo (apo/holo, SPEC §8) and degenerate cases.
  warnings.push(...expParsed.warnings, ...afParsed.warnings);
  if (metrics.nMatched < 10) {
    warnings.push(`Only ${metrics.nMatched} residues matched — interpret metrics with caution.`);
  }
  if (Number.isNaN(metrics.plddtErrorSpearman)) {
    warnings.push("pLDDT–error correlation is undefined (constant pLDDT or deviation).");
  }

  const result: ComparisonResult = {
    uniprot: accession,
    pdbId: chosen.pdb_id.toUpperCase(),
    nMatched: metrics.nMatched,
    rmsd: metrics.rmsd,
    tmScore: metrics.tmScore,
    gdtTs: metrics.gdtTs,
    plddtErrorSpearman: metrics.plddtErrorSpearman,
    perResidue: metrics.perResidue,
    warnings: [...new Set(warnings)],
    backend: "native",
  };

  return {
    result,
    superposition: metrics.superposition,
    afPdbText: af.pdbText,
    expCifText: exp.text,
    proteinName: resolved.name,
    chosenStructure: chosen,
    chosenChain,
    alternatives,
    candidates: resolved.candidates,
  };
}
