/**
 * Predicted disorder from AlphaFold pLDDT. Long stretches of low confidence
 * (pLDDT < 50) are AlphaFold's signal for intrinsically disordered / flexible
 * regions — one of the most useful things the model tells you when no experimental
 * structure exists. Pure + testable.
 */
export interface DisorderRegion {
  start: number;
  end: number;
  length: number;
  meanPlddt: number;
}

interface PlddtResidue {
  uniprotNum: number;
  plddt: number;
}

/** Contiguous runs of low-pLDDT residues (gap-tolerant), longest/most-confident first. */
export function disorderedRegions(
  residues: PlddtResidue[],
  { maxPlddt = 50, minLen = 10, maxGap = 1 }: { maxPlddt?: number; minLen?: number; maxGap?: number } = {},
): DisorderRegion[] {
  const sorted = [...residues].sort((a, b) => a.uniprotNum - b.uniprotNum);
  const out: DisorderRegion[] = [];
  let run: PlddtResidue[] = [];

  const flush = () => {
    if (run.length >= minLen) {
      out.push({
        start: run[0].uniprotNum,
        end: run[run.length - 1].uniprotNum,
        length: run.length,
        meanPlddt: run.reduce((a, r) => a + r.plddt, 0) / run.length,
      });
    }
    run = [];
  };

  for (const r of sorted) {
    if (r.plddt < maxPlddt) {
      const prev = run[run.length - 1];
      if (prev && r.uniprotNum - prev.uniprotNum > maxGap + 1) flush();
      run.push(r);
    } else {
      flush();
    }
  }
  flush();
  return out.sort((a, b) => b.length - a.length);
}

export interface PlddtSummary {
  n: number;
  mean: number;
  /** Fraction with pLDDT < 50 (likely disordered). */
  fractionDisordered: number;
  /** Fraction with pLDDT ≥ 70 (confident). */
  fractionConfident: number;
  /** Fraction with pLDDT > 90 (very high). */
  fractionVeryHigh: number;
}

export function plddtSummary(plddts: number[]): PlddtSummary {
  const n = plddts.length;
  if (n === 0) return { n: 0, mean: 0, fractionDisordered: 0, fractionConfident: 0, fractionVeryHigh: 0 };
  let sum = 0;
  let dis = 0;
  let conf = 0;
  let vh = 0;
  for (const p of plddts) {
    sum += p;
    if (p < 50) dis++;
    if (p >= 70) conf++;
    if (p > 90) vh++;
  }
  return { n, mean: sum / n, fractionDisordered: dis / n, fractionConfident: conf / n, fractionVeryHigh: vh / n };
}
