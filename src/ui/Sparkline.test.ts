import { describe, it, expect } from "vitest";
import { sparklinePath } from "./Sparkline.tsx";

describe("sparklinePath", () => {
  it("returns empty for no values", () => {
    expect(sparklinePath([], 100, 20)).toBe("");
  });

  it("draws a flat mid-line for a single value", () => {
    expect(sparklinePath([5], 100, 20)).toBe("M1,10 L99,10");
  });

  it("maps min to the bottom and max to the top", () => {
    const d = sparklinePath([0, 10], 100, 20, 1);
    // first point (min=0) at y = height-pad = 19; second (max) at y = pad = 1
    expect(d.startsWith("M1.0,19.0")).toBe(true);
    expect(d).toContain("L99.0,1.0");
  });

  it("produces one command per value", () => {
    const d = sparklinePath([1, 2, 3, 4], 100, 20);
    expect((d.match(/[ML]/g) || []).length).toBe(4);
  });
});
