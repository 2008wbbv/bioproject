/**
 * Approximate secondary-structure assignment from Cα geometry alone (P-SEA-style:
 * Labesse et al. 1997). We only keep Cα coordinates, so this is a geometric
 * approximation of DSSP — enough to break deviation down by helix / sheet / coil.
 * Pure + testable. SPEC §6 (SS without a DSSP binary).
 */
export type SS = "H" | "E" | "C";

// Cα distance criteria (Å) for the i..i+4 window. Tolerant heuristic.
const HELIX = { d2: [4.8, 6.0], d3: [4.6, 5.9], d4: [5.6, 7.2] };
const STRAND = { d2: [6.0, 7.6], d3: [8.8, 11.2], d4: [10.8, 14.2] };

function dist(c: Float64Array, i: number, j: number): number {
  const dx = c[i * 3] - c[j * 3];
  const dy = c[i * 3 + 1] - c[j * 3 + 1];
  const dz = c[i * 3 + 2] - c[j * 3 + 2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
const inRange = (v: number, [a, b]: number[]): boolean => v >= a && v <= b;

function matches(c: Float64Array, i: number, crit: { d2: number[]; d3: number[]; d4: number[] }): boolean {
  return inRange(dist(c, i, i + 2), crit.d2) && inRange(dist(c, i, i + 3), crit.d3) && inRange(dist(c, i, i + 4), crit.d4);
}

/** Collapse runs of `label` shorter than `minLen` to coil. */
function despeckle(ss: SS[], label: SS, minLen: number): void {
  let i = 0;
  while (i < ss.length) {
    if (ss[i] !== label) {
      i++;
      continue;
    }
    let j = i;
    while (j < ss.length && ss[j] === label) j++;
    if (j - i < minLen) for (let k = i; k < j; k++) ss[k] = "C";
    i = j;
  }
}

export function assignSecondaryStructure(coords: Float64Array, n: number): SS[] {
  const ss: SS[] = new Array(n).fill("C");
  for (let i = 0; i + 4 < n; i++) {
    if (matches(coords, i, HELIX)) for (let k = i + 1; k <= i + 3; k++) ss[k] = "H";
  }
  for (let i = 0; i + 4 < n; i++) {
    if (matches(coords, i, STRAND)) for (let k = i + 1; k <= i + 3; k++) if (ss[k] === "C") ss[k] = "E";
  }
  despeckle(ss, "H", 3);
  despeckle(ss, "E", 2);
  return ss;
}

export interface SSBreakdown {
  ss: SS;
  label: string;
  count: number;
  meanDeviation: number;
}

/** Group per-residue deviations by their secondary-structure type. */
export function deviationBySS(
  perResidue: Array<{ uniprotNum: number; deviation: number }>,
  ssByUniprot: Map<number, SS>,
): SSBreakdown[] {
  const labels: Record<SS, string> = { H: "Helix", E: "Strand", C: "Coil" };
  const groups: Record<SS, number[]> = { H: [], E: [], C: [] };
  for (const r of perResidue) {
    const ss = ssByUniprot.get(r.uniprotNum) ?? "C";
    groups[ss].push(r.deviation);
  }
  return (["H", "E", "C"] as SS[]).map((ss) => ({
    ss,
    label: labels[ss],
    count: groups[ss].length,
    meanDeviation: groups[ss].length ? groups[ss].reduce((a, d) => a + d, 0) / groups[ss].length : 0,
  }));
}
