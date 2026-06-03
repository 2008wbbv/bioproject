/**
 * App shell (SPEC §1) + workspace. Compare a protein, then save/favorite/annotate
 * it, browse past comparisons in a dashboard, view the per-residue data in a sheet,
 * and export to Excel/CSV. Persistence is IndexedDB (src/workspace).
 */
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { runComparison, runCustomComparison, type AlignBy, type PipelineResult, type UploadedFile } from "./api/pipeline.ts";
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
import { PaePanel } from "./components/PaePanel.tsx";
import { Dashboard } from "./workspace/Dashboard.tsx";
import { BatchView } from "./batch/BatchView.tsx";
import { useWorkspace } from "./workspace/useWorkspace.ts";
import type { StoredStructures, WorkspaceEntry } from "./workspace/types.ts";
import { exportEntryXlsx, exportEntryCsv, exportEntryLog } from "./workspace/export.ts";
import { transformPdb } from "./engine/pdbTransform.ts";
import { ValidationPanel } from "./components/ValidationPanel.tsx";
import { TagEditor } from "./components/TagEditor.tsx";
import { SettingsPanel } from "./components/SettingsPanel.tsx";
import { CompareTwo } from "./components/CompareTwo.tsx";
import { useTheme } from "./useTheme.ts";
import { parseCompareHash, compareUrl } from "./permalink.ts";
import { Sidebar } from "./ui/Sidebar.tsx";
import { TopBar } from "./ui/TopBar.tsx";
import { CommandPalette, type Command } from "./ui/CommandPalette.tsx";
import { useToast } from "./ui/toast.tsx";
import "./styles.css";

const BREADCRUMBS: Record<string, string> = {
  dashboard: "Dashboard",
  compare: "Compare",
  batch: "Batch",
  compare2: "Compare two",
};

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
    paeUrl: data.paeUrl,
    superposition: data.superposition,
  };
}

const MolstarViewer = lazy(() =>
  import("./viewer/MolstarViewer.tsx").then((m) => ({ default: m.MolstarViewer })),
);

type Status = "idle" | "loading" | "error" | "done";
type View = "dashboard" | "compare" | "batch" | "compare2";

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
  const [pair, setPair] = useState<[WorkspaceEntry, WorkspaceEntry] | null>(null);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("openfoldui-sidebar") === "collapsed");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dashTag, setDashTag] = useState<string | null>(null);

  function toggleSidebar() {
    setCollapsed((c) => {
      localStorage.setItem("openfoldui-sidebar", c ? "open" : "collapsed");
      return !c;
    });
  }

  function startNewComparison() {
    setActive(null);
    setStatus("idle");
    setCompareMode("database");
    setView("compare");
  }

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

  async function runUpload(model: UploadedFile, ref: UploadedFile, uniprot: string | undefined, alignBy: AlignBy) {
    setStatus("loading");
    setError("");
    setView("compare");
    try {
      const data = runCustomComparison(model, ref, { uniprot, alignBy });
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

  // Open a comparison from a shared permalink (#compare=…) on first load.
  useEffect(() => {
    const link = parseCompareHash(location.hash);
    if (link) {
      setQuery(link.query);
      setCompareMode("database");
      void run(link.query, link.pdbId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ⌘K / Ctrl-K opens the command palette anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commands: Command[] = useMemo(
    () => [
      { id: "new", label: "New comparison", hint: "from database", run: startNewComparison },
      { id: "upload", label: "Upload your own files", hint: "compare local structures", run: () => { setCompareMode("upload"); setView("compare"); } },
      { id: "dashboard", label: "Go to Dashboard", run: () => setView("dashboard") },
      { id: "batch", label: "Go to Batch", run: () => setView("batch") },
      { id: "theme", label: "Toggle dark mode", run: () => setTheme(theme === "dark" ? "light" : "dark") },
    ],
    [theme, setTheme],
  );

  const liveEntry = active ? ws.entries.find((e) => e.id === active.id) ?? null : null;

  return (
    <div className={`shell ${collapsed ? "collapsed" : ""}`}>
      <Sidebar
        view={view}
        entries={ws.entries}
        collapsed={collapsed}
        onNavigate={setView}
        onNewComparison={startNewComparison}
        onOpenEntry={openEntry}
        onSelectTag={(t) => { setDashTag(t); setView("dashboard"); }}
      />
      <div className="main">
        <TopBar
          breadcrumb={BREADCRUMBS[view] ?? "Dashboard"}
          onToggleSidebar={toggleSidebar}
          onOpenPalette={() => setPaletteOpen(true)}
        >
          <SettingsPanel />
          <button
            className="theme-toggle"
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </TopBar>

        <main className="content">
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
          onCompareTwo={(a, b) => { setPair([a, b]); setView("compare2"); }}
          externalTag={dashTag}
          onTagConsumed={() => setDashTag(null)}
          examples={EXAMPLES}
        />
      )}

      {view === "compare2" && pair && (
        <CompareTwo a={pair[0]} b={pair[1]} onClose={() => setView("dashboard")} onOpen={openEntry} />
      )}

      {view === "batch" && <BatchView ws={ws} onOpen={openEntry} />}

          <footer className="app-footer">
            <span className="muted">
              OpenFoldUI · native TypeScript engine · client-only · metrics in-browser · saved locally (IndexedDB).
            </span>
          </footer>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
        entries={ws.entries}
        onOpenEntry={openEntry}
      />
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
  const { toast } = useToast();
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
            {entry.source === "database" && (
              <button onClick={() => onCompareAccession(entry.query || entry.uniprot)} title="Re-fetch and recompute">
                Re-run
              </button>
            )}
            {entry.source === "database" && (
              <button
                title="Copy a shareable link to this comparison"
                onClick={() => {
                  const url = compareUrl({ query: entry.query || entry.uniprot, pdbId: entry.pdbId });
                  void navigator.clipboard?.writeText(url);
                  location.hash = url.split("#")[1] ?? "";
                  toast("Shareable link copied to clipboard.", "success");
                }}
              >
                Copy link
              </button>
            )}
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

      {structures?.paeUrl && <PaePanel paeUrl={structures.paeUrl} />}

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
