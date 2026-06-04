/**
 * PAE-based domain decomposition (SPEC §2 extension). AlphaFold's PAE matrix encodes
 * how confident the model is about the relative position of residue pairs — low
 * within a rigid domain, high between domains that can move. We segment the sequence
 * into contiguous domains by recursively splitting where the cross-block PAE is high
 * relative to the within-block PAE.
 *
 * This matters because GLOBAL RMSD is misleading when AlphaFold folds each domain
 * correctly but gets their relative orientation wrong: per-domain superposition then
 * reveals the model is locally excellent. Pure + testable.
 */
export interface DomainRange {
  /** 0-based inclusive PAE indices. */
  start: number;
  end: number;
}

interface SegmentOptions {
  /** Minimum residues per domain. */
  minLen?: number;
  /** Cross-minus-within PAE (Å) required to accept a split. */
  separation?: number;
}

/** 2D prefix-sum for O(1) rectangular block sums over a symmetric PAE matrix. */
function prefixSum(m: number[][]): number[][] {
  const n = m.length;
  const s: number[][] = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      s[i + 1][j + 1] = m[i][j] + s[i][j + 1] + s[i + 1][j] - s[i][j];
    }
  }
  return s;
}

export function segmentDomains(matrix: number[][], opts: SegmentOptions = {}): DomainRange[] {
  const n = matrix.length;
  if (n === 0) return [];
  const minLen = opts.minLen ?? 24;
  const separation = opts.separation ?? 4;

  // Symmetrize (PAE is asymmetric; use the mean of the two directions).
  const sym: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) sym[i][j] = (matrix[i][j] + matrix[j][i]) / 2;
  const ps = prefixSum(sym);

  // Mean over the rectangle [r0..r1] x [c0..c1] (inclusive).
  const blockMean = (r0: number, r1: number, c0: number, c1: number): number => {
    const sum = ps[r1 + 1][c1 + 1] - ps[r0][c1 + 1] - ps[r1 + 1][c0] + ps[r0][c0];
    const area = (r1 - r0 + 1) * (c1 - c0 + 1);
    return area > 0 ? sum / area : 0;
  };

  const out: DomainRange[] = [];
  const recurse = (lo: number, hi: number) => {
    if (hi - lo + 1 < 2 * minLen) {
      out.push({ start: lo, end: hi });
      return;
    }
    let bestK = -1;
    let bestScore = -Infinity;
    for (let k = lo + minLen - 1; k <= hi - minLen; k++) {
      const within = (blockMean(lo, k, lo, k) + blockMean(k + 1, hi, k + 1, hi)) / 2;
      const cross = blockMean(lo, k, k + 1, hi);
      const score = cross - within;
      if (score > bestScore) {
        bestScore = score;
        bestK = k;
      }
    }
    if (bestK >= 0 && bestScore > separation) {
      recurse(lo, bestK);
      recurse(bestK + 1, hi);
    } else {
      out.push({ start: lo, end: hi });
    }
  };
  recurse(0, n - 1);
  return out.sort((a, b) => a.start - b.start);
}
