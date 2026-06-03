/**
 * Validation against the canonical reference aligner (SPEC §6). Runs tmalign-wasm in
 * the browser on the same two structures and shows its TM-score/RMSD next to the
 * native engine's — the proof that the from-scratch engine is correct.
 *
 * tmalign-wasm is loaded lazily and wrapped: if the WASM fails to load or run, this
 * panel shows an error and the rest of the app is unaffected (it is never a
 * dependency of the core metrics).
 */
import { useState } from "react";
import { parseCif } from "../engine/parseCif.ts";
import { caPdbFromResidues } from "../engine/writePdb.ts";
import { runTmalign, TmalignError, type TmalignResult } from "../engine/backends/tmalign.ts";

type Phase = "idle" | "running" | "done" | "error";

export function ValidationPanel({
  afPdbText,
  expCifText,
  uniprot,
  chain,
  nativeTm,
  nativeRmsd,
}: {
  afPdbText: string;
  expCifText: string;
  uniprot: string;
  chain: string;
  nativeTm: number;
  nativeRmsd: number;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<TmalignResult | null>(null);
  const [error, setError] = useState("");

  async function validate() {
    setPhase("running");
    setError("");
    try {
      // Feed TM-align clean PDB: the AF model as-is, the experimental chain as a
      // CA-only PDB (TM-align is CA-based) to avoid any mmCIF-support assumptions.
      const exp = parseCif(expCifText, { uniprotAcc: uniprot });
      const expCaPdb = caPdbFromResidues(exp.residues, chain);
      // Pass the experimental structure FIRST: the wrapper reports the TM-score
      // normalised by Chain_1's length, and the native engine normalises by the
      // reference (experimental) length — so this makes the two directly comparable.
      const r = await runTmalign(expCaPdb, afPdbText);
      setResult(r);
      setPhase("done");
    } catch (e) {
      setError(e instanceof TmalignError ? e.message : (e as Error).message);
      setPhase("error");
    }
  }

  const tmDelta = result ? Math.abs(result.tmScore - nativeTm) : 0;
  const rmsdDelta = result ? Math.abs(result.rmsd - nativeRmsd) : 0;
  const agree = tmDelta < 0.05;

  return (
    <div className="validation-panel">
      <div className="search-head">
        <strong>Validate engine vs TM-align</strong>
        <button onClick={() => void validate()} disabled={phase === "running"}>
          {phase === "running" ? "Running TM-align (WASM)…" : "Run TM-align"}
        </button>
        <span className="muted small">Canonical reference aligner, in-browser WASM</span>
      </div>

      {phase === "error" && <p className="status error">TM-align unavailable: {error}</p>}

      {phase === "done" && result && (
        <>
          <table className="validate-table">
            <thead>
              <tr>
                <th></th>
                <th>Native engine</th>
                <th>TM-align</th>
                <th>|Δ|</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>TM-score</td>
                <td>{nativeTm.toFixed(4)}</td>
                <td>{result.tmScore.toFixed(4)}</td>
                <td>{tmDelta.toFixed(4)}</td>
              </tr>
              <tr>
                <td>RMSD (Å)</td>
                <td>{nativeRmsd.toFixed(3)}</td>
                <td>{result.rmsd.toFixed(3)}</td>
                <td>{rmsdDelta.toFixed(3)}</td>
              </tr>
            </tbody>
          </table>
          <p className={agree ? "validate-ok" : "muted"}>
            {agree
              ? "✓ Agrees with TM-align within tolerance."
              : "Some difference is expected: TM-align iteratively re-superposes and may normalise TM-score by a different length (see SPEC §5)."}
          </p>
        </>
      )}
    </div>
  );
}
