import { describe, it, expect } from "vitest";
import { lddt } from "./lddt.ts";

function coords(triples: number[][]): Float64Array {
  const a = new Float64Array(triples.length * 3);
  triples.forEach(([x, y, z], i) => {
    a[i * 3] = x;
    a[i * 3 + 1] = y;
    a[i * 3 + 2] = z;
  });
  return a;
}

const CLOUD = [
  [0, 0, 0], [3.8, 0, 0], [7.0, 1.5, 0], [9.5, 4.0, 1], [8.0, 7.0, 2], [4.5, 8.0, 1],
];

describe("lddt", () => {
  it("is 1.0 for identical structures", () => {
    const c = coords(CLOUD);
    const r = lddt(c, c, CLOUD.length);
    expect(r.global).toBeCloseTo(1, 12);
    for (const v of r.perResidue) if (!Number.isNaN(v)) expect(v).toBeCloseTo(1, 12);
  });

  it("is superposition-invariant (rotation/translation of the whole model)", () => {
    const c = coords(CLOUD);
    // rotate model 90° about z and translate — lDDT (distance-based) must be unchanged
    const rot = coords(CLOUD.map(([x, y, z]) => [-y + 100, x - 50, z + 7]));
    expect(lddt(rot, c, CLOUD.length).global).toBeCloseTo(1, 12);
  });

  it("drops below 1 when a residue is locally displaced", () => {
    const ref = coords(CLOUD);
    const model = coords(CLOUD.map((p, i) => (i === 2 ? [p[0] + 3, p[1], p[2]] : p)));
    const r = lddt(model, ref, CLOUD.length);
    expect(r.global).toBeLessThan(1);
    expect(r.perResidue[2]).toBeLessThan(1); // the moved residue scores worst
    expect(r.perResidue[0]).toBeGreaterThan(r.perResidue[2]);
  });

  it("ignores pairs beyond the inclusion radius", () => {
    // Two residues 20 Å apart with nothing else -> no neighbours within R0 -> global 0.
    const ref = coords([[0, 0, 0], [20, 0, 0]]);
    const model = coords([[0, 0, 0], [25, 0, 0]]);
    expect(lddt(model, ref, 2).global).toBe(0);
  });
});
