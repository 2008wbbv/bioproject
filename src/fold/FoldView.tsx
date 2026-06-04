/**
 * Fold-your-own-sequence queue (an AlphaFold-style predict step). Paste one or many
 * sequences (FASTA or bare), queue them, and ESMFold returns a 3D model with pLDDT —
 * which you can download or push straight into a comparison.
 */
import { useMemo, useState } from "react";
import { parseFasta, MAX_FOLD_LENGTH, type SeqRecord } from "./parseFasta.ts";
import { foldSequence, meanPlddt, FoldError } from "./esmfold.ts";
import { mapWithConcurrency } from "../batch/pool.ts";
import type { UploadedFile } from "../api/pipeline.ts";
import { Icon } from "../ui/Icon.tsx";
import { useToast } from "../ui/toast.tsx";

type JobStatus = "pending" | "folding" | "done" | "error";
interface FoldJob {
  name: string;
  seq: string;
  status: JobStatus;
  pdb?: string;
  plddt?: number;
  error?: string;
}

const PLACEHOLDER = `Paste a sequence, or FASTA with >headers:

>my_protein
MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKR`;

function plddtColor(v: number): string {
  if (v >= 90) return "#2563eb";
  if (v >= 70) return "#38bdf8";
  if (v >= 50) return "#fbbf24";
  return "#f97316";
}

export function FoldView({ onUseModel }: { onUseModel: (file: UploadedFile) => void }) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [jobs, setJobs] = useState<FoldJob[]>([]);
  const [running, setRunning] = useState(false);

  const records = useMemo(() => parseFasta(text), [text]);
  const tooLong = records.filter((r) => r.seq.length > MAX_FOLD_LENGTH);
  const foldable = records.filter((r) => r.seq.length >= 16 && r.seq.length <= MAX_FOLD_LENGTH);

  function download(job: FoldJob) {
    const blob = new Blob([job.pdb!], { type: "chemical/x-pdb" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job.name.replace(/\s+/g, "_")}_esmfold.pdb`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function start() {
    if (foldable.length === 0 || running) return;
    setRunning(true);
    const recs: SeqRecord[] = foldable;
    setJobs(recs.map((r) => ({ ...r, status: "pending" })));
    await mapWithConcurrency(recs, 2, async (rec, i) => {
      setJobs((j) => j.map((x, k) => (k === i ? { ...x, status: "folding" } : x)));
      try {
        const pdb = await foldSequence(rec.seq);
        setJobs((j) => j.map((x, k) => (k === i ? { ...x, status: "done", pdb, plddt: meanPlddt(pdb) } : x)));
      } catch (e) {
        const msg = e instanceof FoldError ? e.message : (e as Error).message;
        setJobs((j) => j.map((x, k) => (k === i ? { ...x, status: "error", error: msg } : x)));
      }
    });
    setRunning(false);
    toast("Folding finished.", "success");
  }

  return (
    <section className="fold-view">
      <div className="view-head">
        <div>
          <h2>Fold a sequence</h2>
          <p className="muted">
            Predict a 3D structure from sequence with ESMFold, then download it or compare it against an
            experimental structure. Up to {MAX_FOLD_LENGTH} residues per sequence · runs best-effort on a public API.
          </p>
        </div>
      </div>

      <textarea
        className="batch-input"
        rows={7}
        placeholder={PLACEHOLDER}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={running}
      />

      <div className="batch-controls">
        <button className="primary" onClick={() => void start()} disabled={running || foldable.length === 0}>
          {running ? "Folding…" : `Fold ${foldable.length || ""} sequence${foldable.length === 1 ? "" : "s"}`}
        </button>
        {tooLong.length > 0 && (
          <span className="muted">
            <Icon name="alert" size={13} /> {tooLong.length} sequence(s) over {MAX_FOLD_LENGTH} aa skipped
          </span>
        )}
      </div>

      {jobs.length > 0 && (
        <div className="fold-jobs">
          {jobs.map((job, i) => (
            <div key={`${job.name}-${i}`} className="fold-job">
              <div className="fold-job-head">
                <span className={`badge badge-${job.status === "folding" ? "running" : job.status}`}>{job.status}</span>
                <strong className="fold-job-name">{job.name}</strong>
                <span className="muted small">{job.seq.length} aa</span>
              </div>
              {job.status === "done" && (
                <>
                  <div className="plddt-bar" title={`mean pLDDT ${job.plddt!.toFixed(0)}`}>
                    <div className="plddt-fill" style={{ width: `${job.plddt}%`, background: plddtColor(job.plddt!) }} />
                    <span className="plddt-text">pLDDT {job.plddt!.toFixed(0)}</span>
                  </div>
                  <div className="fold-job-actions">
                    <button onClick={() => download(job)}><Icon name="download" size={14} /> PDB</button>
                    <button onClick={() => onUseModel({ name: `${job.name}.pdb`, text: job.pdb!, format: "pdb" })}>
                      <Icon name="layers" size={14} /> Use in comparison
                    </button>
                  </div>
                </>
              )}
              {job.status === "error" && <span className="muted small">{job.error}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
