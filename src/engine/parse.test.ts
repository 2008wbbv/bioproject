import { describe, it, expect } from "vitest";
import { parsePdb } from "./parse.ts";

/**
 * Build a column-exact PDB ATOM/HETATM line (v3.3) by writing into a fixed-width
 * char buffer, so the fixed-column parser is exercised against valid input.
 */
interface AtomFields {
  record?: "ATOM" | "HETATM";
  serial?: number;
  name: string;
  altLoc?: string;
  resName: string;
  chain?: string;
  resSeq: number;
  iCode?: string;
  x: number;
  y: number;
  z: number;
  b?: number;
}

function atomLine(o: AtomFields): string {
  const line = Array<string>(80).fill(" ");
  const put = (start: number, str: string) => {
    for (let i = 0; i < str.length; i++) line[start + i] = str[i];
  };
  const putRight = (start: number, end: number, str: string) => {
    const s = str.slice(0, end - start);
    const pad = end - start - s.length;
    for (let i = 0; i < s.length; i++) line[start + pad + i] = s[i];
  };
  put(0, o.record ?? "ATOM");
  putRight(6, 11, String(o.serial ?? 1));
  // Atom names < 4 chars conventionally start at column 14 (index 13).
  if (o.name.length >= 4) put(12, o.name.slice(0, 4));
  else put(13, o.name);
  if (o.altLoc) line[16] = o.altLoc;
  put(17, o.resName);
  line[21] = o.chain ?? "A";
  putRight(22, 26, String(o.resSeq));
  if (o.iCode) line[26] = o.iCode;
  putRight(30, 38, o.x.toFixed(3));
  putRight(38, 46, o.y.toFixed(3));
  putRight(46, 54, o.z.toFixed(3));
  putRight(54, 60, "1.00");
  putRight(60, 66, (o.b ?? 0).toFixed(2));
  return line.join("");
}

/** A minimal valid residue: N, CA, C, O backbone atoms. */
function residueLines(resName: string, resSeq: number, ca: [number, number, number], b: number, chain = "A"): string[] {
  const [x, y, z] = ca;
  return [
    atomLine({ name: "N", resName, resSeq, chain, x: x - 1, y, z, b }),
    atomLine({ name: "CA", resName, resSeq, chain, x, y, z, b }),
    atomLine({ name: "C", resName, resSeq, chain, x: x + 1, y, z, b }),
    atomLine({ name: "O", resName, resSeq, chain, x: x + 1, y: y + 1, z, b }),
  ];
}

describe("parsePdb", () => {
  it("extracts residues with CA coordinates and B-factor (pLDDT)", () => {
    const pdb = [
      ...residueLines("MET", 1, [10, 20, 30], 88.5),
      ...residueLines("ALA", 2, [11, 21, 31], 92.0),
      ...residueLines("GLY", 3, [12, 22, 32], 45.3),
    ].join("\n");

    const { residues } = parsePdb(pdb);
    expect(residues).toHaveLength(3);
    expect(residues[0]).toMatchObject({
      authNum: 1,
      chain: "A",
      resName: "MET",
      bFactor: 88.5,
    });
    expect(residues[0].caXyz).toEqual([10, 20, 30]);
    expect(residues[1].bFactor).toBe(92.0);
    expect(residues[2].caXyz).toEqual([12, 22, 32]);
    // uniprotNum is left null by the parser (assigned later).
    expect(residues[0].uniprotNum).toBeNull();
  });

  it("keeps a residue with no CA but reports caXyz as null", () => {
    const pdb = [
      atomLine({ name: "N", resName: "SER", resSeq: 5, x: 1, y: 2, z: 3, b: 30 }),
      atomLine({ name: "C", resName: "SER", resSeq: 5, x: 2, y: 2, z: 3, b: 30 }),
    ].join("\n");
    const { residues } = parsePdb(pdb);
    expect(residues).toHaveLength(1);
    expect(residues[0].caXyz).toBeNull();
  });

  it("takes the first accepted altLoc CA and ignores alternates", () => {
    const pdb = [
      atomLine({ name: "CA", altLoc: "A", resName: "LEU", resSeq: 7, x: 5, y: 5, z: 5, b: 70 }),
      atomLine({ name: "CA", altLoc: "B", resName: "LEU", resSeq: 7, x: 9, y: 9, z: 9, b: 60 }),
    ].join("\n");
    const { residues } = parsePdb(pdb);
    expect(residues).toHaveLength(1);
    expect(residues[0].caXyz).toEqual([5, 5, 5]);
    expect(residues[0].bFactor).toBe(70);
  });

  it("flags a real ligand and ignores water + crystallization junk", () => {
    const pdb = [
      ...residueLines("MET", 1, [0, 0, 0], 80),
      atomLine({ record: "HETATM", name: "O", resName: "HOH", chain: "A", resSeq: 201, x: 8, y: 8, z: 8, b: 30 }),
      atomLine({ record: "HETATM", name: "S", resName: "SO4", chain: "A", resSeq: 202, x: 9, y: 9, z: 9, b: 30 }),
      atomLine({ record: "HETATM", name: "PA", resName: "ATP", chain: "A", resSeq: 301, x: 3, y: 3, z: 3, b: 40 }),
      atomLine({ record: "HETATM", name: "PB", resName: "ATP", chain: "A", resSeq: 301, x: 4, y: 3, z: 3, b: 40 }),
    ].join("\n");
    const { ligands, warnings } = parsePdb(pdb);
    expect(ligands).toHaveLength(1);
    expect(ligands[0]).toMatchObject({ resName: "ATP", atomCount: 2 });
    expect(warnings.some((w) => w.includes("ligand-bound") && w.includes("ATP"))).toBe(true);
  });

  it("does NOT warn for a single model wrapped in MODEL/ENDMDL (AlphaFold style)", () => {
    const pdb = [
      "MODEL        1",
      ...residueLines("MET", 1, [0, 0, 0], 80),
      ...residueLines("ALA", 2, [1, 1, 1], 85),
      "ENDMDL",
      "END",
    ].join("\n");
    const { residues, warnings } = parsePdb(pdb);
    expect(residues).toHaveLength(2);
    expect(warnings.some((w) => w.toLowerCase().includes("multi-model"))).toBe(false);
  });

  it("reads only the first model of a multi-model file and warns", () => {
    const pdb = [
      "MODEL        1",
      ...residueLines("MET", 1, [0, 0, 0], 80),
      "ENDMDL",
      "MODEL        2",
      ...residueLines("MET", 1, [99, 99, 99], 80),
      "ENDMDL",
    ].join("\n");
    const { residues, warnings } = parsePdb(pdb);
    expect(residues).toHaveLength(1);
    expect(residues[0].caXyz).toEqual([0, 0, 0]);
    expect(warnings.some((w) => w.toLowerCase().includes("multi-model"))).toBe(true);
  });

  it("separates residues that share a number across different chains", () => {
    const pdb = [
      ...residueLines("MET", 1, [0, 0, 0], 80, "A"),
      ...residueLines("MET", 1, [5, 5, 5], 80, "B"),
    ].join("\n");
    const { residues } = parsePdb(pdb);
    expect(residues).toHaveLength(2);
    expect(residues.map((r) => r.chain).sort()).toEqual(["A", "B"]);
  });
});
