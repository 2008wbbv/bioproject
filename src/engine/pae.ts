/**
 * Parse AlphaFold's Predicted Aligned Error (PAE) JSON (SPEC §2). PAE[i][j] is the
 * expected position error (Å) at residue i when the structure is aligned on residue
 * j — low blocks = confidently-placed domains; bright off-diagonal = uncertain
 * relative orientation. Pure + testable.
 */
export interface Pae {
  matrix: number[][];
  size: number;
  max: number;
}

interface RawPae {
  predicted_aligned_error?: number[][];
  pae?: number[][];
  max_predicted_aligned_error?: number;
  // legacy sparse form
  residue1?: number[];
  residue2?: number[];
  distance?: number[];
}

/** Parse either the modern matrix form or the legacy sparse (residue1/2/distance). */
export function parsePae(json: unknown): Pae | null {
  const o = (Array.isArray(json) ? json[0] : json) as RawPae | undefined;
  if (!o) return null;

  const matrix = o.predicted_aligned_error ?? o.pae;
  if (Array.isArray(matrix) && Array.isArray(matrix[0])) {
    let max = o.max_predicted_aligned_error ?? 0;
    if (!max) for (const row of matrix) for (const v of row) if (v > max) max = v;
    return { matrix, size: matrix.length, max: max || 1 };
  }

  // Legacy sparse triplets -> dense matrix.
  if (o.residue1 && o.residue2 && o.distance) {
    const n = Math.max(...o.residue1, ...o.residue2);
    const m: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    let max = 0;
    for (let k = 0; k < o.distance.length; k++) {
      const i = o.residue1[k] - 1;
      const j = o.residue2[k] - 1;
      const d = o.distance[k];
      if (i >= 0 && j >= 0 && i < n && j < n) m[i][j] = d;
      if (d > max) max = d;
    }
    return { matrix: m, size: n, max: max || 1 };
  }
  return null;
}
