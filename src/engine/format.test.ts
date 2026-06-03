import { describe, it, expect } from "vitest";
import { detectFormat } from "./format.ts";

describe("detectFormat", () => {
  it("uses the file extension when present", () => {
    expect(detectFormat("model.pdb", "")).toBe("pdb");
    expect(detectFormat("AF-P04637-F1.cif", "")).toBe("cif");
    expect(detectFormat("1tup.ent", "")).toBe("pdb");
    expect(detectFormat("x.mmcif", "")).toBe("cif");
  });

  it("sniffs content when the extension is unknown", () => {
    expect(detectFormat("blob", "data_TEST\n_atom_site.group_PDB\n")).toBe("cif");
    expect(detectFormat("blob", "ATOM      1  N   MET A   1      10.0  20.0  30.0")).toBe("pdb");
  });

  it("is case-insensitive on the extension", () => {
    expect(detectFormat("MODEL.PDB", "")).toBe("pdb");
    expect(detectFormat("X.CIF", "")).toBe("cif");
  });
});
