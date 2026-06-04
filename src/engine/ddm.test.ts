import { describe, it, expect } from "vitest";
import { distanceDifferenceMatrix } from "./ddm.ts";

const cloud = [0, 0, 0, 3.8, 0, 0, 7, 1.5, 0, 9.5, 4, 1, 8, 7, 2];

describe("distanceDifferenceMatrix", () => {
  it("is all zeros for identical structures", () => {
    const m = distanceDifferenceMatrix(cloud, cloud, 5);
    expect(m.size).toBe(5);
    expect([...m.data].every((v) => v === 0)).toBe(true);
  });

  it("is symmetric and zero on the diagonal", () => {
    const model = cloud.slice();
    model[6] += 4; // move residue 2 (index 2) along x
    const m = distanceDifferenceMatrix(model, cloud, 5);
    const n = m.size;
    for (let i = 0; i < n; i++) {
      expect(m.data[i * n + i]).toBe(0);
      for (let j = 0; j < n; j++) expect(m.data[i * n + j]).toBeCloseTo(m.data[j * n + i], 9);
    }
    expect(m.maxAbs).toBeGreaterThan(0);
  });

  it("flags the moved residue's pair distances as changed", () => {
    const model = cloud.slice();
    model[6] += 4;
    const m = distanceDifferenceMatrix(model, cloud, 5);
    // residue 2 vs residue 0 distance changed
    expect(Math.abs(m.data[2 * 5 + 0])).toBeGreaterThan(0.5);
    // residues 0 and 1 (both unmoved) unchanged
    expect(m.data[0 * 5 + 1]).toBeCloseTo(0, 9);
  });
});
