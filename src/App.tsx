/**
 * App shell (SPEC §1) + workspace. Compare a protein, then save/favorite/annotate
 * it, browse past comparisons in a dashboard, view the per-residue data in a sheet,
 * and export to Excel/CSV. Persistence is IndexedDB (src/workspace).
 */
import { lazy, Suspense, useMemo, useState } from "react";
import { runComparison, runCustomComparison, type PipelineResult, type UploadedFile } from "./api/pipeline.ts";
import type { RankedStructure } from "./api/pdbe.ts";
import { ApiError } from "./api/errors.ts";
import { ScatterPlddtDeviation } from "./charts/ScatterPlddtDeviation.tsx";
import { DeviationTrack } from "./charts/DeviationTrack.tsx";
import type { ColorMode } from "./viewer/MolstarViewer.tsx";
import { ViewerErrorBoundary } from "./viewer/ErrorBoundary.tsx";
import { prepareViewerModels } from "./viewer/prepareModels.ts";
import { DataSheet } from "./components/DataSheet.tsx";
import { NotesEditor } from "./components/NotesEditor.tsx";
import { ConfidenceSummary } from "./components/ConfidenceSummary.tsx";
import { UploadPanel } from "./components/UploadPanel.tsx";
import { SearchPanel } from "./search/SearchPanel.tsx";
import { Dashboard } from "./workspace/Dashboard.tsx";
import { BatchView } from "./batch/BatchView.tsx";
import { useWorkspace } from "./workspace/useWorkspace.ts";
import type { StoredStructures, WorkspaceEntry } from "./workspace/types.ts";
import { exportEntryXlsx, exportEntryCsv, exportEntryLog } from "./workspace/export.ts";
import { transformPdb } from "./engine/pdbTransform.ts";
import { ValidationPanel } from "./components/ValidationPanel.tsx";
import { TagEditor } from "./components/TagEditor.tsx";
import { useTheme } from "./useTheme.ts";
import "./styles.css";

/** Build the StoredStructures-shaped object the viewer uses from a pipeline result. */
function structuresOf(id: string, data: PipelineResult): StoredStructures {
  return {
    id,
    modelText: data.modelText,
    modelFormat: data.modelFormat,
    refText: data.refText,
    refFormat: data.refFormat,
    modelCaPdb: data.modelCaPdb,
    refCaPdb: data.refCaPdb,
    superposition: data.superposition,
  };
}

const MolstarViewer = lazy(() =>
  import("./viewer/MolstarViewer.tsx").then((m) => ({ default: m.MolstarViewer })),
);

type Status = "idle" | "loading" | "error" | "done";
type View = "dashboard" | "compare" | "batch";

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
  const [view, setView] = useState<View>("dashboard");
  const [theme, setTheme] = useTheme();
  const [compareMode, setCompareMode] = useState<"database" | "upload">("database");
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
      setActive({ id: entry.id, structures: structuresOf(entry.id, data), alternatives: data.alternatives });
      setStatus("done");
    } catch (e) {
      setError(e instanceof ApiError ? `${e.source}: ${e.message}` : (e as Error).message);
      setStatus("error");
    }
  }

  async function runUpload(model: UploadedFile, ref: UploadedFile, uniprot?: string) {
    setStatus("loading");
    setError("");
    setView("compare");
    try {
      const data = runCustomComparison(model, ref, uniprot ? { uniprot } : {});
      const label = `${model.name} vs ${ref.name}`;
      const entry = await ws.saveResult(label, data);
      setActive({ id: entry.id, structures: structuresOf(entry.id, data) });
      setStatus("done");
    } catch (e) {
      setError((e as Error).message);
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
          <h1>OpenFoldUI</h1>
          <p className="tagline">
            Compare a predicted structure against the real one — and see where the model was{" "}
            <em>confidently wrong</em>. AlphaFold-DB or your own files.
          </p>
        </div>
        <div className="header-right">
          <nav className="nav">
            <button className={view === "dashboard" ? "on" : ""} onClick={() => setView("dashboard")}>
              Dashboard{ws.entries.length ? ` (${ws.entries.length})` : ""}
            </button>
            <button className={view === "compare" ? "on" : ""} onClick={() => setView("compare")}>
              Compare
            </button>
            <button className={view === "batch" ? "on" : ""} onClick={() => setView("batch")}>
              Batch
            </button>
          </nav>
          <button
            className="theme-toggle"
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </header>

      {view === "compare" && (
        <>
          <div className="mode-tabs">
            <button className={compareMode === "database" ? "on" : ""} onClick={() => setCompareMode("database")}>
              From database
            </button>
            <button className={compareMode === "upload" ? "on" : ""} onClick={() => setCompareMode("upload")}>
              Upload files
            </button>
          </div>

          {compareMode === "database" ? (
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
            </>
          ) : (
            <UploadPanel onCompare={runUpload} busy={status === "loading"} />
          )}

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
              onTags={(t) => void ws.setTags(liveEntry.id, t)}
              onCompareAccession={(acc) => { setQuery(acc); void run(acc); }}
            />
          )}
        </>
      )}

      {view === "dashboard" && (
        <Dashboard
          ws={ws}
          onOpen={openEntry}
          onQuickCompare={(q) => { setQuery(q); setCompareMode("database"); void run(q); }}
          onUpload={() => { setCompareMode("upload"); setView("compare"); }}
          examples={EXAMPLES}
        />
      )}

      {view === "batch" && <BatchView ws={ws} onOpen={openEntry} />}

      <footer className="app-footer">
        <span className="muted">
          OpenFoldUI · native TypeScript engine · client-only · metrics computed in-browser · saved locally (IndexedDB).
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
  onTags,
  onCompareAccession,
}: {
  entry: WorkspaceEntry;
  structures?: StoredStructures;
  alternatives?: RankedStructure[];
  onPickStructure: (pdbId: string) => void;
  onToggleFavorite: () => void;
  onNotes: (notes: string) => void;
  onTags: (tags: string[]) => void;
  onCompareAccession: (accession: string) => void;
}) {
  const [mode, setMode] = useState<ColorMode>("deviation");
  const [showSheet, setShowSheet] = useState(false);

  // The B-factor coloring trick needs a PDB model; for CIF models the viewer is
  // skipped (metrics/charts are unaffected).
  const models = useMemo(
    () =>
      structures && structures.modelFormat === "pdb"
        ? prepareViewerModels(structures.modelText, structures.superposition, entry.perResidue)
        : null,
    [structures, entry.perResidue],
  );

  function downloadSuperposed() {
    if (!structures || structures.modelFormat !== "pdb") return;
    const pdb = transformPdb(structures.modelText, structures.superposition);
    const blob = new Blob([pdb], { type: "chemical/x-pdb" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entry.uniprot}_${entry.pdbId}_superposed.pdb`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

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
            <button onClick={() => exportEntryLog(entry)} title="Provenance + methods to replicate this">
              Log
            </button>
            {structures && structures.modelFormat === "pdb" && (
              <button onClick={downloadSuperposed} title="Download the model superposed onto the reference">
                Superposed PDB
              </button>
            )}
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

      <ConfidenceSummary perResidue={entry.perResidue} />

      <TagEditor tags={entry.tags ?? []} onChange={onTags} />
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
          ) : structures && structures.modelFormat !== "pdb" ? (
            <span className="muted">3D coloring overlay is available for PDB models (metrics/charts unaffected).</span>
          ) : (
            <span className="muted">Structures not cached for this entry — re-run to view in 3D.</span>
          )}
        </div>
        {models && structures && (
          <ViewerErrorBoundary>
            <Suspense fallback={<div className="viewer-error">Loading 3D viewer…</div>}>
              <MolstarViewer models={models} refText={structures.refText} refFormat={structures.refFormat} mode={mode} />
            </Suspense>
          </ViewerErrorBoundary>
        )}
      </div>

      {structures?.modelCaPdb && structures.refCaPdb && (
        <ValidationPanel
          modelCaPdb={structures.modelCaPdb}
          refCaPdb={structures.refCaPdb}
          nativeTm={entry.tmScore}
          nativeRmsd={entry.rmsd}
        />
      )}

      {structures && <SearchPanel afPdbText={structures.modelText} onOpenAccession={onCompareAccession} />}
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
