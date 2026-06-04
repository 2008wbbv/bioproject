import { describe, it, expect } from "vitest";
import { perDomainCompare } from "./perDomain.ts";
import type { MatchedCoords } from "../api/pipeline.ts";

/** Rotate a point 90° about z. */
const rotZ = (x: number, y: number, z: number): [number, number, number] => [-y, x, z];

describe("perDomainCompare", () => {
  it("recovers near-zero RMSD per domain even when domains are mutually rotated", () => {
    // Domain A (res 1-5): identical in P and Q.
    // Domain B (res 6-10): identical shape but rotated 90° about z in Q only —
    // a per-domain superposition should still fit it (RMSD ~ 0), while a global
    // fit could not.
    const uniprotNums: number[] = [];
    const p: number[] = [];
    const q: number[] = [];
    const base = [
      [0, 0, 0], [1, 0.3, 0.2], [2, -0.4, 0.5], [0.5, 1.5, -0.3], [1.8, 1.1, 0.7],
    ];
    // Domain A
    base.forEach(([x, y, z], i) => {
      uniprotNums.push(i + 1);
      p.push(x, y, z);
      q.push(x, y, z);
    });
    // Domain B: Q is the rotated copy, translated far away
    base.forEach(([x, y, z], i) => {
      uniprotNums.push(i + 6);
      p.push(x + 50, y, z);
      const [rx, ry, rz] = rotZ(x, y, z);
      q.push(rx - 50, ry + 80, rz);
    });
    const matched: MatchedCoords = { uniprotNums, p, q };

    const res = perDomainCompare(matched, [
      { start: 1, end: 5 },
      { start: 6, end: 10 },
    ]);
    expect(res).toHaveLength(2);
    expect(res[0].rmsd).toBeLessThan(1e-6);
    expect(res[1].rmsd).toBeLessThan(1e-6); // per-domain fit removes the rotation
    expect(res[0].nMatched).toBe(5);
  });

  it("returns NaN metrics for a domain with too few matched residues", () => {
    const matched: MatchedCoords = { uniprotNums: [1, 2], p: [0, 0, 0, 1, 0, 0], q: [0, 0, 0, 1, 0, 0] };
    const [r] = perDomainCompare(matched, [{ start: 1, end: 2 }]);
    expect(r.nMatched).toBe(2);
    expect(Number.isNaN(r.rmsd)).toBe(true);
  });
});
