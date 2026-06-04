/**
 * Per-residue analysis helpers for the lab-facing summary: AlphaFold pLDDT
 * confidence bands and the "confidently wrong" residues (high pLDDT yet high
 * deviation) — the residues a lab most needs to know about. Pure + testable.
 */
import type { PerResidue } from "./types.ts";

/** Standard AlphaFold pLDDT confidence bands. */
export interface PlddtBands {
  veryHigh: number; // pLDDT > 90
  confident: number; // 70–90
  low: number; // 50–70
  veryLow: number; // < 50
  total: number;
}

export function plddtBands(perResidue: PerResidue[]): PlddtBands {
  const b: PlddtBands = { veryHigh: 0, confident: 0, low: 0, veryLow: 0, total: perResidue.length };
  for (const r of perResidue) {
    if (r.plddt > 90) b.veryHigh++;
    else if (r.plddt >= 70) b.confident++;
    else if (r.plddt >= 50) b.low++;
    else b.veryLow++;
  }
  return b;
}

/**
 * Residues where AlphaFold was confident (pLDDT ≥ plddtMin) yet the model deviates
 * (≥ devMin Å) — the headline failure mode. Sorted by deviation, worst first.
 */
export function confidentlyWrong(
  perResidue: PerResidue[],
  { plddtMin = 70, devMin = 3, limit = 10 }: { plddtMin?: number; devMin?: number; limit?: number } = {},
): PerResidue[] {
  return perResidue
    .filter((r) => r.plddt >= plddtMin && r.deviation >= devMin)
    .sort((a, b) => b.deviation - a.deviation)
    .slice(0, limit);
}

/** A contiguous stretch of residues where the model diverges from experiment. */
export interface DivergentRegion {
  start: number; // first UniProt residue
  end: number; // last UniProt residue
  length: number;
  meanDeviation: number;
  maxDeviation: number;
  meanPlddt: number;
}

/**
 * Find contiguous runs of residues whose deviation is ≥ devMin (a small gap between
 * residue numbers is tolerated so a single missing residue doesn't split a region).
 * These are the "the model misses loop 120–135" stretches a lab wants flagged.
 */
export function divergentRegions(
  perResidue: PerResidue[],
  { devMin = 3, minLen = 3, maxGap = 1 }: { devMin?: number; minLen?: number; maxGap?: number } = {},
): DivergentRegion[] {
  const sorted = [...perResidue].sort((a, b) => a.uniprotNum - b.uniprotNum);
  const regions: DivergentRegion[] = [];
  let run: PerResidue[] = [];

  const flush = () => {
    if (run.length >= minLen) {
      const devs = run.map((r) => r.deviation);
      regions.push({
        start: run[0].uniprotNum,
        end: run[run.length - 1].uniprotNum,
        length: run.length,
        meanDeviation: devs.reduce((a, d) => a + d, 0) / run.length,
        maxDeviation: Math.max(...devs),
        meanPlddt: run.reduce((a, r) => a + r.plddt, 0) / run.length,
      });
    }
    run = [];
  };

  for (const r of sorted) {
    if (r.deviation >= devMin) {
      const prev = run[run.length - 1];
      if (prev && r.uniprotNum - prev.uniprotNum > maxGap + 1) flush();
      run.push(r);
    } else {
      flush();
    }
  }
  flush();
  return regions.sort((a, b) => b.meanDeviation - a.meanDeviation);
}

/** One pLDDT bin of the calibration curve. */
export interface CalibrationBin {
  plddtLo: number;
  plddtHi: number;
  n: number;
  meanDeviation: number;
  /** Fraction of residues in this bin within `withinA` Å (i.e. "correct"). */
  fractionCorrect: number;
}

/**
 * pLDDT calibration: bin residues by confidence and report the mean deviation per
 * bin. Well-calibrated confidence means deviation falls monotonically as pLDDT
 * rises. Aggregated across many comparisons it's a reliability diagram for the
 * predictor on your dataset.
 */
export function calibrationCurve(
  residues: Array<{ plddt: number; deviation: number }>,
  binSize = 10,
  withinA = 2,
): CalibrationBin[] {
  const nbins = Math.ceil(100 / binSize);
  const bins: CalibrationBin[] = Array.from({ length: nbins }, (_, i) => ({
    plddtLo: i * binSize,
    plddtHi: Math.min(100, (i + 1) * binSize),
    n: 0,
    meanDeviation: 0,
    fractionCorrect: 0,
  }));
  const sums = new Array(nbins).fill(0);
  const correct = new Array(nbins).fill(0);
  for (const r of residues) {
    const b = Math.min(nbins - 1, Math.max(0, Math.floor(r.plddt / binSize)));
    bins[b].n++;
    sums[b] += r.deviation;
    if (r.deviation <= withinA) correct[b]++;
  }
  for (let i = 0; i < nbins; i++) {
    if (bins[i].n > 0) {
      bins[i].meanDeviation = sums[i] / bins[i].n;
      bins[i].fractionCorrect = correct[i] / bins[i].n;
    }
  }
  return bins.filter((b) => b.n > 0);
}

export interface DeviationStats {
  mean: number;
  median: number;
  max: number;
  /** Fraction of residues within 2 Å (a "good agreement" proxy). */
  fractionWithin2: number;
}

export function deviationStats(perResidue: PerResidue[]): DeviationStats {
  if (perResidue.length === 0) return { mean: 0, median: 0, max: 0, fractionWithin2: 0 };
  const devs = perResidue.map((r) => r.deviation).sort((a, b) => a - b);
  const sum = devs.reduce((a, d) => a + d, 0);
  const mid = Math.floor(devs.length / 2);
  const median = devs.length % 2 ? devs[mid] : (devs[mid - 1] + devs[mid]) / 2;
  const within2 = devs.filter((d) => d <= 2).length;
  return {
    mean: sum / devs.length,
    median,
    max: devs[devs.length - 1],
    fractionWithin2: within2 / devs.length,
  };
}
