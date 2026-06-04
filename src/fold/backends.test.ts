import { describe, it, expect } from "vitest";
import { extractPdb } from "./backends.ts";

describe("extractPdb", () => {
  it("returns raw PDB text as-is", () => {
    const pdb = "HEADER\nATOM      1  CA  ALA A   1      0.0   0.0   0.0\n";
    expect(extractPdb(pdb)).toBe(pdb);
  });

  it("extracts a PDB from JSON under common keys", () => {
    const pdb = "ATOM      1  CA  ALA A   1      0.0   0.0   0.0";
    expect(extractPdb(JSON.stringify({ pdb }))).toBe(pdb);
    expect(extractPdb(JSON.stringify({ structure: pdb }))).toBe(pdb);
    expect(extractPdb(JSON.stringify({ pdbs: [pdb] }))).toBe(pdb);
  });

  it("returns null when no structure is present", () => {
    expect(extractPdb(JSON.stringify({ error: "rate limited" }))).toBeNull();
    expect(extractPdb("not a structure")).toBeNull();
  });
});
