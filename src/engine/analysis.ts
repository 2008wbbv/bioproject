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
