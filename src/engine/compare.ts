/**
 * The comparison engine: pure math, fully unit-tested. SPEC.md §5.
 *
 * This is the primary path. It produces every metric on its own; the tmalign-wasm
 * backend (Phase 3) is validation + an optional alternative, never a dependency.
 *
 * Coordinates are interleaved-xyz Float64Arrays of length 3n (P = AlphaFold/moving,
 * Q = experimental/reference), matching the alignment output in align.ts.
 */
import { Matrix, SingularValueDecomposition } from "ml-matrix";
import type { Alignment, Mat3, PerResidue, Superposition } from "./types.ts";
import { lddt } from "./lddt.ts";

/** GDT-TS distance thresholds in angstroms. */
const GDT_THRESHOLDS = [1, 2, 4, 8] as const;

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function centroid(coords: Float64Array, n: number): Vec3 {
  let x = 0,
    y = 0,
    z = 0;
  for (let i = 0; i < n; i++) {
    x += coords[i * 3];
    y += coords[i * 3 + 1];
    z += coords[i * 3 + 2];
  }
  return { x: x / n, y: y / n, z: z / n };
}

function det3(m: number[][]): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

/**
 * Kabsch optimal-rotation superposition of moving P onto reference Q. SPEC.md §5.
 *
 *   1. Centroids of P and Q; center both.
 *   2. Covariance H = P'ᵀ Q'  (3x3).
 *   3. SVD H = U S Vᵀ.
 *   4. d = sign(det(V Uᵀ)) to forbid a reflection (improper rotation).
 *   5. R = V · diag(1, 1, d) · Uᵀ.
 *
 * Returns the transform; apply with `applyTransform`. Requires n >= 1, but a
 * meaningful rotation needs n >= 3 non-collinear points (caller's responsibility).
 */
export function kabsch(p: Float64Array, q: Float64Array, n: number): Superposition {
  const cp = centroid(p, n);
  const cq = centroid(q, n);

  // Accumulate covariance H = sum_i P'_i (Q'_i)ᵀ  -> H[a][b] = sum p'_a q'_b.
  const H = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < n; i++) {
    const px = p[i * 3] - cp.x;
    const py = p[i * 3 + 1] - cp.y;
    const pz = p[i * 3 + 2] - cp.z;
    const qx = q[i * 3] - cq.x;
    const qy = q[i * 3 + 1] - cq.y;
    const qz = q[i * 3 + 2] - cq.z;
    H[0][0] += px * qx;
    H[0][1] += px * qy;
    H[0][2] += px * qz;
    H[1][0] += py * qx;
    H[1][1] += py * qy;
    H[1][2] += py * qz;
    H[2][0] += pz * qx;
    H[2][1] += pz * qy;
    H[2][2] += pz * qz;
  }

  const svd = new SingularValueDecomposition(new Matrix(H), { autoTranspose: false });
  const U = svd.leftSingularVectors.to2DArray(); // 3x3
  const V = svd.rightSingularVectors.to2DArray(); // 3x3

  // d corrects a reflection: sign(det(V Uᵀ)) = sign(det(V) det(U)).
  const d = Math.sign(det3(V) * det3(U)) || 1;

  // R = V · diag(1,1,d) · Uᵀ. diag scales column 2 of V by d; then times Uᵀ.
  const Vd = [
    [V[0][0], V[0][1], V[0][2] * d],
    [V[1][0], V[1][1], V[1][2] * d],
    [V[2][0], V[2][1], V[2][2] * d],
  ];
  const R: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++) {
    for (let k = 0; k < 3; k++) {
      // R[i][k] = sum_j Vd[i][j] * (Uᵀ)[j][k] = sum_j Vd[i][j] * U[k][j]
      R[i][k] = Vd[i][0] * U[k][0] + Vd[i][1] * U[k][1] + Vd[i][2] * U[k][2];
    }
  }

  return {
    rotation: R,
    centroidP: [cp.x, cp.y, cp.z],
    centroidQ: [cq.x, cq.y, cq.z],
  };
}

/** Apply a superposition to moving coordinates P, returning new interleaved xyz. */
export function applyTransform(p: Float64Array, sup: Superposition, n: number): Float64Array {
  const out = new Float64Array(n * 3);
  const R = sup.rotation;
  const [cpx, cpy, cpz] = sup.centroidP;
  const [cqx, cqy, cqz] = sup.centroidQ;
  for (let i = 0; i < n; i++) {
    const x = p[i * 3] - cpx;
    const y = p[i * 3 + 1] - cpy;
    const z = p[i * 3 + 2] - cpz;
    out[i * 3] = R[0][0] * x + R[0][1] * y + R[0][2] * z + cqx;
    out[i * 3 + 1] = R[1][0] * x + R[1][1] * y + R[1][2] * z + cqy;
    out[i * 3 + 2] = R[2][0] * x + R[2][1] * y + R[2][2] * z + cqz;
  }
  return out;
}

/** Per-residue CA-CA distances (angstroms) between aligned P and reference Q. */
export function perResidueDeviations(alignedP: Float64Array, q: Float64Array, n: number): Float64Array {
  const dev = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const dx = alignedP[i * 3] - q[i * 3];
    const dy = alignedP[i * 3 + 1] - q[i * 3 + 1];
    const dz = alignedP[i * 3 + 2] - q[i * 3 + 2];
    dev[i] = Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return dev;
}

/** RMSD over matched CA atoms from their per-residue deviations. */
export function rmsdFromDeviations(dev: Float64Array): number {
  if (dev.length === 0) return 0;
  let s = 0;
  for (const d of dev) s += d * d;
  return Math.sqrt(s / dev.length);
}

/**
 * TM-score on the native sequence correspondence under the optimal CA superposition.
 *
 *   d0 = 1.24 * cbrt(L - 15) - 1.8     (floored at ~0.5 for small L)
 *   TM = (1 / L) * Σ_i 1 / (1 + (d_i / d0)^2)
 *
 * NOTE (honesty, per SPEC.md §5): real TM-align iteratively re-superposes to
 * MAXIMIZE TM, which can nudge the value slightly higher. For two models of the
 * same protein the gap is small; the tmalign-wasm backend measures it (Phase 3).
 * L is the reference (experimental) residue count — pass it explicitly; unmatched
 * reference residues correctly drag the score down.
 */
export function tmScore(dev: Float64Array, referenceLength: number): number {
  const L = referenceLength;
  if (L <= 0) return 0;
  const d0 = Math.max(0.5, 1.24 * Math.cbrt(L - 15) - 1.8);
  let sum = 0;
  for (const d of dev) {
    sum += 1 / (1 + (d / d0) * (d / d0));
  }
  return sum / L;
}

/** GDT-TS: mean of the fractions of matched CAs within 1, 2, 4, 8 Å. SPEC.md §5. */
export function gdtTs(dev: Float64Array): number {
  if (dev.length === 0) return 0;
  let acc = 0;
  for (const t of GDT_THRESHOLDS) {
    let within = 0;
    for (const d of dev) if (d <= t) within += 1;
    acc += within / dev.length;
  }
  return acc / GDT_THRESHOLDS.length;
}

/** Average (tie-corrected, 1-based) ranks of an array. */
function rankData(x: ArrayLike<number>): Float64Array {
  const n = x.length;
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => x[a] - x[b]);
  const ranks = new Float64Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && x[idx[j + 1]] === x[idx[i]]) j++;
    const avgRank = (i + j) / 2 + 1; // 1-based average rank over the tie block
    for (let k = i; k <= j; k++) ranks[idx[k]] = avgRank;
    i = j + 1;
  }
  return ranks;
}

function pearson(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = a.length;
  if (n === 0) return Number.NaN;
  let ma = 0,
    mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let cov = 0,
    va = 0,
    vb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  if (va === 0 || vb === 0) return Number.NaN; // undefined when a variable is constant
  return cov / Math.sqrt(va * vb);
}

/**
 * Spearman rank correlation: rank both vectors (tie-corrected) then Pearson on the
 * ranks. SPEC.md §5. Returns NaN when undefined (constant input); the caller turns
 * that into a warning rather than a misleading 0.
 */
export function spearman(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) throw new Error("spearman: length mismatch");
  return pearson(rankData(a), rankData(b));
}

/** Metrics produced by the native engine for one matched alignment. */
export interface ComparisonMetrics {
  nMatched: number;
  rmsd: number;
  tmScore: number;
  gdtTs: number;
  /** Global lDDT in [0,1] (superposition-free). */
  lddt: number;
  /** Spearman(pLDDT, deviation). The scientific payload. NaN if undefined. */
  plddtErrorSpearman: number;
  perResidue: PerResidue[];
  superposition: Superposition;
  /** Per-residue deviations, parallel to the alignment, for the viewer/heatmap. */
  deviations: Float64Array;
}

/**
 * Full native comparison over a matched alignment: superpose, then compute every
 * metric. `referenceLength` is the experimental structure's residue count for the
 * TM-score normalization (defaults to nMatched if not supplied).
 */
export function computeComparison(
  alignment: Alignment,
  opts: { referenceLength?: number } = {},
): ComparisonMetrics {
  const { p, q, uniprotNums, plddt, refBFactor, nMatched } = alignment;
  const sup = kabsch(p, q, nMatched);
  const alignedP = applyTransform(p, sup, nMatched);
  const deviations = perResidueDeviations(alignedP, q, nMatched);
  // lDDT is superposition-free: computed from the raw (un-superposed) coordinates.
  const local = lddt(p, q, nMatched);

  const referenceLength = opts.referenceLength ?? nMatched;
  const perResidue: PerResidue[] = [];
  for (let i = 0; i < nMatched; i++) {
    perResidue.push({
      uniprotNum: uniprotNums[i],
      deviation: deviations[i],
      plddt: plddt[i],
      lddt: local.perResidue[i],
      expBFactor: refBFactor[i],
    });
  }

  return {
    nMatched,
    rmsd: rmsdFromDeviations(deviations),
    tmScore: tmScore(deviations, referenceLength),
    gdtTs: gdtTs(deviations),
    lddt: local.global,
    plddtErrorSpearman: spearman(plddt, deviations),
    perResidue,
    superposition: sup,
    deviations,
  };
}
