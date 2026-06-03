/**
 * Residue correspondence by inner-join on UniProt number. SPEC.md §4.
 *
 * Both structures are the SAME protein sequence, so there is no combinatorial
 * alignment search: a residue corresponds iff both structures have a CA atom for
 * the same UniProt residue number. We inner-join on `uniprotNum`, keeping only
 * pairs where both sides have a CA.
 *
 * Output is two parallel interleaved-xyz Float64Arrays (P = AlphaFold / moving,
 * Q = experimental / reference) plus the UniProt numbers and pLDDT carried along
 * for per-residue reporting downstream.
 */
import type { Alignment, ResidueRecord } from "./types.ts";

/**
 * Inner-join AlphaFold (moving) and experimental (reference) residues on UniProt
 * number. Residues with no CA or no UniProt mapping are excluded from the match.
 *
 * @param afResidues   AlphaFold residues (uniprotNum assigned directly).
 * @param expResidues  Experimental residues (uniprotNum assigned via SIFTS).
 */
export function alignByUniprot(
  afResidues: ResidueRecord[],
  expResidues: ResidueRecord[],
): Alignment {
  // Index AlphaFold residues by UniProt number (first CA-bearing one wins).
  const afByUnp = new Map<number, ResidueRecord>();
  for (const r of afResidues) {
    if (r.uniprotNum === null || r.caXyz === null) continue;
    if (!afByUnp.has(r.uniprotNum)) afByUnp.set(r.uniprotNum, r);
  }

  // Walk experimental residues in ascending UniProt order for deterministic output.
  const matchedUnp: number[] = [];
  for (const r of expResidues) {
    if (r.uniprotNum === null || r.caXyz === null) continue;
    if (afByUnp.has(r.uniprotNum)) matchedUnp.push(r.uniprotNum);
  }
  // De-dup (an experimental residue number could appear twice across chains) and sort.
  const uniqueSorted = [...new Set(matchedUnp)].sort((a, b) => a - b);

  // Re-index experimental by UniProt for coordinate lookup.
  const expByUnp = new Map<number, ResidueRecord>();
  for (const r of expResidues) {
    if (r.uniprotNum === null || r.caXyz === null) continue;
    if (!expByUnp.has(r.uniprotNum)) expByUnp.set(r.uniprotNum, r);
  }

  const n = uniqueSorted.length;
  const p = new Float64Array(n * 3);
  const q = new Float64Array(n * 3);
  const uniprotNums = new Int32Array(n);
  const plddt = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const unp = uniqueSorted[i];
    const af = afByUnp.get(unp)!;
    const exp = expByUnp.get(unp)!;
    const [ax, ay, az] = af.caXyz!;
    const [qx, qy, qz] = exp.caXyz!;
    p[i * 3] = ax;
    p[i * 3 + 1] = ay;
    p[i * 3 + 2] = az;
    q[i * 3] = qx;
    q[i * 3 + 1] = qy;
    q[i * 3 + 2] = qz;
    uniprotNums[i] = unp;
    plddt[i] = af.bFactor; // AlphaFold B-factor column holds pLDDT
  }

  return { p, q, uniprotNums, plddt, nMatched: n };
}
