import { describe, it, expect } from "vitest";
import {
  kabsch,
  applyTransform,
  perResidueDeviations,
  rmsdFromDeviations,
  tmScore,
  gdtTs,
  spearman,
  computeComparison,
  refineTmScore,
  type ComparisonMetrics,
} from "./compare.ts";
import type { Alignment, Mat3 } from "./types.ts";

/** Build interleaved-xyz Float64Array from [x,y,z] triples. */
function coords(triples: number[][]): Float64Array {
  const a = new Float64Array(triples.length * 3);
  triples.forEach(([x, y, z], i) => {
    a[i * 3] = x;
    a[i * 3 + 1] = y;
    a[i * 3 + 2] = z;
  });
  return a;
}

/** Rotate a point by a 3x3 matrix. */
function rot(R: Mat3, x: number, y: number, z: number): [number, number, number] {
  return [
    R[0][0] * x + R[0][1] * y + R[0][2] * z,
    R[1][0] * x + R[1][1] * y + R[1][2] * z,
    R[2][0] * x + R[2][1] * y + R[2][2] * z,
  ];
}

function matMul(A: Mat3, B: Mat3): Mat3 {
  const C: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      C[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
  return C;
}

function det3(m: Mat3): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

// A spread-out, non-collinear point cloud used across rotation tests.
const CLOUD = [
  [0, 0, 0],
  [1.5, 0.2, -0.3],
  [0.1, 2.0, 0.4],
  [-1.0, 0.5, 1.7],
  [2.2, -1.1, 0.9],
  [-0.7, -1.8, -1.2],
  [3.0, 1.0, -2.0],
  [0.4, -0.6, 2.5],
];

describe("kabsch superposition", () => {
  it("recovers a known rotation + translation with ~zero RMSD", () => {
    // 30deg about z, 45deg about y, composed.
    const cz = Math.cos(0.5236),
      sz = Math.sin(0.5236);
    const Rz: Mat3 = [
      [cz, -sz, 0],
      [sz, cz, 0],
      [0, 0, 1],
    ];
    const cy = Math.cos(0.7854),
      sy = Math.sin(0.7854);
    const Ry: Mat3 = [
      [cy, 0, sy],
      [0, 1, 0],
      [-sy, 0, cy],
    ];
    const Rtrue = matMul(Ry, Rz);
    const t: [number, number, number] = [5, -3, 2];

    const p = coords(CLOUD);
    const q = coords(
      CLOUD.map(([x, y, z]) => {
        const [rx, ry, rz] = rot(Rtrue, x, y, z);
        return [rx + t[0], ry + t[1], rz + t[2]];
      }),
    );

    const n = CLOUD.length;
    const sup = kabsch(p, q, n);
    const aligned = applyTransform(p, sup, n);
    const dev = perResidueDeviations(aligned, q, n);
    expect(rmsdFromDeviations(dev)).toBeLessThan(1e-9);

    // Recovered rotation is proper (det = +1), never a reflection.
    expect(det3(sup.rotation)).toBeCloseTo(1, 9);
  });

  it("identical structures give zero deviation everywhere", () => {
    const p = coords(CLOUD);
    const q = coords(CLOUD);
    const n = CLOUD.length;
    const sup = kabsch(p, q, n);
    const dev = perResidueDeviations(applyTransform(p, sup, n), q, n);
    for (const d of dev) expect(d).toBeLessThan(1e-9);
  });

  it("forbids a reflection: a mirrored cloud is fit by a proper rotation", () => {
    const p = coords(CLOUD);
    // Mirror through the xy-plane (z -> -z) is an improper transform; Kabsch must
    // NOT use it, so it returns a proper rotation and a nonzero residual.
    const q = coords(CLOUD.map(([x, y, z]) => [x, y, -z]));
    const n = CLOUD.length;
    const sup = kabsch(p, q, n);
    expect(det3(sup.rotation)).toBeGreaterThan(0); // proper rotation
  });
});

describe("RMSD", () => {
  it("matches a hand-computed value for a fixed displacement", () => {
    // After (no) superposition: shift one of two points by 3 along x while the
    // other coincides. Use the raw distance form via perResidueDeviations.
    const aligned = coords([
      [0, 0, 0],
      [0, 0, 0],
    ]);
    const q = coords([
      [0, 0, 0],
      [3, 0, 0],
    ]);
    const dev = perResidueDeviations(aligned, q, 2);
    // deviations: 0 and 3 -> rmsd = sqrt((0 + 9)/2) = sqrt(4.5)
    expect(rmsdFromDeviations(dev)).toBeCloseTo(Math.sqrt(4.5), 12);
  });
});

describe("TM-score", () => {
  it("is 1.0 when every deviation is zero", () => {
    const dev = new Float64Array([0, 0, 0, 0, 0]);
    expect(tmScore(dev, 5)).toBeCloseTo(1, 12);
  });

  it("matches the closed-form formula for a uniform deviation", () => {
    const L = 100;
    const d0 = 1.24 * Math.cbrt(L - 15) - 1.8;
    const dev = new Float64Array(L).fill(2.0);
    const expected = (1 / L) * L * (1 / (1 + (2.0 / d0) ** 2));
    expect(tmScore(dev, L)).toBeCloseTo(expected, 12);
  });

  it("floors d0 at 0.5 for very small L", () => {
    // L = 16 -> 1.24*cbrt(1) - 1.8 = -0.56, must be clamped to 0.5.
    const dev = new Float64Array([0.5]);
    const tm = tmScore(dev, 16);
    const expected = (1 / 16) * (1 / (1 + (0.5 / 0.5) ** 2)); // d0 = 0.5
    expect(tm).toBeCloseTo(expected, 12);
  });

  it("is penalized when the reference is longer than the matched set", () => {
    // 50 perfectly-matched residues but a reference of 100 -> TM ~ 0.5, not 1.0.
    const dev = new Float64Array(50).fill(0);
    expect(tmScore(dev, 100)).toBeCloseTo(0.5, 12);
  });
});

describe("GDT-TS", () => {
  it("is 1.0 when all deviations are under 1 Å", () => {
    expect(gdtTs(new Float64Array([0.1, 0.5, 0.9]))).toBeCloseTo(1, 12);
  });

  it("averages the four threshold fractions", () => {
    // Deviations chosen to land in distinct bands: 0.5 (<1), 1.5 (<2), 3 (<4), 6 (<8), 9 (none).
    const dev = new Float64Array([0.5, 1.5, 3, 6, 9]);
    // within 1Å: 1/5 ; within 2Å: 2/5 ; within 4Å: 3/5 ; within 8Å: 4/5
    const expected = (1 / 5 + 2 / 5 + 3 / 5 + 4 / 5) / 4;
    expect(gdtTs(dev)).toBeCloseTo(expected, 12);
  });
});

describe("spearman", () => {
  it("is +1 for a perfectly monotonic increasing relationship", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [10, 20, 30, 40, 50];
    expect(spearman(a, b)).toBeCloseTo(1, 12);
  });

  it("is -1 for a perfectly monotonic decreasing relationship", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [50, 40, 30, 20, 10];
    expect(spearman(a, b)).toBeCloseTo(-1, 12);
  });

  it("handles non-linear monotonic data (rank-based, not value-based)", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [1, 4, 9, 16, 25]; // squares: monotonic but nonlinear
    expect(spearman(a, b)).toBeCloseTo(1, 12);
  });

  it("returns NaN when a variable is constant (undefined correlation)", () => {
    expect(Number.isNaN(spearman([1, 1, 1, 1], [1, 2, 3, 4]))).toBe(true);
  });

  it("handles ties with average ranks", () => {
    // Matches scipy.stats.spearmanr([1,2,2,3],[1,2,3,4]) = 0.9486832980505138
    expect(spearman([1, 2, 2, 3], [1, 2, 3, 4])).toBeCloseTo(0.9486832980505138, 10);
  });
});

describe("refineTmScore", () => {
  function interleave(triples: number[][]): Float64Array {
    const a = new Float64Array(triples.length * 3);
    triples.forEach(([x, y, z], i) => { a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z; });
    return a;
  }

  it("equals 1 for identical structures", () => {
    const c = interleave(CLOUD);
    expect(refineTmScore(c, c, CLOUD.length, CLOUD.length)).toBeCloseTo(1, 6);
  });

  it("is >= the plain TM-score when there are outliers dragging the global fit", () => {
    // A well-aligned core of many residues + a few wild outliers. Refinement should
    // fit the core and score at least as well as the global superposition.
    const core: number[][] = [];
    for (let i = 0; i < 40; i++) core.push([i * 1.5, Math.sin(i) * 2, Math.cos(i) * 2]);
    const p = core.map((x) => [...x]);
    const q = core.map((x) => [...x]);
    // 5 outliers: identical index but displaced far in q
    for (let i = 35; i < 40; i++) q[i] = [q[i][0], q[i][1] + 40, q[i][2]];
    const P = interleave(p);
    const Q = interleave(q);
    const n = p.length;
    const sup = kabsch(P, Q, n);
    const plain = tmScore(perResidueDeviations(applyTransform(P, sup, n), Q, n), n);
    const refined = refineTmScore(P, Q, n, n);
    expect(refined).toBeGreaterThanOrEqual(plain - 1e-9);
    expect(refined).toBeGreaterThan(0.5);
  });
});

describe("computeComparison (integration)", () => {
  function buildAlignment(
    p: number[][],
    q: number[][],
    unp: number[],
    plddt: number[],
  ): Alignment {
    return {
      p: coords(p),
      q: coords(q),
      uniprotNums: Int32Array.from(unp),
      plddt: Float64Array.from(plddt),
      refBFactor: new Float64Array(p.length),
      nMatched: p.length,
    };
  }

  it("produces perfect metrics for identical structures", () => {
    const al = buildAlignment(
      CLOUD,
      CLOUD,
      CLOUD.map((_, i) => i + 1),
      CLOUD.map((_, i) => 90 - i),
    );
    const r: ComparisonMetrics = computeComparison(al, { referenceLength: CLOUD.length });
    expect(r.rmsd).toBeLessThan(1e-9);
    expect(r.tmScore).toBeCloseTo(1, 9);
    expect(r.gdtTs).toBeCloseTo(1, 12);
    expect(r.nMatched).toBe(CLOUD.length);
    expect(r.perResidue).toHaveLength(CLOUD.length);
    expect(r.perResidue[0].uniprotNum).toBe(1);
  });

  it("correlates pLDDT with low deviation (confident = accurate)", () => {
    // Displace each residue by a magnitude tied to (100 - pLDDT) along a DISTINCT
    // fixed direction per residue. Independent per-point perturbations cannot be
    // undone by a single rigid superposition, so residual deviation tracks the
    // perturbation magnitude -> low pLDDT pairs with high deviation.
    const plddt = [95, 85, 70, 55, 40, 30, 20, 10];
    const p = CLOUD.map(([x, y, z]) => [x, y, z]);
    const q = CLOUD.map(([x, y, z], i) => {
      const mag = (100 - plddt[i]) * 0.15;
      // A deterministic, varied unit-ish direction per residue.
      const dx = Math.sin(i * 1.7 + 0.3);
      const dy = Math.cos(i * 2.3 + 1.1);
      const dz = Math.sin(i * 0.9 + 2.0);
      const norm = Math.hypot(dx, dy, dz) || 1;
      return [x + (mag * dx) / norm, y + (mag * dy) / norm, z + (mag * dz) / norm];
    });
    const al = buildAlignment(
      p,
      q,
      CLOUD.map((_, i) => i + 1),
      plddt,
    );
    const r = computeComparison(al);
    // High pLDDT should pair with low deviation -> strong NEGATIVE Spearman.
    expect(r.plddtErrorSpearman).toBeLessThan(-0.5);
  });
});
