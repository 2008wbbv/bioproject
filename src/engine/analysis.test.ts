import { describe, it, expect } from "vitest";
import { plddtBands, confidentlyWrong, deviationStats, divergentRegions, calibrationCurve } from "./analysis.ts";
import type { PerResidue } from "./types.ts";

const pr = (uniprotNum: number, plddt: number, deviation: number): PerResidue => ({ uniprotNum, plddt, deviation });

describe("plddtBands", () => {
  it("bins residues into the standard AlphaFold confidence bands", () => {
    const b = plddtBands([pr(1, 95, 0), pr(2, 80, 0), pr(3, 60, 0), pr(4, 40, 0), pr(5, 90, 0)]);
    // 90 is the boundary: >90 is veryHigh, so 90 falls into confident (>=70).
    expect(b).toEqual({ veryHigh: 1, confident: 2, low: 1, veryLow: 1, total: 5 });
  });
});

describe("confidentlyWrong", () => {
  it("finds high-confidence high-deviation residues, worst first", () => {
    const data = [
      pr(1, 95, 8.0), // confident & wrong
      pr(2, 92, 4.0), // confident & wrong
      pr(3, 95, 0.5), // confident & right -> excluded
      pr(4, 40, 12.0), // wrong but low confidence -> excluded
    ];
    const w = confidentlyWrong(data);
    expect(w.map((r) => r.uniprotNum)).toEqual([1, 2]);
  });

  it("respects custom thresholds and limit", () => {
    const data = [pr(1, 80, 5), pr(2, 85, 9), pr(3, 88, 7)];
    expect(confidentlyWrong(data, { limit: 2 }).map((r) => r.uniprotNum)).toEqual([2, 3]);
  });
});

describe("deviationStats", () => {
  it("computes mean, median, max and fraction within 2 Å", () => {
    const s = deviationStats([pr(1, 0, 1), pr(2, 0, 2), pr(3, 0, 3), pr(4, 0, 6)]);
    expect(s.mean).toBeCloseTo(3, 6);
    expect(s.median).toBeCloseTo(2.5, 6);
    expect(s.max).toBe(6);
    expect(s.fractionWithin2).toBeCloseTo(0.5, 6); // 1 and 2 are <=2
  });

  it("handles empty input", () => {
    expect(deviationStats([])).toEqual({ mean: 0, median: 0, max: 0, fractionWithin2: 0 });
  });
});

describe("divergentRegions", () => {
  it("finds contiguous high-deviation stretches of at least minLen", () => {
    const data = [
      pr(10, 80, 0.5), // ok
      pr(11, 80, 5), pr(12, 80, 6), pr(13, 80, 7), // region 11-13
      pr(14, 80, 0.5), // ok
      pr(20, 80, 8), pr(21, 80, 9), // too short (len 2) with minLen 3
    ];
    const regions = divergentRegions(data, { devMin: 3, minLen: 3 });
    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({ start: 11, end: 13, length: 3 });
    expect(regions[0].maxDeviation).toBe(7);
  });

  it("tolerates a single-residue gap within a region", () => {
    // residue 12 missing entirely, 13 low — but 11,14,15,16 high with maxGap default.
    const data = [pr(11, 80, 5), pr(13, 80, 6), pr(14, 80, 6), pr(15, 80, 6)];
    const regions = divergentRegions(data, { devMin: 3, minLen: 3, maxGap: 1 });
    expect(regions[0]).toMatchObject({ start: 11, end: 15 });
  });

  it("returns nothing when no region qualifies", () => {
    expect(divergentRegions([pr(1, 90, 0.2), pr(2, 90, 0.3)], { devMin: 3 })).toEqual([]);
  });
});

describe("calibrationCurve", () => {
  it("bins by pLDDT and averages deviation per bin", () => {
    const data = [
      { plddt: 95, deviation: 0.5 },
      { plddt: 92, deviation: 1.5 },
      { plddt: 45, deviation: 8 },
      { plddt: 42, deviation: 6 },
    ];
    const curve = calibrationCurve(data, 10);
    const hi = curve.find((b) => b.plddtLo === 90)!;
    const lo = curve.find((b) => b.plddtLo === 40)!;
    expect(hi.n).toBe(2);
    expect(hi.meanDeviation).toBeCloseTo(1.0, 6);
    expect(hi.fractionCorrect).toBeCloseTo(1, 6); // both within 2 Å
    expect(lo.meanDeviation).toBeCloseTo(7, 6);
    expect(lo.fractionCorrect).toBe(0);
  });

  it("omits empty bins", () => {
    expect(calibrationCurve([{ plddt: 95, deviation: 1 }], 10)).toHaveLength(1);
  });
});
