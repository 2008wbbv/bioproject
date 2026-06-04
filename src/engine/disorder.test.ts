import { describe, it, expect } from "vitest";
import { disorderedRegions, plddtSummary } from "./disorder.ts";

const r = (uniprotNum: number, plddt: number) => ({ uniprotNum, plddt });

describe("disorderedRegions", () => {
  it("finds contiguous low-pLDDT stretches of at least minLen", () => {
    const data = [
      ...Array.from({ length: 20 }, (_, i) => r(i + 1, 95)), // ordered
      ...Array.from({ length: 15 }, (_, i) => r(i + 21, 30)), // disordered 21-35
      ...Array.from({ length: 20 }, (_, i) => r(i + 36, 90)), // ordered
    ];
    const regions = disorderedRegions(data, { maxPlddt: 50, minLen: 10 });
    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({ start: 21, end: 35, length: 15 });
    expect(regions[0].meanPlddt).toBeCloseTo(30, 6);
  });

  it("ignores short low-confidence dips below minLen", () => {
    const data = [r(1, 90), r(2, 30), r(3, 30), r(4, 90)];
    expect(disorderedRegions(data, { minLen: 10 })).toEqual([]);
  });

  it("returns regions longest-first", () => {
    const data = [
      ...Array.from({ length: 12 }, (_, i) => r(i + 1, 20)), // len 12
      ...Array.from({ length: 5 }, (_, i) => r(i + 13, 90)),
      ...Array.from({ length: 25 }, (_, i) => r(i + 18, 20)), // len 25
    ];
    const regions = disorderedRegions(data, { minLen: 10 });
    expect(regions[0].length).toBe(25);
    expect(regions[1].length).toBe(12);
  });
});

describe("plddtSummary", () => {
  it("computes mean and band fractions", () => {
    const s = plddtSummary([95, 80, 60, 40, 30]);
    expect(s.mean).toBeCloseTo(61, 6);
    expect(s.fractionDisordered).toBeCloseTo(2 / 5, 6); // 40, 30
    expect(s.fractionConfident).toBeCloseTo(2 / 5, 6); // 95, 80
    expect(s.fractionVeryHigh).toBeCloseTo(1 / 5, 6); // 95
  });

  it("handles empty input", () => {
    expect(plddtSummary([])).toMatchObject({ n: 0, mean: 0 });
  });
});
