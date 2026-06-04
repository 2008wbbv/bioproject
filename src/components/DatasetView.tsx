/**
 * Dataset-scale AlphaFold analytics — inspect many models at once and aggregate the
 * confidence science: a combined pLDDT distribution, mean confidence across the set,
 * and a ranked table (mean pLDDT, % disordered). Turns the single-protein tool into
 * a lightweight benchmarking platform.
 */
import { useMemo, useState } from "react";
import { inspectModel } from "../api/inspect.ts";
import { plddtSummary, disorderedRegions } from "../engine/disorder.ts";
import { mapWithConcurrency } from "../batch/pool.ts";
import { parseIdList } from "../batch/parseIds.ts";
import { PlddtHistogram } from "../charts/PlddtHistogram.tsx";
import { toCsv } from "../workspace/csv.ts";
import { Icon } from "../ui/Icon.tsx";
import { useToast } from "../ui/toast.tsx";

interface Row {
  accession: string;
  name: string;
  n: number;
  meanPlddt: number;
  fractionDisordered: number;
  fractionConfident: number;
  disorderRegions: number;
  plddts: number[];
  error?: string;
}

const PLACEHOLDER = `Paste UniProt accessions (one per line or comma-separated):
P04637
P24941
P38398
P0DTD1`;

export function DatasetView({ onOpen }: { onOpen: (accession: string) => void }) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const ids = useMemo(() => parseIdList(text), [text]);
  const ok = rows.filter((r) => !r.error);

  const aggregate = useMemo(() => {
    const all = ok.flatMap((r) => r.plddts);
    return { all, summary: plddtSummary(all) };
  }, [ok]);

  async function run() {
    if (ids.length === 0 || running) return;
    setRunning(true);
    setRows([]);
    setProgress(0);
    let done = 0;
    const results: Row[] = [];
    await mapWithConcurrency(ids, 3, async (id) => {
      try {
        const r = await inspectModel(id);
        const plddts = r.residues.map((x) => x.plddt);
        const s = plddtSummary(plddts);
        results.push({
          accession: r.accession,
          name: r.name,
          n: s.n,
          meanPlddt: s.mean,
          fractionDisordered: s.fractionDisordered,
          fractionConfident: s.fractionConfident,
          disorderRegions: disorderedRegions(r.residues).length,
          plddts,
        });
      } catch (e) {
        results.push({ accession: id, name: id, n: 0, meanPlddt: 0, fractionDisordered: 0, fractionConfident: 0, disorderRegions: 0, plddts: [], error: (e as Error).message });
      } finally {
        done++;
        setProgress(done);
        setRows([...results].sort((a, b) => b.meanPlddt - a.meanPlddt));
      }
    });
    setRunning(false);
    toast("Dataset analysis finished.", "success");
  }

  function exportCsv() {
    const csv = toCsv(
      ["accession", "protein", "residues", "mean_plddt", "fraction_disordered", "fraction_confident", "disorder_regions"],
      ok.map((r) => [r.accession, r.name, r.n, r.meanPlddt.toFixed(1), r.fractionDisordered.toFixed(3), r.fractionConfident.toFixed(3), r.disorderRegions]),
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "alphafold_dataset.csv";
    a.click();
  }

  return (
    <section className="dataset-view">
      <div className="view-head">
        <div>
          <h2>Dataset analytics</h2>
          <p className="muted">Inspect many AlphaFold models at once and see the confidence landscape across the set.</p>
        </div>
      </div>

      <textarea className="batch-input" rows={6} placeholder={PLACEHOLDER} value={text} onChange={(e) => setText(e.target.value)} disabled={running} />
      <div className="batch-controls">
        <button className="primary" onClick={() => void run()} disabled={running || ids.length === 0}>
          {running ? `Analyzing… ${progress}/${ids.length}` : `Analyze ${ids.length || ""} model${ids.length === 1 ? "" : "s"}`}
        </button>
        {ok.length > 0 && <button onClick={exportCsv}><Icon name="download" size={14} /> Export CSV</button>}
      </div>

      {running && <div className="progress"><div className="progress-bar" style={{ width: `${(progress / ids.length) * 100}%` }} /></div>}

      {ok.length > 0 && (
        <>
          <div className="metrics">
            <Stat label="Models" value={String(ok.length)} sub={`${aggregate.summary.n.toLocaleString()} residues`} />
            <Stat label="Mean pLDDT" value={aggregate.summary.mean.toFixed(1)} sub="across the set" />
            <Stat label="Confident" value={`${(aggregate.summary.fractionConfident * 100).toFixed(0)}%`} sub="pLDDT ≥ 70" />
            <Stat label="Disordered" value={`${(aggregate.summary.fractionDisordered * 100).toFixed(0)}%`} sub="pLDDT < 50" />
          </div>
          <div className="charts"><PlddtHistogram plddts={aggregate.all} /></div>
          <div className="dash-scroll">
            <table>
              <thead><tr><th>Protein</th><th>Residues</th><th>Mean pLDDT</th><th>Confident</th><th>Disordered</th><th>IDRs</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.accession} className={r.error ? "row-wrong" : ""}>
                    <td>{r.error ? <span className="muted">{r.accession} — {r.error}</span> : <button className="link strong" onClick={() => onOpen(r.accession)}>{r.name}</button>}</td>
                    <td>{r.n || ""}</td>
                    <td>{r.error ? "" : r.meanPlddt.toFixed(1)}</td>
                    <td>{r.error ? "" : `${(r.fractionConfident * 100).toFixed(0)}%`}</td>
                    <td>{r.error ? "" : `${(r.fractionDisordered * 100).toFixed(0)}%`}</td>
                    <td>{r.error ? "" : r.disorderRegions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="metric">
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-hint muted">{sub}</div>
    </div>
  );
}
