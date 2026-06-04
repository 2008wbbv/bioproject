import { describe, it, expect } from "vitest";
import { segmentDomains } from "./paeDomains.ts";

/** Build a block-diagonal PAE: `within` inside each block, `between` across. */
function blockPae(sizes: number[], within: number, between: number): number[][] {
  const n = sizes.reduce((a, b) => a + b, 0);
  const block = new Array(n);
  let idx = 0;
  sizes.forEach((s, b) => {
    for (let k = 0; k < s; k++) block[idx++] = b;
  });
  const m: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) m[i][j] = block[i] === block[j] ? within : between;
  return m;
}

describe("segmentDomains", () => {
  it("splits a clear two-domain PAE at the boundary", () => {
    const m = blockPae([50, 50], 2, 28);
    const domains = segmentDomains(m, { minLen: 20, separation: 5 });
    expect(domains).toHaveLength(2);
    expect(domains[0]).toEqual({ start: 0, end: 49 });
    expect(domains[1]).toEqual({ start: 50, end: 99 });
  });

  it("finds three domains", () => {
    const m = blockPae([40, 40, 40], 1.5, 25);
    const domains = segmentDomains(m, { minLen: 20, separation: 5 });
    expect(domains.map((d) => d.end)).toEqual([39, 79, 119]);
  });

  it("returns a single domain when PAE is uniformly low", () => {
    const m = blockPae([60, 60], 2, 2);
    expect(segmentDomains(m, { minLen: 20, separation: 5 })).toHaveLength(1);
  });

  it("respects minLen (won't cut tiny domains)", () => {
    const m = blockPae([10, 90], 2, 28);
    const domains = segmentDomains(m, { minLen: 24, separation: 5 });
    expect(domains).toHaveLength(1); // 10-residue block is below minLen
  });

  it("handles an empty matrix", () => {
    expect(segmentDomains([])).toEqual([]);
  });
});
