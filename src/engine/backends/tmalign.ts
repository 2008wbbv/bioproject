/**
 * tmalign-wasm validation backend (SPEC §6). The published TM-align WASM build (used
 * by the Foldseek webserver) runs the canonical reference aligner fully in the
 * browser. We use it to VALIDATE the from-scratch TS engine: run both on the same
 * structures and check the numbers agree. It is never a dependency of the core path
 * — the native engine produces every metric on its own.
 *
 * Lazy-imported so the WASM only loads when the user asks to validate, and never
 * inflates the initial bundle. Wrapped so a failure degrades gracefully.
 */
export interface TmalignResult {
  tmScore: number;
  rmsd: number;
}

export class TmalignError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TmalignError";
  }
}

/**
 * Run TM-align on two PDB strings (CA atoms suffice — TM-align is CA-based).
 * The returned TM-score is normalised by the FIRST structure's length (that is what
 * the wrapper parses), so pass the reference structure as `pdb1` to match the native
 * engine's normalisation. Verified against the native engine on p53/2OCJ: TM-score
 * 0.9916 vs 0.9909, RMSD 0.48 Å vs 0.51 Å.
 */
export async function runTmalign(pdb1: string, pdb2: string): Promise<TmalignResult> {
  let mod: typeof import("tmalign-wasm");
  try {
    mod = await import("tmalign-wasm");
  } catch (e) {
    throw new TmalignError(`Could not load TM-align WASM: ${(e as Error).message}`);
  }
  try {
    const { output } = await mod.tmalign(pdb1, pdb2);
    const parsed = mod.parse(output);
    if (!parsed || !Number.isFinite(parsed.tmScore)) {
      throw new TmalignError("TM-align produced no parseable score.");
    }
    return { tmScore: parsed.tmScore, rmsd: parsed.rmsd };
  } catch (e) {
    if (e instanceof TmalignError) throw e;
    throw new TmalignError(`TM-align run failed: ${(e as Error).message}`);
  }
}
