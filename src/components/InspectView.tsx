/**
 * AlphaFold model inspector — works on any protein, no experimental structure
 * needed. Fetches the AlphaFold model, shows its pLDDT confidence (distribution,
 * bands, predicted disordered regions), PAE + domains, and a pLDDT-coloured 3D view.
 * The "companion" view: just look at what AlphaFold predicted.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { inspectModel, type InspectResult } from "../api/inspect.ts";
import { fetchPae } from "../api/alphafold.ts";
import { ApiError } from "../api/errors.ts";
import { plddtSummary, disorderedRegions, type DisorderRegion } from "../engine/disorder.ts";
import { segmentDomains } from "../engine/paeDomains.ts";
import { PlddtHistogram } from "../charts/PlddtHistogram.tsx";
import { PaePanel } from "./PaePanel.tsx";
import { ViewerErrorBoundary } from "../viewer/ErrorBoundary.tsx";
import { Icon } from "../ui/Icon.tsx";

const ModelViewer = lazy(() => import("../viewer/ModelViewer.tsx").then((m) => ({ default: m.ModelViewer })));

const EXAMPLES = [
  { label: "BRCA1 (P38398)", q: "P38398" },
  { label: "α-synuclein (P37840)", q: "P37840" },
  { label: "TP53 (P04637)", q: "P04637" },
];

export function InspectView({ onCompare, initialQuery }: { onCompare: (accession: string) => void; initialQuery?: string | null }) {
  const [query, setQuery] = useState("");
  const lastInit = useRef<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [error, setError] = useState("");
  const [data, setData] = useState<InspectResult | null>(null);
  const [domains, setDomains] = useState<Array<{ start: number; end: number }> | null>(null);

  async function run(q: string) {
    const t = q.trim();
    if (!t) return;
    setStatus("loading");
    setError("");
    setDomains(null);
    try {
      const r = await inspectModel(t);
      setData(r);
      setStatus("done");
      // domains are best-effort (need the PAE)
      if (r.paeUrl) {
        fetchPae(r.paeUrl)
          .then((pae) => pae && setDomains(segmentDomains(pae.matrix).map((d) => ({ start: d.start + 1, end: d.end + 1 }))))
          .catch(() => {});
      }
    } catch (e) {
      setError(e instanceof ApiError ? `${e.source}: ${e.message}` : (e as Error).message);
      setStatus("error");
    }
  }

  // Auto-run when opened with an accession (e.g. "Inspect model" from a comparison).
  useEffect(() => {
    if (initialQuery && initialQuery !== lastInit.current) {
      lastInit.current = initialQuery;
      setQuery(initialQuery);
      void run(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const plddts = useMemo(() => (data ? data.residues.map((r) => r.plddt) : []), [data]);
  const summary = useMemo(() => plddtSummary(plddts), [plddts]);
  const disorder = useMemo<DisorderRegion[]>(() => (data ? disorderedRegions(data.residues) : []), [data]);

  function downloadModel() {
    if (!data) return;
    const blob = new Blob([data.pdbText], { type: "chemical/x-pdb" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AF-${data.accession}.pdb`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="inspect-view">
      <div className="view-head">
        <div>
          <h2>Inspect an AlphaFold model</h2>
          <p className="muted">
            Look at what AlphaFold predicted for any protein — confidence, predicted disorder, PAE, and domains —
            no experimental structure required.
          </p>
        </div>
      </div>

      <form className="search" onSubmit={(e) => { e.preventDefault(); void run(query); }}>
        <input type="text" placeholder="Protein name or UniProt accession" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="submit" disabled={status === "loading"}>{status === "loading" ? "Loading…" : "Inspect"}</button>
      </form>
      <div className="examples">
        <span className="muted">Try:</span>
        {EXAMPLES.map((ex) => (
          <button key={ex.q} className="link" onClick={() => { setQuery(ex.q); void run(ex.q); }}>{ex.label}</button>
        ))}
      </div>

      {status === "error" && <p className="status error">{error}</p>}

      {status === "done" && data && (
        <div className="results">
          <div className="result-head">
            <h2>{data.name} <span className="muted">({data.accession})</span></h2>
            <div className="export-group">
              <button onClick={downloadModel}><Icon name="download" size={14} /> Model PDB</button>
              <button onClick={() => onCompare(data.accession)}><Icon name="layers" size={14} /> Compare to experimental</button>
            </div>
          </div>

          <div className="metrics">
            <Metric label="Mean pLDDT" value={summary.mean.toFixed(1)} hint="overall confidence" />
            <Metric label="Very high" value={`${(summary.fractionVeryHigh * 100).toFixed(0)}%`} hint="pLDDT > 90" />
            <Metric label="Confident" value={`${(summary.fractionConfident * 100).toFixed(0)}%`} hint="pLDDT ≥ 70" />
            <Metric label="Disordered" value={`${(summary.fractionDisordered * 100).toFixed(0)}%`} hint="pLDDT < 50" />
            <Metric label="Residues" value={String(summary.n)} hint="in the model" />
          </div>

          <div className="charts">
            <PlddtHistogram plddts={plddts} />
            <div className="chart">
              <figcaption>Predicted disordered regions {disorder.length ? `(${disorder.length})` : ""}</figcaption>
              {disorder.length === 0 ? (
                <p className="muted">No long low-confidence stretches — the model is confident throughout.</p>
              ) : (
                <table className="validate-table">
                  <thead><tr><th>Region</th><th>Length</th><th>Mean pLDDT</th></tr></thead>
                  <tbody>
                    {disorder.map((d) => (
                      <tr key={`${d.start}-${d.end}`}><td>{d.start}–{d.end}</td><td>{d.length}</td><td>{d.meanPlddt.toFixed(0)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {domains && domains.length > 1 && (
            <p className="muted small">PAE domains: {domains.map((d) => `${d.start}–${d.end}`).join(", ")}</p>
          )}

          <div className="viewer-block">
            <div className="viewer-toolbar">
              <strong>3D model</strong>
              <span className="muted legend">blue = high confidence → red = low confidence (disorder)</span>
            </div>
            <ViewerErrorBoundary>
              <Suspense fallback={<div className="viewer-error">Loading 3D viewer…</div>}>
                <ModelViewer pdbText={data.pdbText} />
              </Suspense>
            </ViewerErrorBoundary>
          </div>

          {data.paeUrl && <PaePanel paeUrl={data.paeUrl} />}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="metric">
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-hint muted">{hint}</div>
    </div>
  );
}
