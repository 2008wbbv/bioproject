import { describe, it, expect } from "vitest";
import { composeAffine, transformPdb, rewriteBFactorByAuthNum } from "./pdbTransform.ts";
import type { Mat3, Superposition } from "./types.ts";

const IDENTITY: Mat3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

/** A column-exact ATOM line with given coords, B-factor and residue number. */
function atom(resSeq: number, x: number, y: number, z: number, b: number): string {
  const buf = Array<string>(80).fill(" ");
  const put = (s: number, str: string) => {
    for (let i = 0; i < str.length; i++) buf[s + i] = str[i];
  };
  const putR = (s: number, e: number, str: string) => {
    const t = str.slice(0, e - s);
    for (let i = 0; i < t.length; i++) buf[s + (e - s - t.length) + i] = t[i];
  };
  put(0, "ATOM");
  put(13, "CA");
  put(17, "ALA");
  buf[21] = "A";
  putR(22, 26, String(resSeq));
  putR(30, 38, x.toFixed(3));
  putR(38, 46, y.toFixed(3));
  putR(46, 54, z.toFixed(3));
  putR(54, 60, "1.00");
  putR(60, 66, b.toFixed(2));
  return buf.join("");
}

const readXYZ = (line: string): [number, number, number] => [
  Number.parseFloat(line.slice(30, 38)),
  Number.parseFloat(line.slice(38, 46)),
  Number.parseFloat(line.slice(46, 54)),
];
const readB = (line: string): number => Number.parseFloat(line.slice(60, 66));

describe("composeAffine", () => {
  it("yields zero translation for an identity superposition at the origin", () => {
    const sup: Superposition = { rotation: IDENTITY, centroidP: [0, 0, 0], centroidQ: [0, 0, 0] };
    const { r, t } = composeAffine(sup);
    expect(r).toEqual(IDENTITY);
    expect(t).toEqual([0, 0, 0]);
  });

  it("folds centroid recentering into the translation: t = cQ - R·cP", () => {
    const sup: Superposition = { rotation: IDENTITY, centroidP: [1, 2, 3], centroidQ: [10, 20, 30] };
    expect(composeAffine(sup).t).toEqual([9, 18, 27]);
  });
});

describe("transformPdb", () => {
  it("leaves coordinates unchanged under an identity transform", () => {
    const pdb = atom(1, 12.345, -6.789, 0.123, 50);
    const sup: Superposition = { rotation: IDENTITY, centroidP: [0, 0, 0], centroidQ: [0, 0, 0] };
    const [x, y, z] = readXYZ(transformPdb(pdb, sup).split("\n")[0]);
    expect(x).toBeCloseTo(12.345, 3);
    expect(y).toBeCloseTo(-6.789, 3);
    expect(z).toBeCloseTo(0.123, 3);
  });

  it("applies a 90° rotation about z plus a translation", () => {
    // R_z(90): (x,y,z) -> (-y, x, z). centroidP=0, centroidQ=(5,0,0) -> +5 on x.
    const Rz: Mat3 = [
      [0, -1, 0],
      [1, 0, 0],
      [0, 0, 1],
    ];
    const sup: Superposition = { rotation: Rz, centroidP: [0, 0, 0], centroidQ: [5, 0, 0] };
    const out = transformPdb(atom(1, 2, 3, 4, 50), sup).split("\n")[0];
    const [x, y, z] = readXYZ(out);
    expect(x).toBeCloseTo(-3 + 5, 3); // -y + 5
    expect(y).toBeCloseTo(2, 3); // x
    expect(z).toBeCloseTo(4, 3);
  });

  it("preserves the B-factor column and non-coordinate text", () => {
    const sup: Superposition = { rotation: IDENTITY, centroidP: [0, 0, 0], centroidQ: [0, 0, 0] };
    const out = transformPdb(atom(7, 1, 1, 1, 88.5), sup).split("\n")[0];
    expect(readB(out)).toBeCloseTo(88.5, 2);
    expect(out.slice(17, 20)).toBe("ALA");
  });
});

describe("rewriteBFactorByAuthNum", () => {
  it("writes per-residue values into the B-factor column", () => {
    const pdb = [atom(10, 0, 0, 0, 99), atom(11, 0, 0, 0, 99), atom(12, 0, 0, 0, 99)].join("\n");
    const map = new Map([
      [10, 1.5],
      [12, 8.25],
    ]);
    const lines = rewriteBFactorByAuthNum(pdb, map, 0).split("\n");
    expect(readB(lines[0])).toBeCloseTo(1.5, 2);
    expect(readB(lines[1])).toBeCloseTo(0, 2); // not in map -> fallback
    expect(readB(lines[2])).toBeCloseTo(8.25, 2);
  });

  it("does not corrupt coordinates", () => {
    const pdb = atom(10, 3.21, 6.54, 9.87, 99);
    const out = rewriteBFactorByAuthNum(pdb, new Map([[10, 2.0]]), 0).split("\n")[0];
    expect(readXYZ(out)).toEqual([3.21, 6.54, 9.87]);
  });
});
