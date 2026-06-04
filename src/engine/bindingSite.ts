/**
 * Binding-site impact (SPEC §8, apo/holo confound). When the experimental structure
 * is ligand-bound (holo) but the model is apo, the model can disagree near the
 * binding site for reasons that aren't the predictor's fault. We identify residues
 * whose Cα is within a cutoff of any ligand atom and compare their deviation to the
 * rest. Pure + testable.
 */
import type { HetAtom, ResidueRecord } from "./types.ts";

/** UniProt numbers of residues with a Cα within `cutoff` Å of any ligand atom. */
export function bindingSiteResidues(
  residues: ResidueRecord[],
  hetAtoms: HetAtom[],
  cutoff = 5,
): Set<number> {
  const site = new Set<number>();
  if (hetAtoms.length === 0) return site;
  const c2 = cutoff * cutoff;
  for (const r of residues) {
    if (r.uniprotNum === null || !r.caXyz) continue;
    const [x, y, z] = r.caXyz;
    for (const h of hetAtoms) {
      const dx = x - h.xyz[0];
      const dy = y - h.xyz[1];
      const dz = z - h.xyz[2];
      if (dx * dx + dy * dy + dz * dz <= c2) {
        site.add(r.uniprotNum);
        break;
      }
    }
  }
  return site;
}

export interface BindingSiteImpact {
  siteCount: number;
  restCount: number;
  siteMeanDeviation: number;
  restMeanDeviation: number;
}

export function bindingSiteImpact(
  perResidue: Array<{ uniprotNum: number; deviation: number }>,
  site: Set<number>,
): BindingSiteImpact {
  const s: number[] = [];
  const o: number[] = [];
  for (const r of perResidue) (site.has(r.uniprotNum) ? s : o).push(r.deviation);
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  return {
    siteCount: s.length,
    restCount: o.length,
    siteMeanDeviation: mean(s),
    restMeanDeviation: mean(o),
  };
}
