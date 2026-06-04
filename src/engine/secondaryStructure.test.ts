import { describe, it, expect } from "vitest";
import { assignSecondaryStructure, deviationBySS, type SS } from "./secondaryStructure.ts";

/** Ideal α-helix Cα trace: radius 2.3 Å, 100°/residue, 1.5 Å rise. */
function helix(n: number): Float64Array {
  const c = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = (i * 100 * Math.PI) / 180;
    c[i * 3] = 2.3 * Math.cos(a);
    c[i * 3 + 1] = 2.3 * Math.sin(a);
    c[i * 3 + 2] = i * 1.5;
  }
  return c;
}

/** Extended β-strand Cα trace: ~3.4 Å spacing, slight zig-zag. */
function strand(n: number): Float64Array {
  const c = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = i * 3.4;
    c[i * 3 + 1] = (i % 2) * 0.9;
    c[i * 3 + 2] = 0;
  }
  return c;
}

const count = (ss: SS[], t: SS) => ss.filter((s) => s === t).length;

describe("assignSecondaryStructure", () => {
  it("classifies an ideal helix as mostly H", () => {
    const ss = assignSecondaryStructure(helix(20), 20);
    expect(count(ss, "H")).toBeGreaterThan(12);
    expect(count(ss, "E")).toBe(0);
  });

  it("classifies an ideal strand as mostly E", () => {
    const ss = assignSecondaryStructure(strand(16), 16);
    expect(count(ss, "E")).toBeGreaterThan(8);
    expect(count(ss, "H")).toBe(0);
  });

  it("returns all coil when too short for any window", () => {
    const ss = assignSecondaryStructure(helix(4), 4);
    expect(count(ss, "H")).toBe(0);
    expect(count(ss, "E")).toBe(0);
  });
});

describe("deviationBySS", () => {
  it("groups deviations by secondary-structure type", () => {
    const per = [
      { uniprotNum: 1, deviation: 1 },
      { uniprotNum: 2, deviation: 3 },
      { uniprotNum: 3, deviation: 5 },
    ];
    const map = new Map<number, SS>([[1, "H"], [2, "H"], [3, "E"]]);
    const b = deviationBySS(per, map);
    const helixRow = b.find((x) => x.ss === "H")!;
    expect(helixRow).toMatchObject({ count: 2, meanDeviation: 2 });
    expect(b.find((x) => x.ss === "E")!.meanDeviation).toBe(5);
  });
});
