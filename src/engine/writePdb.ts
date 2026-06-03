/**
 * Emit a minimal CA-only PDB from ResidueRecords. Used to hand the experimental
 * structure to tmalign-wasm in a guaranteed PDB format (TM-align is CA-based), so
 * validation never depends on TM-align's mmCIF support. Pure + testable.
 */
import type { ResidueRecord } from "./types.ts";

function put(buf: string[], start: number, str: string): void {
  for (let i = 0; i < str.length; i++) buf[start + i] = str[i];
}
function putRight(buf: string[], start: number, end: number, str: string): void {
  const s = str.slice(0, end - start);
  for (let i = 0; i < s.length; i++) buf[start + (end - start - s.length) + i] = s[i];
}

/** One ATOM CA line (PDB v3.3 columns). */
function caLine(serial: number, res: ResidueRecord): string {
  const buf = Array<string>(80).fill(" ");
  const [x, y, z] = res.caXyz!;
  put(buf, 0, "ATOM");
  putRight(buf, 6, 11, String(serial % 100000));
  put(buf, 13, "CA");
  put(buf, 17, (res.resName || "UNK").slice(0, 3));
  buf[21] = (res.chain || "A").slice(-1);
  putRight(buf, 22, 26, String(res.authNum));
  putRight(buf, 30, 38, x.toFixed(3));
  putRight(buf, 38, 46, y.toFixed(3));
  putRight(buf, 46, 54, z.toFixed(3));
  putRight(buf, 54, 60, "1.00");
  putRight(buf, 60, 66, (res.bFactor ?? 0).toFixed(2));
  put(buf, 76, " C");
  return buf.join("").trimEnd();
}

/**
 * Build a CA-only PDB string. Residues without a CA are skipped. If `chain` is
 * given, only that chain's residues are emitted.
 */
export function caPdbFromResidues(residues: ResidueRecord[], chain?: string): string {
  const lines: string[] = [];
  let serial = 1;
  for (const r of residues) {
    if (!r.caXyz) continue;
    if (chain !== undefined && r.chain !== chain) continue;
    lines.push(caLine(serial++, r));
  }
  lines.push("TER");
  lines.push("END");
  return lines.join("\n") + "\n";
}
