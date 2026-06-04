/**
 * mmCIF atom_site -> flat per-residue records. SPEC.md §3.
 *
 * Preferred over the .pdb parser for experimental structures because PDBe's
 * "updated" mmCIF (`{pdb}_updated.cif`) annotates EVERY atom with its UniProt
 * residue number via the SIFTS cross-reference columns:
 *
 *     _atom_site.pdbx_sifts_xref_db_name   ("UNP")
 *     _atom_site.pdbx_sifts_xref_db_acc    (e.g. "P04637")
 *     _atom_site.pdbx_sifts_xref_db_num    (the UniProt residue number)
 *
 * Reading `pdbx_sifts_xref_db_num` directly sidesteps the entire author-vs-label
 * numbering reconciliation: no SIFTS-segment maths, no null-author guessing. When
 * those columns are absent (e.g. a plain RCSB mmCIF), `uniprotNum` is left null and
 * the caller falls back to applySifts() with segment data. SPEC.md §3-4.
 *
 * This is a focused atom_site reader, not a general CIF parser: it handles the
 * `loop_` table that holds coordinates (single-line, whitespace-delimited rows with
 * `.`/`?` null markers and optional quoting), which is all the engine needs.
 */
import type { HetAtom, HetGroup, ParsedStructure, ResidueRecord } from "./types.ts";
import { WATER_NAMES, isIgnoredHet } from "./ligands.ts";

/** Tokenize one CIF data row, respecting single/double quotes. */
function tokenizeRow(line: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const n = line.length;
  while (i < n) {
    const c = line[i];
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      const quote = c;
      i++;
      let start = i;
      // A closing quote must be followed by whitespace/EOL (CIF rule).
      while (i < n && !(line[i] === quote && (i + 1 >= n || line[i + 1] === " " || line[i + 1] === "\t"))) {
        i++;
      }
      tokens.push(line.slice(start, i));
      i++; // skip closing quote
    } else {
      const start = i;
      while (i < n && line[i] !== " " && line[i] !== "\t") i++;
      tokens.push(line.slice(start, i));
    }
  }
  return tokens;
}

interface ResidueAccumulator {
  chain: string;
  authNum: number;
  resName: string;
  uniprotNum: number | null;
  caXyz: [number, number, number] | null;
  bFactor: number;
  firstBFactor: number;
  caSeen: boolean;
}

const isNull = (t: string | undefined): boolean => t === undefined || t === "." || t === "?";

/**
 * Parse mmCIF text into per-residue records plus heteroatom groups.
 *
 * @param text       mmCIF file contents.
 * @param opts.uniprotAcc  If given, only SIFTS xrefs to this accession fill
 *                         `uniprotNum` (guards against chimeras / tagged constructs).
 */
export function parseCif(text: string, opts: { uniprotAcc?: string } = {}): ParsedStructure {
  const lines = text.split("\n");

  // Locate the atom_site loop and capture its column order.
  const colIndex = new Map<string, number>();
  let row = 0; // line index
  let inHeader = false;
  let colCount = 0;
  for (; row < lines.length; row++) {
    const t = lines[row].trim();
    if (t === "loop_") {
      // Peek: is the next non-empty line an _atom_site. tag?
      let k = row + 1;
      while (k < lines.length && lines[k].trim() === "") k++;
      if (k < lines.length && lines[k].trim().startsWith("_atom_site.")) {
        inHeader = true;
        row = k;
        break;
      }
    }
  }
  if (!inHeader) {
    return { residues: [], ligands: [], hetAtoms: [], warnings: ["No atom_site loop found in mmCIF."] };
  }
  for (; row < lines.length; row++) {
    const t = lines[row].trim();
    if (t.startsWith("_atom_site.")) {
      colIndex.set(t.slice("_atom_site.".length), colCount++);
    } else {
      break; // first data row
    }
  }

  const col = (name: string): number => colIndex.get(name) ?? -1;
  const C = {
    group: col("group_PDB"),
    atom: col("label_atom_id"),
    alt: col("label_alt_id"),
    comp: col("label_comp_id"),
    authComp: col("auth_comp_id"),
    authAsym: col("auth_asym_id"),
    labelAsym: col("label_asym_id"),
    authSeq: col("auth_seq_id"),
    insCode: col("pdbx_PDB_ins_code"),
    x: col("Cartn_x"),
    y: col("Cartn_y"),
    z: col("Cartn_z"),
    b: col("B_iso_or_equiv"),
    model: col("pdbx_PDB_model_num"),
    xrefName: col("pdbx_sifts_xref_db_name"),
    xrefAcc: col("pdbx_sifts_xref_db_acc"),
    xrefNum: col("pdbx_sifts_xref_db_num"),
  };

  const residues = new Map<string, ResidueAccumulator>();
  const hetGroups = new Map<string, HetGroup>();
  const hetAtoms: HetAtom[] = [];
  const warnings: string[] = [];
  let firstModel: string | null = null;
  let sawOtherModel = false;

  for (; row < lines.length; row++) {
    const raw = lines[row];
    const t = raw.trim();
    if (t === "" || t === "#" || t === "loop_" || t.startsWith("_") || t.startsWith("data_")) break;

    const f = tokenizeRow(raw);
    if (f.length < colCount) continue; // malformed/short row

    const group = f[C.group];
    if (group !== "ATOM" && group !== "HETATM") continue;

    // First model only (NMR ensembles): comparison needs one conformer.
    if (C.model >= 0) {
      const model = f[C.model];
      if (firstModel === null) firstModel = model;
      else if (model !== firstModel) {
        sawOtherModel = true;
        continue;
      }
    }

    const altLoc = C.alt >= 0 ? f[C.alt] : ".";
    if (!isNull(altLoc) && altLoc !== "A") continue;

    const resName = (C.comp >= 0 ? f[C.comp] : f[C.authComp]) ?? "UNK";
    const chain = C.authAsym >= 0 ? f[C.authAsym] : C.labelAsym >= 0 ? f[C.labelAsym] : "A";
    const authNum = Number.parseInt(f[C.authSeq], 10);
    const insCode = C.insCode >= 0 && !isNull(f[C.insCode]) ? f[C.insCode] : "";
    const atomName = f[C.atom];
    const bFactor = C.b >= 0 ? Number.parseFloat(f[C.b]) : 0;

    if (group === "HETATM") {
      if (WATER_NAMES.has(resName.toUpperCase())) continue;
      const key = `${chain}|${resName}|${authNum}|${insCode}`;
      const g = hetGroups.get(key);
      if (g) g.atomCount += 1;
      else hetGroups.set(key, { resName, chain, authNum, atomCount: 1 });
      if (!isIgnoredHet(resName)) {
        const x = Number.parseFloat(f[C.x]);
        const y = Number.parseFloat(f[C.y]);
        const z = Number.parseFloat(f[C.z]);
        if (!Number.isNaN(x) && !Number.isNaN(y) && !Number.isNaN(z)) hetAtoms.push({ resName, xyz: [x, y, z] });
      }
      continue;
    }

    if (Number.isNaN(authNum)) continue;

    // UniProt number straight from the SIFTS xref columns when present.
    let uniprotNum: number | null = null;
    if (C.xrefNum >= 0 && C.xrefName >= 0) {
      const dbName = f[C.xrefName];
      const acc = C.xrefAcc >= 0 ? f[C.xrefAcc] : undefined;
      const num = f[C.xrefNum];
      const accOk = !opts.uniprotAcc || isNull(acc) || acc === opts.uniprotAcc;
      if (dbName === "UNP" && !isNull(num) && accOk) {
        const parsed = Number.parseInt(num, 10);
        if (!Number.isNaN(parsed)) uniprotNum = parsed;
      }
    }

    const key = `${chain}|${authNum}|${insCode}`;
    let res = residues.get(key);
    if (!res) {
      res = {
        chain,
        authNum,
        resName,
        uniprotNum,
        caXyz: null,
        bFactor: Number.isNaN(bFactor) ? 0 : bFactor,
        firstBFactor: Number.isNaN(bFactor) ? 0 : bFactor,
        caSeen: false,
      };
      residues.set(key, res);
    } else if (res.uniprotNum === null && uniprotNum !== null) {
      res.uniprotNum = uniprotNum;
    }

    if (atomName === "CA" && !res.caSeen) {
      res.caXyz = [Number.parseFloat(f[C.x]), Number.parseFloat(f[C.y]), Number.parseFloat(f[C.z])];
      res.bFactor = Number.isNaN(bFactor) ? 0 : bFactor;
      res.caSeen = true;
    }
  }

  const records: ResidueRecord[] = [];
  for (const r of residues.values()) {
    records.push({
      uniprotNum: r.uniprotNum,
      authNum: r.authNum,
      chain: r.chain,
      resName: r.resName,
      caXyz: r.caXyz,
      bFactor: r.caSeen ? r.bFactor : r.firstBFactor,
    });
  }

  const ligands: HetGroup[] = [];
  for (const g of hetGroups.values()) if (!isIgnoredHet(g.resName)) ligands.push(g);

  if (sawOtherModel) {
    warnings.push("Multi-model file (e.g. NMR ensemble); only the first model was read.");
  }
  if (ligands.length > 0) {
    const names = [...new Set(ligands.map((l) => l.resName))].join(", ");
    warnings.push(`Experimental structure is ligand-bound (holo): ${names}.`);
  }

  return { residues: records, ligands, hetAtoms, warnings };
}
