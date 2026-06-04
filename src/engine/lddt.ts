/**
 * lDDT — the local Distance Difference Test (Mariani et al. 2013). Superposition-FREE
 * per-residue accuracy: the fraction of inter-residue distances (within an inclusion
 * radius R0) that are preserved between model and reference, averaged over four
 * tolerance thresholds (0.5, 1, 2, 4 Å).
 *
 * This is exactly the quantity AlphaFold's pLDDT *predicts*, so observed lDDT vs
 * pLDDT is the scientifically correct confidence-calibration analysis (unlike RMSD,
 * which needs a global superposition). Computed on the matched Cα coordinates. Pure +
 * testable. SPEC §5 extension.
 */
const THRESHOLDS = [0.5, 1, 2, 4] as const;

function dist(c: Float64Array | number[], i: number, j: number): number {
  const dx = c[i * 3] - c[j * 3];
  const dy = c[i * 3 + 1] - c[j * 3 + 1];
  const dz = c[i * 3 + 2] - c[j * 3 + 2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export interface LddtResult {
  /** Per-residue lDDT in [0,1] (NaN if a residue has no neighbours). */
  perResidue: Float64Array;
  /** Global lDDT in [0,1]. */
  global: number;
}

/**
 * @param model interleaved-xyz Cα of the predicted structure (length 3n)
 * @param ref   interleaved-xyz Cα of the reference structure (length 3n), parallel
 * @param n     number of matched residues
 */
export function lddt(
  model: Float64Array | number[],
  ref: Float64Array | number[],
  n: number,
  opts: { r0?: number } = {},
): LddtResult {
  const r0 = opts.r0 ?? 15;
  const presSum = new Float64Array(n); // sum of preserved-fraction over neighbour pairs
  const counts = new Float64Array(n); // number of neighbour pairs considered
  let globalPres = 0;
  let globalCount = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dref = dist(ref, i, j);
      if (dref === 0 || dref >= r0) continue; // only distances within the inclusion radius
      const diff = Math.abs(dref - dist(model, i, j));
      let preserved = 0;
      for (const t of THRESHOLDS) if (diff < t) preserved++;
      const frac = preserved / THRESHOLDS.length;
      presSum[i] += frac;
      presSum[j] += frac;
      counts[i] += 1;
      counts[j] += 1;
      globalPres += frac;
      globalCount += 1;
    }
  }

  const perResidue = new Float64Array(n);
  for (let i = 0; i < n; i++) perResidue[i] = counts[i] > 0 ? presSum[i] / counts[i] : Number.NaN;
  return { perResidue, global: globalCount > 0 ? globalPres / globalCount : 0 };
}
