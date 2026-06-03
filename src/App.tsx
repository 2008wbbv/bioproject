/**
 * App shell (SPEC §1) + workspace. Compare a protein, then save/favorite/annotate
 * it, browse past comparisons in a dashboard, view the per-residue data in a sheet,
 * and export to Excel/CSV. Persistence is IndexedDB (src/workspace).
 */
import { lazy, Suspense, useMemo, useState } from "react";
import { runComparison } from "./api/pipeline.ts";
import type { RankedStructure } from "./api/pdbe.ts";
import { ApiError } from "./api/errors.ts";
import { ScatterPlddtDeviation } from "./charts/ScatterPlddtDeviation.tsx";
import { DeviationTrack } from "./charts/DeviationTrack.tsx";
import type { ColorMode } from "./viewer/MolstarViewer.tsx";
import { ViewerErrorBoundary } from "./viewer/ErrorBoundary.tsx";
import { prepareViewerModels } from "./viewer/prepareModels.ts";
import { DataSheet } from "./components/DataSheet.tsx";
import { NotesEditor } from "./components/NotesEditor.tsx";
import { Dashboard } from "./workspace/Dashboard.tsx";
import { BatchView } from "./batch/BatchView.tsx";
import { useWorkspace } from "./workspace/useWorkspace.ts";
import type { StoredStructures, WorkspaceEntry } from "./workspace/types.ts";
import { exportEntryXlsx, exportEntryCsv } from "./workspace/export.ts";
import "./styles.css";

const MolstarViewer = lazy(() =>
  import("./viewer/MolstarViewer.tsx").then((m) => ({ default: m.MolstarViewer })),
);

type Status = "idle" | "loading" | "error" | "done";
type View = "compare" | "batch" | "workspace";

interface Active {
  id: string;
  structures?: StoredStructures;
  alternatives?: RankedStructure[];
}

const EXAMPLES = [
  { label: "p53 (P04637)", query: "P04637" },
  { label: "CDK2 (P24941)", query: "P24941" },
  { label: "Lysozyme (P00698)", query: "P00698" },
];

export function App() {
  const ws = useWorkspace();
  const [view, setView] = useState<View>("compare");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [active, setActive] = useState<Active | null>(null);

  async function run(q: string, pdbId?: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setStatus("loading");
    setError("");
    setView("compare");
    try {
      const data = await runComparison(trimmed, pdbId ? { pdbId } : {});
      const entry = await ws.saveResult(trimmed, data);
      setActive({
        id: entry.id,
        structures: {
          id: entry.id,
          afPdbText: data.afPdbText,
          expCifText: data.expCifText,
          superposition: data.superposition,
        },
        alternatives: data.alternatives,
      });
      setStatus("done");
    } catch (e) {
      setError(e instanceof ApiError ? `${e.source}: ${e.message}` : (e as Error).message);
      setStatus("error");
    }
  }

  async function openEntry(entry: WorkspaceEntry) {
    setQuery(entry.query);
    const structures = await ws.loadStructures(entry.id);
    setActive({ id: entry.id, structures });
    setStatus("done");
    setView("compare");
  }

  const liveEntry = active ? ws.entries.find((e) => e.id === active.id) ?? null : null;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>AlphaFold vs Experimental</h1>
          <p className="tagline">
            How well does AlphaFold match the real structure — and where was it{" "}
            <em>confidently wrong</em>?
          </p>
        </div>
        <nav className="nav">
          <button className={view === "compare" ? "on" : ""} onClick={() => setView("compare")}>
            Compare
          </button>
          <button className={view === "batch" ? "on" : ""} onClick={() => setView("batch")}>
            Batch
          </button>
          <button className={view === "workspace" ? "on" : ""} onClick={() => setView("workspace")}>
            Workspace{ws.entries.length ? ` (${ws.entries.length})` : ""}
          </button>
        </nav>
      </header>

      {view === "compare" && (
        <>
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
              <button key={ex.query} className="link" type="button" onClick={() => { setQuery(ex.query); void run(ex.query); }}>
                {ex.label}
              </button>
            ))}
          </div>

          {status === "loading" && <p className="status">Fetching structures and computing…</p>}
          {status === "error" && <p className="status error">{error}</p>}

          {status === "done" && active && liveEntry && (
            <Results
              entry={liveEntry}
              structures={active.structures}
              alternatives={active.alternatives}
              onPickStructure={(pdb) => run(liveEntry.query || liveEntry.uniprot, pdb)}
              onToggleFavorite={() => void ws.toggleFavorite(liveEntry.id)}
              onNotes={(n) => void ws.setNotes(liveEntry.id, n)}
            />
          )}
        </>
      )}

      {view === "batch" && <BatchView ws={ws} onOpen={openEntry} />}

      {view === "workspace" && <Dashboard ws={ws} onOpen={openEntry} />}

      <footer className="app-footer">
        <span className="muted">
          Native TypeScript engine · client-only · metrics computed in-browser · saved to IndexedDB.
        </span>
      </footer>
    </div>
  );
}

function Results({
  entry,
  structures,
  alternatives,
  onPickStructure,
  onToggleFavorite,
  onNotes,
}: {
  entry: WorkspaceEntry;
  structures?: StoredStructures;
  alternatives?: RankedStructure[];
  onPickStructure: (pdbId: string) => void;
  onToggleFavorite: () => void;
  onNotes: (notes: string) => void;
}) {
  const [mode, setMode] = useState<ColorMode>("deviation");
  const [showSheet, setShowSheet] = useState(false);

  const models = useMemo(
    () => (structures ? prepareViewerModels(structures.afPdbText, structures.superposition, entry.perResidue) : null),
    [structures, entry.perResidue],
  );

  return (
    <section className="results">
      <div className="result-head">
        <h2>
          <button
            className={`star big ${entry.favorite ? "on" : ""}`}
            onClick={onToggleFavorite}
            title={entry.favorite ? "Unfavorite" : "Favorite"}
          >
            {entry.favorite ? "★" : "☆"}
          </button>
          {entry.proteinName} <span className="muted">({entry.uniprot})</span>
        </h2>
        <div className="result-actions">
          {alternatives && alternatives.length > 0 && (
            <div className="structure-pick">
              <label htmlFor="pdb">Structure:</label>
              <select id="pdb" value={entry.pdbId.toLowerCase()} onChange={(e) => onPickStructure(e.target.value)}>
                {alternatives.slice(0, 25).map((s) => (
                  <option key={s.pdb_id} value={s.pdb_id.toLowerCase()}>
                    {s.pdb_id.toUpperCase()} · {s.experimental_method ?? "?"} ·{" "}
                    {s.resolution ? `${s.resolution.toFixed(1)} Å` : "—"} · cov {((s.coverage ?? 0) * 100).toFixed(0)}%
                  </option>
                ))}
              </select>
            </div>
          )}
          <span className="muted">{entry.pdbId} · chain {entry.chain}</span>
          <div className="export-group">
            <button onClick={() => exportEntryXlsx(entry)}>Export Excel</button>
            <button onClick={() => exportEntryCsv(entry)}>CSV</button>
          </div>
        </div>
      </div>

      <div className="metrics">
        <Metric label="RMSD" value={`${entry.rmsd.toFixed(2)} Å`} hint="Cα, after superposition" />
        <Metric label="TM-score" value={entry.tmScore.toFixed(3)} hint="1.0 = identical fold" />
        <Metric label="GDT-TS" value={entry.gdtTs.toFixed(3)} hint="fraction within 1–8 Å" />
        <Metric
          label="pLDDT–error ρ"
          value={Number.isNaN(entry.plddtErrorSpearman) ? "n/a" : entry.plddtErrorSpearman.toFixed(3)}
          hint="Spearman; negative = confident & accurate"
        />
        <Metric label="Matched" value={`${entry.nMatched}`} hint="Cα residue pairs" />
      </div>

      {entry.warnings.length > 0 && (
        <ul className="warnings">
          {entry.warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}

      <div className="charts">
        <ScatterPlddtDeviation perResidue={entry.perResidue} spearman={entry.plddtErrorSpearman} />
        <DeviationTrack perResidue={entry.perResidue} />
      </div>

      <NotesEditor value={entry.notes} onSave={onNotes} />

      <div className="sheet-toggle">
        <button onClick={() => setShowSheet((v) => !v)}>
          {showSheet ? "Hide data sheet" : "Show data sheet"}
        </button>
      </div>
      {showSheet && <DataSheet perResidue={entry.perResidue} />}

      <div className="viewer-block">
        <div className="viewer-toolbar">
          <strong>3D overlay</strong>
          {models ? (
            <>
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
            </>
          ) : (
            <span className="muted">Structures not cached for this entry — re-run to view in 3D.</span>
          )}
        </div>
        {models && structures && (
          <ViewerErrorBoundary>
            <Suspense fallback={<div className="viewer-error">Loading 3D viewer…</div>}>
              <MolstarViewer models={models} expCifText={structures.expCifText} mode={mode} />
            </Suspense>
          </ViewerErrorBoundary>
        )}
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
