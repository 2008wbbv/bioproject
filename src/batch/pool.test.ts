import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "./pool.ts";

describe("mapWithConcurrency", () => {
  it("processes every item and preserves input order", async () => {
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => n * 10);
    expect(results.map((r) => r.value)).toEqual([10, 20, 30, 40, 50]);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("never exceeds the concurrency limit", async () => {
    let active = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 12 }, (_, i) => i), 3, async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });
    expect(peak).toBeLessThanOrEqual(3);
  });

  it("captures per-item failures without aborting the batch", async () => {
    const results = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error("boom");
      return n;
    });
    expect(results[0]).toMatchObject({ ok: true, value: 1 });
    expect(results[1].ok).toBe(false);
    expect(results[1].error?.message).toBe("boom");
    expect(results[2]).toMatchObject({ ok: true, value: 3 });
  });

  it("fires onSettled for each item", async () => {
    const settled: number[] = [];
    await mapWithConcurrency([1, 2, 3], 1, async (n) => n, (r) => settled.push(r.index));
    expect(settled.sort()).toEqual([0, 1, 2]);
  });
});
