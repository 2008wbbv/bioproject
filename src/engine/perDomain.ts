/**
 * Per-domain comparison: re-superpose each domain independently and report its own
 * RMSD/TM. When the global RMSD is poor but per-domain RMSDs are good, AlphaFold
 * folded the domains correctly but mis-placed them relative to each other (domain
 * motion). Reuses the pure engine. SPEC §5 extension.
 */
import { kabsch, applyTransform, perResidueDeviations, rmsdFromDeviations, tmScore } from "./compare.ts";
import type { MatchedCoords } from "../api/pipeline.ts";

export interface DomainResult {
  /** UniProt residue range. */
  start: number;
  end: number;
  nMatched: number;
  rmsd: number;
  tmScore: number;
}

export interface DomainUniprotRange {
  start: number;
  end: number;
}

export function perDomainCompare(matched: MatchedCoords, domains: DomainUniprotRange[]): DomainResult[] {
  return domains.map((d) => {
    const idx: number[] = [];
    for (let i = 0; i < matched.uniprotNums.length; i++) {
      const u = matched.uniprotNums[i];
      if (u >= d.start && u <= d.end) idx.push(i);
    }
    const n = idx.length;
    if (n < 3) return { start: d.start, end: d.end, nMatched: n, rmsd: Number.NaN, tmScore: Number.NaN };

    const P = new Float64Array(n * 3);
    const Q = new Float64Array(n * 3);
    idx.forEach((src, k) => {
      for (let c = 0; c < 3; c++) {
        P[k * 3 + c] = matched.p[src * 3 + c];
        Q[k * 3 + c] = matched.q[src * 3 + c];
      }
    });
    const sup = kabsch(P, Q, n);
    const dev = perResidueDeviations(applyTransform(P, sup, n), Q, n);
    return { start: d.start, end: d.end, nMatched: n, rmsd: rmsdFromDeviations(dev), tmScore: tmScore(dev, n) };
  });
}
