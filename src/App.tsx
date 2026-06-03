/**
 * App shell (SPEC §1). Enter a protein name or UniProt accession, run the full
 * pipeline, and show the metrics, the pLDDT-vs-deviation charts (the scientific
 * payload), and the Mol* 3D overlay with a deviation/pLDDT colour toggle.
 */
import { lazy, Suspense, useMemo, useState } from "react";
import { runComparison, type PipelineResult } from "./api/pipeline.ts";
import { ApiError } from "./api/errors.ts";
import { ScatterPlddtDeviation } from "./charts/ScatterPlddtDeviation.tsx";
import { DeviationTrack } from "./charts/DeviationTrack.tsx";
import type { ColorMode } from "./viewer/MolstarViewer.tsx";
import { ViewerErrorBoundary } from "./viewer/ErrorBoundary.tsx";
import { prepareViewerModels } from "./viewer/prepareModels.ts";
import "./styles.css";

// Mol* is large; load it only once a comparison is shown so the initial bundle
// stays small. `import type { ColorMode }` above is erased and does not pull it in.
const MolstarViewer = lazy(() =>
  import("./viewer/MolstarViewer.tsx").then((m) => ({ default: m.MolstarViewer })),
);

type Status = "idle" | "loading" | "error" | "done";

const EXAMPLES = [
  { label: "p53 (P04637)", query: "P04637" },
  { label: "CDK2 (P24941)", query: "P24941" },
  { label: "Lysozyme (P00698)", query: "P00698" },
];

export function App() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<PipelineResult | null>(null);
  const [mode, setMode] = useState<ColorMode>("deviation");

  async function run(q: string, pdbId?: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setStatus("loading");
    setError("");
    try {
      const result = await runComparison(trimmed, pdbId ? { pdbId } : {});
      setData(result);
      setStatus("done");
    } catch (e) {
      const msg = e instanceof ApiError ? `${e.source}: ${e.message}` : (e as Error).message;
      setError(msg);
      setStatus("error");
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>AlphaFold vs Experimental</h1>
        <p className="tagline">
          How well does AlphaFold match the real structure — and where was it{" "}
          <em>confidently wrong</em>?
        </p>
      </header>

      <form
        className="search"
        onSubmit={(e) => {
          e.preventDefault();
          void run(query);
        }}
      >
        <input
          type="text"
          placeholder="Protein name or UniProt accession (e.g. p53 or P04637)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Protein name or UniProt accession"
        />
        <button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Comparing…" : "Compare"}
        </button>
      </form>

      <div className="examples">
        <span className="muted">Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.query}
            className="link"
            type="button"
            onClick={() => {
              setQuery(ex.query);
              void run(ex.query);
            }}
          >
            {ex.label}
          </button>
        ))}
      </div>

      {status === "loading" && <p className="status">Fetching structures and computing…</p>}
      {status === "error" && <p className="status error">{error}</p>}

      {status === "done" && data && (
        <Results data={data} mode={mode} setMode={setMode} onPickStructure={(pdb) => run(query || data.result.uniprot, pdb)} />
      )}

      <footer className="app-footer">
        <span className="muted">
          Native TypeScript engine · client-only · see SPEC.md. Metrics computed in-browser.
        </span>
      </footer>
    </div>
  );
}

function Results({
  data,
  mode,
  setMode,
  onPickStructure,
}: {
  data: PipelineResult;
  mode: ColorMode;
  setMode: (m: ColorMode) => void;
  onPickStructure: (pdbId: string) => void;
}) {
  const { result } = data;
  const models = useMemo(
    () => prepareViewerModels(data.afPdbText, data.superposition, result.perResidue),
    [data.afPdbText, data.superposition, result.perResidue],
  );

  return (
    <section className="results">
      <div className="result-head">
        <h2>
          {data.proteinName} <span className="muted">({result.uniprot})</span>
        </h2>
        <div className="structure-pick">
          <label htmlFor="pdb">Experimental structure:</label>
          <select
            id="pdb"
            value={result.pdbId.toLowerCase()}
            onChange={(e) => onPickStructure(e.target.value)}
          >
            {data.alternatives.slice(0, 25).map((s) => (
              <option key={s.pdb_id} value={s.pdb_id.toLowerCase()}>
                {s.pdb_id.toUpperCase()} · {s.experimental_method ?? "?"} ·{" "}
                {s.resolution ? `${s.resolution.toFixed(1)} Å` : "—"} · cov{" "}
                {((s.coverage ?? 0) * 100).toFixed(0)}%
              </option>
            ))}
          </select>
          <span className="muted">chain {data.chosenChain}</span>
        </div>
      </div>

      <div className="metrics">
        <Metric label="RMSD" value={`${result.rmsd.toFixed(2)} Å`} hint="Cα, after superposition" />
        <Metric label="TM-score" value={result.tmScore.toFixed(3)} hint="1.0 = identical fold" />
        <Metric label="GDT-TS" value={result.gdtTs.toFixed(3)} hint="fraction within 1–8 Å" />
        <Metric
          label="pLDDT–error ρ"
          value={Number.isNaN(result.plddtErrorSpearman) ? "n/a" : result.plddtErrorSpearman.toFixed(3)}
          hint="Spearman; negative = confident & accurate"
        />
        <Metric label="Matched" value={`${result.nMatched}`} hint="Cα residue pairs" />
      </div>

      {result.warnings.length > 0 && (
        <ul className="warnings">
          {result.warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}

      <div className="charts">
        <ScatterPlddtDeviation perResidue={result.perResidue} spearman={result.plddtErrorSpearman} />
        <DeviationTrack perResidue={result.perResidue} />
      </div>

      <div className="viewer-block">
        <div className="viewer-toolbar">
          <strong>3D overlay</strong>
          <div className="toggle">
            <button className={mode === "deviation" ? "on" : ""} onClick={() => setMode("deviation")}>
              Deviation (Å)
            </button>
            <button className={mode === "plddt" ? "on" : ""} onClick={() => setMode("plddt")}>
              pLDDT
            </button>
          </div>
          <span className="muted legend">
            grey = experimental · blue = {mode === "deviation" ? "agree" : "high confidence"} → red ={" "}
            {mode === "deviation" ? "disagree" : "low confidence"}
          </span>
        </div>
        <ViewerErrorBoundary>
          <Suspense fallback={<div className="viewer-error">Loading 3D viewer…</div>}>
            <MolstarViewer models={models} expCifText={data.expCifText} mode={mode} />
          </Suspense>
        </ViewerErrorBoundary>
      </div>
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
