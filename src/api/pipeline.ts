/**
 * The end-to-end comparison pipeline (SPEC §1): structures in, a ComparisonResult
 * (plus everything the viewer/validation/export need) out. Two entry points share
 * one assembler:
 *   - runComparison(query)        — fetch by UniProt/name from the databases
 *   - runCustomComparison(files)  — compare user-uploaded files (OpenFoldUI upload)
 */
import { parsePdb } from "../engine/parse.ts";
import { parseCif } from "../engine/parseCif.ts";
import { parseByFormat, type StructFormat } from "../engine/format.ts";
import { caPdbFromResidues } from "../engine/writePdb.ts";
import {
  applySifts,
  assignUniprotFromAuth,
  extractSiftsSegments,
  segmentsFromBestStructure,
} from "../engine/sifts.ts";
import { alignByUniprot } from "../engine/align.ts";
import { assignBySequenceAlignment } from "../engine/seqalign.ts";
import { computeComparison } from "../engine/compare.ts";
import type { ComparisonResult, ParsedStructure, ResidueRecord } from "../engine/types.ts";
import type { ComparisonSource } from "../workspace/types.ts";
import { resolveUniprot, type UniprotHit } from "./uniprot.ts";
import { fetchAlphaFold } from "./alphafold.ts";
import { fetchBestStructures, fetchSiftsMappings, type RankedStructure } from "./pdbe.ts";
import { fetchExperimentalStructure } from "./structure.ts";

export interface PipelineResult {
  result: ComparisonResult;
  superposition: import("../engine/types.ts").Superposition;
  /** Predicted-model file text + format (for the viewer). */
  modelText: string;
  modelFormat: StructFormat;
  /** Reference file text + format (for the viewer). */
  refText: string;
  refFormat: StructFormat;
  /** CA-only PDBs for format-safe TM-align validation. */
  modelCaPdb: string;
  refCaPdb: string;
  proteinName: string;
  chosenChain: string;
  source: ComparisonSource;
  /** Where the model/reference came from, for the replication log. */
  modelSource: string;
  refSource: string;
  /** Ranked structures for the override dropdown (database flow only). */
  alternatives?: RankedStructure[];
  /** UniProt disambiguation candidates (database flow only). */
  candidates?: UniprotHit[];
}

/** Choose the chain with the most UniProt-mapped CA residues. */
export function pickBestChain(residues: ResidueRecord[]): string | null {
  const counts = new Map<string, number>();
  for (const r of residues) {
    if (r.uniprotNum !== null && r.caXyz) counts.set(r.chain, (counts.get(r.chain) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = -1;
  for (const [chain, n] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (n > bestN) {
      best = chain;
      bestN = n;
    }
  }
  return best;
}

interface AssembleMeta {
  uniprot: string;
  proteinName: string;
  pdbId: string;
  source: ComparisonSource;
  modelText: string;
  modelFormat: StructFormat;
  refText: string;
  refFormat: StructFormat;
  modelSource: string;
  refSource: string;
  extraWarnings?: string[];
}

/**
 * Shared core: given a parsed model and reference (both with `uniprotNum` assigned),
 * pick the best reference chain, align, compute every metric, and package the
 * result with the texts + CA-only PDBs the UI needs.
 */
function assembleComparison(
  model: ParsedStructure,
  ref: ParsedStructure,
  meta: AssembleMeta,
): PipelineResult {
  const chosenChain = pickBestChain(ref.residues) ?? ref.residues[0]?.chain ?? "A";
  const chainResidues = ref.residues.filter((r) => r.chain === chosenChain);

  const alignment = alignByUniprot(model.residues, chainResidues);
  const referenceLength = new Set(
    chainResidues.filter((r) => r.uniprotNum !== null && r.caXyz).map((r) => r.uniprotNum),
  ).size;
  const metrics = computeComparison(alignment, { referenceLength });

  const warnings = [...(meta.extraWarnings ?? []), ...ref.warnings, ...model.warnings];
  if (metrics.nMatched === 0) {
    warnings.push("No residues matched — check that both files are the same protein and numbering.");
  } else if (metrics.nMatched < 10) {
    warnings.push(`Only ${metrics.nMatched} residues matched — interpret metrics with caution.`);
  }
  if (Number.isNaN(metrics.plddtErrorSpearman)) {
    warnings.push("pLDDT–error correlation is undefined (constant pLDDT or deviation).");
  }

  const result: ComparisonResult = {
    uniprot: meta.uniprot,
    pdbId: meta.pdbId,
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
    modelText: meta.modelText,
    modelFormat: meta.modelFormat,
    refText: meta.refText,
    refFormat: meta.refFormat,
    modelCaPdb: caPdbFromResidues(model.residues),
    refCaPdb: caPdbFromResidues(chainResidues, chosenChain),
    proteinName: meta.proteinName,
    chosenChain,
    source: meta.source,
    modelSource: meta.modelSource,
    refSource: meta.refSource,
  };
}

export interface RunOptions {
  /** Override the auto-picked experimental structure with a specific PDB id. */
  pdbId?: string;
}

/** Database flow: name/accession → AlphaFold vs the best experimental structure. */
export async function runComparison(query: string, opts: RunOptions = {}): Promise<PipelineResult> {
  const resolved = await resolveUniprot(query);
  const accession = resolved.accession;

  const alternatives = await fetchBestStructures(accession);
  const chosen =
    (opts.pdbId && alternatives.find((s) => s.pdb_id.toLowerCase() === opts.pdbId!.toLowerCase())) ||
    alternatives[0];

  const [af, exp] = await Promise.all([
    fetchAlphaFold(accession),
    fetchExperimentalStructure(chosen.pdb_id),
  ]);

  const afParsed = parsePdb(af.pdbText);
  assignUniprotFromAuth(afParsed.residues);

  const expParsed = parseCif(exp.text, { uniprotAcc: accession });
  const extraWarnings: string[] = [];
  if (!exp.hasSiftsXref || expParsed.residues.every((r) => r.uniprotNum === null)) {
    let segments = [] as ReturnType<typeof extractSiftsSegments>;
    try {
      segments = extractSiftsSegments(await fetchSiftsMappings(chosen.pdb_id), chosen.pdb_id);
    } catch {
      // mappings unavailable; fall through to best_structures-derived segment
    }
    if (segments.length === 0) segments = segmentsFromBestStructure(chosen);
    applySifts(expParsed.residues, segments);
    extraWarnings.push("UniProt numbering resolved via SIFTS segments (no per-atom xref).");
  }

  const assembled = assembleComparison(afParsed, expParsed, {
    uniprot: accession,
    proteinName: resolved.name,
    pdbId: chosen.pdb_id.toUpperCase(),
    source: "database",
    modelText: af.pdbText,
    modelFormat: "pdb",
    refText: exp.text,
    refFormat: "cif",
    modelSource: `AlphaFold DB: ${af.modelUrl}`,
    refSource: `${exp.source}: ${chosen.pdb_id.toUpperCase()}`,
    extraWarnings,
  });
  assembled.alternatives = alternatives;
  assembled.candidates = resolved.candidates;
  return assembled;
}

export interface UploadedFile {
  name: string;
  text: string;
  format: StructFormat;
}

/** How to put the two uploaded structures into residue correspondence. */
export type AlignBy = "auto" | "author" | "sequence";

export interface CustomOptions {
  /** Optional UniProt accession, if the user wants to label/cross-reference it. */
  uniprot?: string;
  /** Residue correspondence basis (default "auto"). */
  alignBy?: AlignBy;
}

const ALIGN_NOTE: Record<AlignBy, string> = {
  auto: "Uploaded files: residues matched on shared numbering (assumed same protein).",
  author: "Uploaded files: residues matched on author (file) numbering.",
  sequence: "Uploaded files: residues matched by global sequence alignment.",
};

/**
 * Upload flow: compare a user-provided predicted model against a user-provided
 * reference. The model's pLDDT lives in its B-factor column. Residue correspondence:
 *   - "auto":     per-atom SIFTS xref if present, else author numbering
 *   - "author":   force author (file) numbering on both
 *   - "sequence": global Needleman–Wunsch alignment (for mismatched numbering)
 */
export function runCustomComparison(
  model: UploadedFile,
  ref: UploadedFile,
  opts: CustomOptions = {},
): PipelineResult {
  const acc = opts.uniprot?.toUpperCase();
  const alignBy = opts.alignBy ?? "auto";
  const modelParsed = parseByFormat(model.text, model.format, acc ? { uniprotAcc: acc } : {});
  const refParsed = parseByFormat(ref.text, ref.format, acc ? { uniprotAcc: acc } : {});

  if (alignBy === "sequence") {
    assignBySequenceAlignment(modelParsed.residues, refParsed.residues);
  } else if (alignBy === "author") {
    assignUniprotFromAuth(modelParsed.residues);
    assignUniprotFromAuth(refParsed.residues);
  } else {
    // auto: use UniProt numbers if a file carried them (CIF xref); else author.
    if (modelParsed.residues.every((r) => r.uniprotNum === null)) assignUniprotFromAuth(modelParsed.residues);
    if (refParsed.residues.every((r) => r.uniprotNum === null)) assignUniprotFromAuth(refParsed.residues);
  }

  const assembled = assembleComparison(modelParsed, refParsed, {
    uniprot: acc ?? "(uploaded)",
    proteinName: `${model.name} vs ${ref.name}`,
    pdbId: ref.name,
    source: "upload",
    modelText: model.text,
    modelFormat: model.format,
    refText: ref.text,
    refFormat: ref.format,
    modelSource: `uploaded file: ${model.name}`,
    refSource: `uploaded file: ${ref.name}`,
    extraWarnings: [ALIGN_NOTE[alignBy]],
  });
  return assembled;
}
