/**
 * Fold-your-own-sequence queue. Paste sequences (FASTA or bare), pick a backend
 * (ESMFold by default, or your own AlphaFold/ColabFold endpoint), and a persistent
 * queue folds them — surviving reloads. Each result downloads or flows into a
 * comparison.
 */
import { useMemo, useState } from "react";
import { parseFasta, MAX_FOLD_LENGTH } from "./parseFasta.ts";
import { useFoldQueue } from "./useFoldQueue.ts";
import { BACKENDS, loadFoldConfig, saveFoldConfig, type BackendId, type FoldConfig } from "./backends.ts";
import type { FoldJob } from "./foldDb.ts";
import type { UploadedFile } from "../api/pipeline.ts";
import { Icon } from "../ui/Icon.tsx";
import { useToast } from "../ui/toast.tsx";

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
  const queue = useFoldQueue();
  const [text, setText] = useState("");
  const [backend, setBackend] = useState<BackendId>("esmfold");
  const [config, setConfig] = useState<FoldConfig>(loadFoldConfig);

  const records = useMemo(() => parseFasta(text), [text]);
  const tooLong = records.filter((r) => r.seq.length > MAX_FOLD_LENGTH && backend === "esmfold");
  const foldable = records.filter((r) => r.seq.length >= 16 && (backend !== "esmfold" || r.seq.length <= MAX_FOLD_LENGTH));
  const needsConfig = backend === "custom";
  const blocked = needsConfig && !config.endpoint;

  function updateConfig(c: FoldConfig) {
    setConfig(c);
    saveFoldConfig(c);
  }

  async function submit() {
    if (foldable.length === 0 || blocked) return;
    await queue.enqueue(foldable, backend);
    setText("");
    toast(`Queued ${foldable.length} sequence${foldable.length === 1 ? "" : "s"}.`, "success");
  }

  function download(job: FoldJob) {
    const blob = new Blob([job.pdb!], { type: "chemical/x-pdb" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job.name.replace(/\s+/g, "_")}_${job.backend}.pdb`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const done = queue.jobs.filter((j) => j.status === "done").length;

  return (
    <section className="fold-view">
      <div className="view-head">
        <div>
          <h2>Fold a sequence</h2>
          <p className="muted">
            Predict a 3D structure from sequence, then download it or compare it against an experimental structure.
            The queue is persistent — it keeps folding even if you navigate away.
          </p>
        </div>
      </div>

      <div className="fold-backends">
        {BACKENDS.map((b) => (
          <button key={b.id} className={`backend-card ${backend === b.id ? "on" : ""}`} onClick={() => setBackend(b.id)}>
            <Icon name={b.id === "custom" ? "beaker" : "flask"} size={16} />
            <div>
              <div className="backend-label">{b.label}</div>
              <div className="muted small">{b.description}</div>
            </div>
          </button>
        ))}
      </div>

      {needsConfig && (
        <div className="fold-config">
          <input
            type="url"
            placeholder="Folding endpoint URL (POST sequence → PDB)"
            value={config.endpoint}
            onChange={(e) => updateConfig({ ...config, endpoint: e.target.value })}
          />
          <input
            type="password"
            placeholder="API key (optional, sent as Bearer token)"
            value={config.apiKey}
            onChange={(e) => updateConfig({ ...config, apiKey: e.target.value })}
          />
          <p className="muted small">
            Point at your own AlphaFold2/ColabFold service or an NVIDIA NIM endpoint. The request body is{" "}
            <code>{`{"sequence": "..."}`}</code>; we accept a PDB or JSON containing one. Nothing is sent anywhere
            else.
          </p>
        </div>
      )}

      <textarea
        className="batch-input"
        rows={6}
        placeholder={PLACEHOLDER}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="batch-controls">
        <button className="primary" onClick={() => void submit()} disabled={foldable.length === 0 || blocked}>
          {`Fold ${foldable.length || ""} sequence${foldable.length === 1 ? "" : "s"}`}
        </button>
        {blocked && <span className="muted small"><Icon name="alert" size={13} /> Set an endpoint above</span>}
        {tooLong.length > 0 && (
          <span className="muted small"><Icon name="alert" size={13} /> {tooLong.length} over {MAX_FOLD_LENGTH} aa (ESMFold limit)</span>
        )}
        {queue.running > 0 && <span className="muted small">Folding {queue.running}…</span>}
      </div>

      {queue.jobs.length > 0 && (
        <>
          <div className="fold-queue-head">
            <strong>Queue</strong>
            <span className="muted small">{done}/{queue.jobs.length} done</span>
            <div className="spacer" />
            <button className="link" onClick={() => void queue.clear()}>Clear queue</button>
          </div>
          <div className="fold-jobs">
            {queue.jobs.map((job) => (
              <div key={job.id} className="fold-job">
                <div className="fold-job-head">
                  <span className={`badge badge-${job.status === "folding" ? "running" : job.status === "queued" ? "pending" : job.status}`}>{job.status}</span>
                  <strong className="fold-job-name">{job.name}</strong>
                  <span className="muted small">{job.seq.length} aa · {job.backend}</span>
                  <div className="spacer" />
                  <button className="icon-btn" title="Remove" onClick={() => void queue.remove(job.id)}><Icon name="close" size={14} /></button>
                </div>
                {job.status === "done" && job.pdb && (
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
                {job.status === "error" && (
                  <div className="fold-job-actions">
                    <span className="muted small">{job.error}</span>
                    <button onClick={() => void queue.retry(job.id)}><Icon name="retry" size={14} /> Retry</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
