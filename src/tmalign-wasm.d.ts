/** Ambient types for the untyped `tmalign-wasm` package (SPEC §6). */
declare module "tmalign-wasm" {
  /** Run TM-align on two PDB strings; resolves with its stdout + rotation matrix. */
  export function tmalign(
    pdb1: string,
    pdb2: string,
    alignment?: string | null,
  ): Promise<{ output: string; matrix: string }>;

  /** Parse TM-align stdout into structured fields (tmScore, rmsd, …) or null. */
  export function parse(output: string): { tmScore: number; rmsd: number } | null;

  export function parseMatrix(matrix: string): { t: number[]; u: number[][] };
}
