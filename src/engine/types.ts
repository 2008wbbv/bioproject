/**
 * Shared engine types. See SPEC.md §3-5.
 *
 * The engine is pure math + pure parsing: no DOM, no Mol*, no network. Everything
 * here runs identically in a Web Worker, in Node (tests), or on the main thread.
 */

/** One residue extracted from a parsed structure file. SPEC.md §3. */
export interface ResidueRecord {
  /** UniProt residue number. Filled via SIFTS for experimental structures, direct
   *  (== residue number) for AlphaFold models. Null when no mapping exists. */
  uniprotNum: number | null;
  /** Original author numbering in the file. */
  authNum: number;
  /** Chain id (auth_asym_id / PDB chain). */
  chain: string;
  /** 3-letter residue name, e.g. "ALA". */
  resName: string;
  /** CA coordinate, or null if the residue has no CA atom. */
  caXyz: [number, number, number] | null;
  /** B-factor column: pLDDT for AlphaFold models, real B-factor for experimental. */
  bFactor: number;
}

/** A non-water heteroatom group found in an experimental file (apo/holo). SPEC.md §8. */
export interface HetGroup {
  /** Residue/component name, e.g. "ATP", "HEM". */
  resName: string;
  chain: string;
  authNum: number;
  /** Number of atoms in the group. */
  atomCount: number;
}

/** A non-water, non-junk ligand atom with its coordinate (for binding-site analysis). */
export interface HetAtom {
  resName: string;
  xyz: [number, number, number];
}

/** Result of parsing one structure file. */
export interface ParsedStructure {
  residues: ResidueRecord[];
  /** Heteroatom groups after filtering crystallization junk (SPEC.md §8). */
  ligands: HetGroup[];
  /** Ligand atom coordinates (non-water, non-junk) for binding-site detection. */
  hetAtoms: HetAtom[];
  /** Free-text notes raised during parsing (e.g. multi-fragment AF model). */
  warnings: string[];
}

/** A single matched residue pair after the inner join. SPEC.md §4. */
export interface MatchedPair {
  uniprotNum: number;
  /** CA of the moving (AlphaFold) structure. */
  p: [number, number, number];
  /** CA of the reference (experimental) structure. */
  q: [number, number, number];
  /** pLDDT carried from the AlphaFold residue (its B-factor). */
  plddt: number;
}

/** Output of the alignment step: parallel coordinate arrays + bookkeeping. SPEC.md §4. */
export interface Alignment {
  /** Moving (AlphaFold) CA coordinates, interleaved xyz, length 3 * nMatched. */
  p: Float64Array;
  /** Reference (experimental) CA coordinates, interleaved xyz, length 3 * nMatched. */
  q: Float64Array;
  /** UniProt residue numbers, parallel to the coordinate arrays. */
  uniprotNums: Int32Array;
  /** pLDDT per matched residue, parallel to the coordinate arrays. */
  plddt: Float64Array;
  /** Reference (experimental) B-factor per matched residue. */
  refBFactor: Float64Array;
  nMatched: number;
}

/** A 3x3 rotation matrix, row-major. */
export type Mat3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

/** The rigid-body transform that superposes moving (P) onto reference (Q). */
export interface Superposition {
  /** Rotation applied to centered P. */
  rotation: Mat3;
  /** Centroid of P (subtracted before rotation). */
  centroidP: [number, number, number];
  /** Centroid of Q (added after rotation). */
  centroidQ: [number, number, number];
}

/** Per-residue comparison datum. SPEC.md §5. */
export interface PerResidue {
  uniprotNum: number;
  /** CA-CA distance after superposition, in angstroms. */
  deviation: number;
  plddt: number;
  /** Observed local Distance Difference Test in [0,1] (what pLDDT predicts). */
  lddt?: number;
  /** Reference (experimental) B-factor for this residue, when available. */
  expBFactor?: number;
}

/** Full comparison result for one protein. SPEC.md §5. */
export interface ComparisonResult {
  uniprot: string;
  pdbId: string;
  nMatched: number;
  rmsd: number;
  tmScore: number;
  gdtTs: number;
  /** Global lDDT in [0,1] (superposition-free local accuracy). */
  lddt: number;
  plddtErrorSpearman: number;
  perResidue: PerResidue[];
  warnings: string[];
  backend: "native" | "tmalign-wasm";
}
