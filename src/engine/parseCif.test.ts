import { describe, it, expect } from "vitest";
import { parseCif } from "./parseCif.ts";

/**
 * A tiny mmCIF with the PDBe-updated atom_site columns, including the SIFTS xref
 * columns that carry UniProt numbers per atom. Column order mirrors a real
 * `{pdb}_updated.cif`.
 */
const UPDATED_CIF = `data_TEST
#
loop_
_atom_site.group_PDB
_atom_site.id
_atom_site.type_symbol
_atom_site.label_atom_id
_atom_site.label_alt_id
_atom_site.label_comp_id
_atom_site.label_asym_id
_atom_site.label_seq_id
_atom_site.pdbx_PDB_ins_code
_atom_site.Cartn_x
_atom_site.Cartn_y
_atom_site.Cartn_z
_atom_site.occupancy
_atom_site.B_iso_or_equiv
_atom_site.auth_seq_id
_atom_site.auth_asym_id
_atom_site.pdbx_PDB_model_num
_atom_site.pdbx_sifts_xref_db_name
_atom_site.pdbx_sifts_xref_db_acc
_atom_site.pdbx_sifts_xref_db_num
ATOM 1 N N   . SER A 3 ? 10.000 20.000 30.000 1.00 45.90 96 A 1 UNP P04637 96
ATOM 2 C CA  . SER A 3 ? 11.000 21.000 31.000 1.00 45.90 96 A 1 UNP P04637 96
ATOM 3 C CA  . VAL A 4 ? 12.000 22.000 32.000 1.00 38.34 97 A 1 UNP P04637 97
ATOM 4 C CA  . LEU B 4 ? 50.000 60.000 70.000 1.00 40.00 97 B 1 UNP P04637 97
HETATM 5 O O   . HOH A . ? 99.000 99.000 99.000 1.00 30.00 201 A 1 ? ? ?
HETATM 6 P PA  . ATP A . ? 5.000 5.000 5.000 1.00 40.00 301 A 1 ? ? ?
HETATM 7 P PB  . ATP A . ? 6.000 5.000 5.000 1.00 40.00 301 A 1 ? ? ?
#
`;

describe("parseCif (PDBe updated mmCIF)", () => {
  it("reads UniProt numbers directly from the SIFTS xref columns", () => {
    const { residues } = parseCif(UPDATED_CIF);
    const chainA = residues.filter((r) => r.chain === "A");
    expect(chainA).toHaveLength(2);
    // Author 96 -> UniProt 96, author 97 -> UniProt 97 (read from xref column).
    expect(chainA[0]).toMatchObject({ authNum: 96, uniprotNum: 96, resName: "SER" });
    expect(chainA[0].caXyz).toEqual([11, 21, 31]);
    expect(chainA[1]).toMatchObject({ authNum: 97, uniprotNum: 97, resName: "VAL" });
    expect(chainA[1].bFactor).toBe(38.34);
  });

  it("keeps separate chains that share a UniProt number", () => {
    const { residues } = parseCif(UPDATED_CIF);
    const unp97 = residues.filter((r) => r.uniprotNum === 97);
    expect(unp97.map((r) => r.chain).sort()).toEqual(["A", "B"]);
  });

  it("flags a real ligand and drops water", () => {
    const { ligands, warnings } = parseCif(UPDATED_CIF);
    expect(ligands).toHaveLength(1);
    expect(ligands[0]).toMatchObject({ resName: "ATP", atomCount: 2 });
    expect(warnings.some((w) => w.includes("ATP"))).toBe(true);
  });

  it("respects the uniprotAcc filter (ignores xrefs to other accessions)", () => {
    const { residues } = parseCif(UPDATED_CIF, { uniprotAcc: "Q99999" });
    // No residue should get a UniProt number since the xref acc is P04637.
    expect(residues.every((r) => r.uniprotNum === null)).toBe(true);
  });

  it("leaves uniprotNum null when xref columns are absent (segment fallback path)", () => {
    const plainCif = `data_PLAIN
#
loop_
_atom_site.group_PDB
_atom_site.id
_atom_site.type_symbol
_atom_site.label_atom_id
_atom_site.label_alt_id
_atom_site.label_comp_id
_atom_site.label_asym_id
_atom_site.pdbx_PDB_ins_code
_atom_site.Cartn_x
_atom_site.Cartn_y
_atom_site.Cartn_z
_atom_site.occupancy
_atom_site.B_iso_or_equiv
_atom_site.auth_seq_id
_atom_site.auth_asym_id
_atom_site.pdbx_PDB_model_num
ATOM 1 C CA . SER A ? 1.000 2.000 3.000 1.00 45.00 96 A 1
#
`;
    const { residues } = parseCif(plainCif);
    expect(residues).toHaveLength(1);
    expect(residues[0].uniprotNum).toBeNull();
    expect(residues[0].authNum).toBe(96);
  });

  it("reads only the first model and warns when a second model is present", () => {
    const multiModel = `data_NMR
#
loop_
_atom_site.group_PDB
_atom_site.id
_atom_site.type_symbol
_atom_site.label_atom_id
_atom_site.label_alt_id
_atom_site.label_comp_id
_atom_site.label_asym_id
_atom_site.pdbx_PDB_ins_code
_atom_site.Cartn_x
_atom_site.Cartn_y
_atom_site.Cartn_z
_atom_site.occupancy
_atom_site.B_iso_or_equiv
_atom_site.auth_seq_id
_atom_site.auth_asym_id
_atom_site.pdbx_PDB_model_num
ATOM 1 C CA . SER A ? 1.000 2.000 3.000 1.00 45.00 96 A 1
ATOM 2 C CA . SER A ? 9.000 9.000 9.000 1.00 45.00 96 A 2
#
`;
    const { residues, warnings } = parseCif(multiModel);
    expect(residues).toHaveLength(1);
    expect(residues[0].caXyz).toEqual([1, 2, 3]);
    expect(warnings.some((w) => w.toLowerCase().includes("multi-model"))).toBe(true);
  });

  it("does NOT warn for a normal single-model file", () => {
    const { warnings } = parseCif(UPDATED_CIF);
    expect(warnings.some((w) => w.toLowerCase().includes("multi-model"))).toBe(false);
  });
});
