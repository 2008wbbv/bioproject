/**
 * Global (Needleman–Wunsch) sequence alignment of two residue arrays, for comparing
 * uploaded structures that DON'T share residue numbering (SPEC §4 assumes shared
 * UniProt numbers; this is the escape hatch). We align the 1-letter sequences, then
 * give each matched pair a shared synthetic number so the normal UniProt-join
 * machinery (align.ts) works unchanged. Pure + testable.
 */
import type { ResidueRecord } from "./types.ts";

const THREE_TO_ONE: Record<string, string> = {
  ALA: "A", ARG: "R", ASN: "N", ASP: "D", CYS: "C", GLN: "Q", GLU: "E", GLY: "G",
  HIS: "H", ILE: "I", LEU: "L", LYS: "K", MET: "M", PHE: "F", PRO: "P", SER: "S",
  THR: "T", TRP: "W", TYR: "Y", VAL: "V", MSE: "M", SEC: "U", PYL: "O",
};

export function threeToOne(resName: string): string {
  return THREE_TO_ONE[resName.trim().toUpperCase()] ?? "X";
}

export function sequenceOf(residues: ResidueRecord[]): string {
  return residues.map((r) => threeToOne(r.resName)).join("");
}

export interface NwOptions {
  match?: number;
  mismatch?: number;
  gap?: number;
}

/**
 * Needleman–Wunsch global alignment. Returns aligned index pairs `[i, j]` where i
 * indexes `a` and j indexes `b`; either may be null for a gap. Linear gap penalty.
 */
export function needlemanWunsch(a: string, b: string, opts: NwOptions = {}): Array<[number | null, number | null]> {
  const match = opts.match ?? 1;
  const mismatch = opts.mismatch ?? -1;
  const gap = opts.gap ?? -2;
  const n = a.length;
  const m = b.length;

  // Score matrix + traceback (0=diag, 1=up/gap-in-b, 2=left/gap-in-a).
  const score: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  const tb: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    score[i][0] = i * gap;
    tb[i][0] = 1;
  }
  for (let j = 1; j <= m; j++) {
    score[0][j] = j * gap;
    tb[0][j] = 2;
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diag = score[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? match : mismatch);
      const up = score[i - 1][j] + gap;
      const left = score[i][j - 1] + gap;
      let best = diag;
      let dir = 0;
      if (up > best) {
        best = up;
        dir = 1;
      }
      if (left > best) {
        best = left;
        dir = 2;
      }
      score[i][j] = best;
      tb[i][j] = dir;
    }
  }

  const pairs: Array<[number | null, number | null]> = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const dir = i === 0 ? 2 : j === 0 ? 1 : tb[i][j];
    if (dir === 0) {
      pairs.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (dir === 1) {
      pairs.push([i - 1, null]);
      i--;
    } else {
      pairs.push([null, j - 1]);
      j--;
    }
  }
  pairs.reverse();
  return pairs;
}

/**
 * Align two residue arrays by sequence and assign each matched (identical-residue)
 * column a shared synthetic `uniprotNum`, so align.ts can inner-join them. Mismatched
 * or gapped positions get `uniprotNum = null`. Returns the number of matched pairs.
 */
export function assignBySequenceAlignment(model: ResidueRecord[], ref: ResidueRecord[]): number {
  for (const r of model) r.uniprotNum = null;
  for (const r of ref) r.uniprotNum = null;

  const pairs = needlemanWunsch(sequenceOf(model), sequenceOf(ref));
  let matched = 0;
  for (const [i, j] of pairs) {
    if (i === null || j === null) continue;
    // Only treat identical residue types as a true correspondence.
    if (threeToOne(model[i].resName) !== threeToOne(ref[j].resName)) continue;
    const num = matched + 1;
    model[i].uniprotNum = num;
    ref[j].uniprotNum = num;
    matched++;
  }
  return matched;
}
