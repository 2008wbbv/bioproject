/**
 * Distance-difference matrix (DDM / contact-map comparison). For every pair of
 * matched residues, the difference between the model's Cα–Cα distance and the
 * reference's: D_model(i,j) − D_ref(i,j). Superposition-free. Off-diagonal blocks of
 * one sign reveal that two regions are systematically too close/too far — a
 * *topological* disagreement that global RMSD and per-residue deviation miss.
 * Pure + testable.
 */
function dist(c: number[] | Float64Array, i: number, j: number): number {
  const dx = c[i * 3] - c[j * 3];
  const dy = c[i * 3 + 1] - c[j * 3 + 1];
  const dz = c[i * 3 + 2] - c[j * 3 + 2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export interface Ddm {
  /** Flattened n×n signed differences (model − ref), row-major. */
  data: Float32Array;
  size: number;
  /** Largest absolute difference, for symmetric colour scaling. */
  maxAbs: number;
}

export function distanceDifferenceMatrix(model: number[] | Float64Array, ref: number[] | Float64Array, n: number): Ddm {
  const data = new Float32Array(n * n);
  let maxAbs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const diff = dist(model, i, j) - dist(ref, i, j);
      data[i * n + j] = diff;
      data[j * n + i] = diff;
      const a = Math.abs(diff);
      if (a > maxAbs) maxAbs = a;
    }
  }
  return { data, size: n, maxAbs: maxAbs || 1 };
}
