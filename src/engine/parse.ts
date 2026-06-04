/**
 * PDB text -> flat per-residue records. SPEC.md §3.
 *
 * Why a hand-rolled parser instead of Mol*: the engine milestone is "headless and
 * fully testable" — Mol* drags in the DOM/WebGL stack and is awkward in Node tests.
 * AlphaFold serves .pdb directly and RCSB serves .pdb as a documented fallback, so
 * a strict fixed-column PDB reader covers the v1 comparison path. Mol* is still the
 * production parser for the *viewer* and for robust mmCIF metadata (Phase 2); it
 * will implement the same `ParsedStructure` extraction shape so the engine never
 * learns about Mol*'s internal model. See BUILD_PLAN.md.
 *
 * PDB ATOM/HETATM are fixed-column records (PDB v3.3). We read by byte offset, not
 * by splitting on whitespace, because coordinates and names can run together.
 */
import type { HetAtom, HetGroup, ParsedStructure, ResidueRecord } from "./types.ts";
import { WATER_NAMES, isIgnoredHet } from "./ligands.ts";

// 0-indexed [start, end) column slices for an ATOM/HETATM record (PDB v3.3).
const COL = {
  record: [0, 6],
  atomName: [12, 16],
  altLoc: [16, 17],
  resName: [17, 20],
  chainId: [21, 22],
  resSeq: [22, 26],
  iCode: [26, 27],
  x: [30, 38],
  y: [38, 46],
  z: [46, 54],
  bFactor: [60, 66],
} as const;

function field(line: string, span: readonly [number, number]): string {
  return line.slice(span[0], span[1]).trim();
}

function num(line: string, span: readonly [number, number]): number {
  return Number.parseFloat(line.slice(span[0], span[1]));
}

/** A residue accumulator keyed by chain + auth number + insertion code. */
interface ResidueAccumulator {
  chain: string;
  authNum: number;
  resName: string;
  caXyz: [number, number, number] | null;
  bFactor: number;
  /** altLoc of the CA we accepted, to keep a single conformer consistently. */
  caAltLoc: string;
  /** Fallback B-factor from the first atom seen, used when no CA exists. */
  firstBFactor: number;
  hasAnyAtom: boolean;
}

function residueKey(chain: string, authNum: number, iCode: string): string {
  return `${chain}|${authNum}|${iCode}`;
}

/**
 * Parse PDB text into per-residue records plus heteroatom groups.
 *
 * Polymer residues come from ATOM records. HETATM records are bucketed into
 * groups; waters are dropped and crystallization junk is filtered (SPEC.md §8),
 * leaving likely-real ligands in `ligands`. Only the first MODEL is read (NMR
 * ensembles): comparison needs a single conformer.
 */
export function parsePdb(text: string): ParsedStructure {
  const residues = new Map<string, ResidueAccumulator>();
  // HETATM groups keyed by chain|resName|authNum|iCode -> atom count.
  const hetGroups = new Map<string, HetGroup>();
  const hetAtoms: HetAtom[] = [];
  const warnings: string[] = [];

  // A single model is commonly wrapped in MODEL 1 ... ENDMDL (AlphaFold does this),
  // which is NOT a multi-model file. Only warn when a genuine SECOND model appears.
  let inFirstModel = false;
  let doneFirstModel = false;
  let sawSecondModel = false;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    const rec = line.slice(COL.record[0], COL.record[1]).trim();

    if (rec === "MODEL") {
      if (inFirstModel || doneFirstModel) {
        // A second MODEL: stop reading, we only compare the first conformer.
        sawSecondModel = true;
        break;
      }
      inFirstModel = true;
      continue;
    }
    if (rec === "ENDMDL") {
      // Finished the first model; ignore any records before a possible next MODEL.
      if (inFirstModel) doneFirstModel = true;
      inFirstModel = false;
      continue;
    }
    if (doneFirstModel) continue;
    if (rec !== "ATOM" && rec !== "HETATM") continue;

    const altLoc = field(line, COL.altLoc);
    // Accept only the blank or "A" alternate location to keep one conformer.
    if (altLoc !== "" && altLoc !== "A") continue;

    const resName = field(line, COL.resName);
    const chain = field(line, COL.chainId) || "A";
    const authNum = Number.parseInt(line.slice(COL.resSeq[0], COL.resSeq[1]), 10);
    const iCode = field(line, COL.iCode);
    const atomName = field(line, COL.atomName);
    const bFactor = num(line, COL.bFactor);

    if (rec === "HETATM") {
      // Waters are solvent, never ligands.
      if (WATER_NAMES.has(resName.toUpperCase())) continue;
      const key = `${chain}|${resName}|${authNum}|${iCode}`;
      const existing = hetGroups.get(key);
      if (existing) {
        existing.atomCount += 1;
      } else {
        hetGroups.set(key, { resName, chain, authNum, atomCount: 1 });
      }
      // Keep real ligand atom coordinates (for binding-site detection).
      if (!isIgnoredHet(resName)) {
        const x = num(line, COL.x);
        const y = num(line, COL.y);
        const z = num(line, COL.z);
        if (!Number.isNaN(x) && !Number.isNaN(y) && !Number.isNaN(z)) hetAtoms.push({ resName, xyz: [x, y, z] });
      }
      continue;
    }

    // ATOM (polymer) record.
    if (Number.isNaN(authNum)) continue;
    const key = residueKey(chain, authNum, iCode);
    let res = residues.get(key);
    if (!res) {
      res = {
        chain,
        authNum,
        resName,
        caXyz: null,
        bFactor: Number.isNaN(bFactor) ? 0 : bFactor,
        caAltLoc: "",
        firstBFactor: Number.isNaN(bFactor) ? 0 : bFactor,
        hasAnyAtom: true,
      };
      residues.set(key, res);
    }
    res.hasAnyAtom = true;

    if (atomName === "CA") {
      // Keep the first accepted CA conformer; don't let a later altLoc overwrite.
      if (res.caXyz === null) {
        res.caXyz = [num(line, COL.x), num(line, COL.y), num(line, COL.z)];
        res.bFactor = Number.isNaN(bFactor) ? 0 : bFactor;
        res.caAltLoc = altLoc;
      }
    }
  }

  const records: ResidueRecord[] = [];
  for (const r of residues.values()) {
    records.push({
      uniprotNum: null, // assigned later: direct for AF, via SIFTS for experimental
      authNum: r.authNum,
      chain: r.chain,
      resName: r.resName,
      caXyz: r.caXyz,
      bFactor: r.caXyz ? r.bFactor : r.firstBFactor,
    });
  }

  const ligands: HetGroup[] = [];
  for (const g of hetGroups.values()) {
    if (!isIgnoredHet(g.resName)) ligands.push(g);
  }

  if (sawSecondModel) {
    warnings.push("Multi-model file (e.g. NMR ensemble); only the first model was read.");
  }
  if (ligands.length > 0) {
    const names = [...new Set(ligands.map((l) => l.resName))].join(", ");
    warnings.push(`Experimental structure is ligand-bound (holo): ${names}.`);
  }

  return { residues: records, ligands, hetAtoms, warnings };
}
