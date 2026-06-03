/**
 * Prepare the structure strings the Mol* viewer renders (SPEC §7). Pure — no Mol*,
 * no DOM — so it is testable and keeps all coordinate/B-factor work in the engine.
 *
 * The AlphaFold model is pre-transformed into the experimental frame so the viewer
 * never applies transforms itself. We then encode the active coloring into the
 * B-factor column so Mol*'s built-in B-factor ("uncertainty") color theme renders
 * it — avoiding a custom theme. The theme maps low→blue, high→red, so we choose
 * B-factor contents such that blue = good and red = bad in BOTH modes:
 *
 *   - deviation mode: B-factor := per-residue deviation (Å)   (high deviation = red)
 *   - pLDDT mode:     B-factor := 100 - pLDDT                  (low confidence  = red)
 */
import type { PerResidue, Superposition } from "../engine/types.ts";
import { mapBFactor, rewriteBFactorByAuthNum, transformPdb } from "../engine/pdbTransform.ts";

export interface ViewerModels {
  /** AlphaFold, superposed, B-factor = deviation (Å). */
  afDeviationPdb: string;
  /** AlphaFold, superposed, B-factor = 100 - pLDDT (low confidence high). */
  afConfidencePdb: string;
  /** Upper bound of the deviation color domain. */
  maxDeviation: number;
}

export function prepareViewerModels(
  afPdbText: string,
  superposition: Superposition,
  perResidue: PerResidue[],
): ViewerModels {
  const aligned = transformPdb(afPdbText, superposition);

  const devByUniprot = new Map<number, number>();
  let maxDeviation = 1;
  for (const r of perResidue) {
    devByUniprot.set(r.uniprotNum, r.deviation);
    if (r.deviation > maxDeviation) maxDeviation = r.deviation;
  }

  return {
    // AF author number == UniProt number, so we key the deviation map by authNum.
    afDeviationPdb: rewriteBFactorByAuthNum(aligned, devByUniprot, 0),
    afConfidencePdb: mapBFactor(aligned, (plddt) => 100 - plddt),
    maxDeviation,
  };
}
