/**
 * Rewrite a PDB file's coordinates / B-factors. Used by the viewer (SPEC §7) to put
 * the AlphaFold model into the experimental structure's frame BEFORE handing it to
 * Mol*, so the viewer never has to apply transforms itself, and to inject
 * per-residue deviation into the B-factor column so Mol*'s built-in B-factor
 * coloring renders the deviation heatmap.
 *
 * Pure string/number work — fully testable, no Mol*, no DOM.
 */
import type { Mat3, Superposition } from "./types.ts";

/** Collapse a superposition into a single affine: x' = R·x + t. */
export function composeAffine(sup: Superposition): { r: Mat3; t: [number, number, number] } {
  const R = sup.rotation;
  const [cpx, cpy, cpz] = sup.centroidP;
  const [cqx, cqy, cqz] = sup.centroidQ;
  // x' = R·(x - cP) + cQ = R·x + (cQ - R·cP)
  const rcp = [
    R[0][0] * cpx + R[0][1] * cpy + R[0][2] * cpz,
    R[1][0] * cpx + R[1][1] * cpy + R[1][2] * cpz,
    R[2][0] * cpx + R[2][1] * cpy + R[2][2] * cpz,
  ];
  return { r: R, t: [cqx - rcp[0], cqy - rcp[1], cqz - rcp[2]] };
}

/** Right-justify a value into a fixed-width column, with overflow protection. */
function fixedField(value: number, width: number, decimals: number): string {
  let s = value.toFixed(decimals);
  if (s.length > width) {
    // Clamp absurd values rather than corrupting column alignment.
    s = value > 0 ? "9".repeat(width) : "-" + "9".repeat(width - 1);
    s = s.slice(0, width);
  }
  return s.padStart(width);
}

/** Splice replacement text into [start, end) of a line, preserving the rest. */
function splice(line: string, start: number, end: number, replacement: string): string {
  // Pad short lines so the column exists.
  const padded = line.length < end ? line + " ".repeat(end - line.length) : line;
  return padded.slice(0, start) + replacement + padded.slice(end);
}

const COORD = { x: [30, 38], y: [38, 46], z: [46, 54], b: [60, 66] } as const;

/** Apply a rigid transform (from `composeAffine`) to every ATOM/HETATM coordinate. */
export function transformPdb(text: string, sup: Superposition): string {
  const { r, t } = composeAffine(sup);
  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    const rec = line.slice(0, 6).trim();
    if ((rec === "ATOM" || rec === "HETATM") && line.length >= 54) {
      const x = Number.parseFloat(line.slice(COORD.x[0], COORD.x[1]));
      const y = Number.parseFloat(line.slice(COORD.y[0], COORD.y[1]));
      const z = Number.parseFloat(line.slice(COORD.z[0], COORD.z[1]));
      if (!Number.isNaN(x) && !Number.isNaN(y) && !Number.isNaN(z)) {
        const nx = r[0][0] * x + r[0][1] * y + r[0][2] * z + t[0];
        const ny = r[1][0] * x + r[1][1] * y + r[1][2] * z + t[1];
        const nz = r[2][0] * x + r[2][1] * y + r[2][2] * z + t[2];
        let l = splice(line, COORD.x[0], COORD.x[1], fixedField(nx, 8, 3));
        l = splice(l, COORD.y[0], COORD.y[1], fixedField(ny, 8, 3));
        l = splice(l, COORD.z[0], COORD.z[1], fixedField(nz, 8, 3));
        out.push(l);
        continue;
      }
    }
    out.push(line);
  }
  return out.join("\n");
}

/** Apply a function to every ATOM record's B-factor (HETATM untouched). */
export function mapBFactor(text: string, fn: (b: number) => number): string {
  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line.slice(0, 6).trim() === "ATOM" && line.length >= 66) {
      const b = Number.parseFloat(line.slice(COORD.b[0], COORD.b[1]));
      const v = Number.isNaN(b) ? 0 : fn(b);
      out.push(splice(line, COORD.b[0], COORD.b[1], fixedField(v, 6, 2)));
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

/**
 * Overwrite the B-factor column of every ATOM record from a map keyed by author
 * residue number (for AlphaFold models author number == UniProt number). Residues
 * not in the map get `fallback`. HETATM records are left untouched.
 */
export function rewriteBFactorByAuthNum(
  text: string,
  valueByAuthNum: Map<number, number>,
  fallback = 0,
): string {
  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line.slice(0, 6).trim() === "ATOM" && line.length >= 26) {
      const authNum = Number.parseInt(line.slice(22, 26), 10);
      const value = Number.isNaN(authNum) ? fallback : valueByAuthNum.get(authNum) ?? fallback;
      out.push(splice(line, COORD.b[0], COORD.b[1], fixedField(value, 6, 2)));
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}
