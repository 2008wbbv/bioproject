/**
 * Fold a protein sequence to a 3D structure via ESMFold's public API (Meta's ESM
 * Atlas). In-browser AlphaFold isn't possible (GPU + multi-GB weights), but ESMFold
 * folds a single sequence over one HTTP POST and returns a PDB with pLDDT in the
 * B-factor column — so the result flows straight into the comparison engine.
 *
 * Best-effort, like Foldseek: the public endpoint is rate-limited and occasionally
 * down, so failures are surfaced, never fatal. De-risked: returns PDB with CORS `*`.
 */
const ENDPOINT = "https://api.esmatlas.com/foldSequence/v1/pdb/";

export class FoldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FoldError";
  }
}

/** Fold one sequence; resolves with the PDB text. */
export async function foldSequence(seq: string, signal?: AbortSignal): Promise<string> {
  const clean = seq.trim().toUpperCase();
  if (clean.length < 16) throw new FoldError("Sequence too short (min ~16 residues).");
  let res: Response;
  try {
    res = await fetch(ENDPOINT, { method: "POST", body: clean, signal });
  } catch (e) {
    throw new FoldError(`Could not reach ESMFold: ${(e as Error).message}`);
  }
  if (!res.ok) throw new FoldError(`ESMFold HTTP ${res.status} (sequence may be too long or rate-limited).`);
  const pdb = await res.text();
  if (!pdb.includes("ATOM")) throw new FoldError("ESMFold returned no structure.");
  return pdb;
}

/** Mean pLDDT across CA atoms (ESMFold writes pLDDT into the B-factor column). */
export function meanPlddt(pdbText: string): number {
  let sum = 0;
  let n = 0;
  for (const line of pdbText.split("\n")) {
    if (line.startsWith("ATOM") && line.slice(12, 16).trim() === "CA") {
      const b = Number.parseFloat(line.slice(60, 66));
      if (!Number.isNaN(b)) {
        sum += b;
        n++;
      }
    }
  }
  return n ? sum / n : 0;
}
