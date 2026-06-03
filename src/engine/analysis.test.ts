import { describe, it, expect } from "vitest";
import { plddtBands, confidentlyWrong, deviationStats } from "./analysis.ts";
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
