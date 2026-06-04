/**
 * Predictor face-off: AlphaFold vs ESMFold vs the experimental structure. Folds the
 * sequence with ESMFold and compares it to the SAME reference (by sequence
 * alignment), then shows both predictors' metrics side by side — "which predictor
 * wins for this protein?". Best-effort (ESMFold caps at ~400 aa).
 */
import { useState } from "react";
import { parsePdb } from "../engine/parse.ts";
import { sequenceOf } from "../engine/seqalign.ts";
import { runCustomComparison } from "../api/pipeline.ts";
import { foldSequence, FoldError } from "../fold/esmfold.ts";
import { MAX_FOLD_LENGTH } from "../fold/parseFasta.ts";
import type { StructFormat } from "../engine/format.ts";
import { Icon } from "../ui/Icon.tsx";

interface M {
  rmsd: number;
  tmScore: number;
  gdtTs: number;
  lddt: number;
  nMatched: number;
}

export function FaceoffPanel({
  uniprot,
  modelText,
  refText,
  refFormat,
  af,
}: {
  uniprot: string;
  modelText: string;
  refText: string;
  refFormat: StructFormat;
  af: M;
}) {
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [esm, setEsm] = useState<M | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setPhase("running");
    setError("");
    try {
      const seq = sequenceOf(parsePdb(modelText).residues.filter((r) => r.caXyz));
      if (seq.length > MAX_FOLD_LENGTH) throw new FoldError(`Sequence ${seq.length} aa exceeds ESMFold's ${MAX_FOLD_LENGTH} aa limit.`);
      const esmPdb = await foldSequence(seq);
      const data = runCustomComparison(
        { name: "ESMFold", text: esmPdb, format: "pdb" },
        { name: "reference", text: refText, format: refFormat },
        { alignBy: "sequence", uniprot },
      );
      const r = data.result;
      setEsm({ rmsd: r.rmsd, tmScore: r.tmScore, gdtTs: r.gdtTs, lddt: r.lddt, nMatched: r.nMatched });
      setPhase("done");
    } catch (e) {
      setError(e instanceof FoldError ? e.message : (e as Error).message);
      setPhase("error");
    }
  }

  const better = (a: number, b: number, up: boolean) => (up ? a >= b : a <= b);

  return (
    <div className="faceoff-panel">
      <div className="search-head">
        <strong>Predictor face-off — AlphaFold vs ESMFold</strong>
        <button onClick={() => void run()} disabled={phase === "running"}>
          {phase === "running" ? "Folding with ESMFold…" : "Run face-off"}
        </button>
        <span className="muted small">Both vs the same experimental structure</span>
      </div>

      {phase === "error" && <p className="status error">{error}</p>}

      {esm && (
        <table className="validate-table">
          <thead>
            <tr><th>Metric</th><th>AlphaFold</th><th>ESMFold</th><th>Winner</th></tr>
          </thead>
          <tbody>
            {([
              ["RMSD (Å)", af.rmsd, esm.rmsd, false, 2],
              ["TM-score", af.tmScore, esm.tmScore, true, 3],
              ["GDT-TS", af.gdtTs, esm.gdtTs, true, 3],
              ["lDDT", af.lddt, esm.lddt, true, 3],
            ] as Array<[string, number, number, boolean, number]>).map(([label, a, b, up, dp]) => {
              const afWins = better(a, b, up);
              return (
                <tr key={label}>
                  <td>{label}</td>
                  <td className={afWins ? "faceoff-win" : ""}>{a.toFixed(dp)}</td>
                  <td className={!afWins ? "faceoff-win" : ""}>{b.toFixed(dp)}</td>
                  <td>{afWins ? "AlphaFold" : "ESMFold"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {phase === "done" && esm && (
        <p className="muted small">
          <Icon name="check" size={13} /> ESMFold matched {esm.nMatched} residues by sequence alignment.
        </p>
      )}
    </div>
  );
}
