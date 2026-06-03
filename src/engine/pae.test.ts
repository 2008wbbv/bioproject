import { describe, it, expect } from "vitest";
import { parsePae } from "./pae.ts";

describe("parsePae", () => {
  it("parses the modern matrix form (object)", () => {
    const pae = parsePae({ predicted_aligned_error: [[0, 1], [2, 0]], max_predicted_aligned_error: 31.75 });
    expect(pae).toEqual({ matrix: [[0, 1], [2, 0]], size: 2, max: 31.75 });
  });

  it("parses the array-wrapped form and derives max when missing", () => {
    const pae = parsePae([{ predicted_aligned_error: [[0, 5], [3, 0]] }]);
    expect(pae?.size).toBe(2);
    expect(pae?.max).toBe(5);
  });

  it("parses the legacy sparse triplet form", () => {
    const pae = parsePae({ residue1: [1, 1, 2, 2], residue2: [1, 2, 1, 2], distance: [0, 4, 6, 0] });
    expect(pae?.size).toBe(2);
    expect(pae?.matrix[1][0]).toBe(6);
    expect(pae?.max).toBe(6);
  });

  it("returns null for unrecognized input", () => {
    expect(parsePae({ foo: 1 })).toBeNull();
    expect(parsePae(null)).toBeNull();
  });
});
