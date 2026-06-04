/**
 * App shell (SPEC §1) + workspace. Compare a protein, then save/favorite/annotate
 * it, browse past comparisons in a dashboard, view the per-residue data in a sheet,
 * and export to Excel/CSV. Persistence is IndexedDB (src/workspace).
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { runComparison, runCustomComparison, type AlignBy, type PipelineResult, type UploadedFile } from "./api/pipeline.ts";
import type { RankedStructure } from "./api/pdbe.ts";
import { ApiError } from "./api/errors.ts";
import { ScatterPlddtDeviation } from "./charts/ScatterPlddtDeviation.tsx";
import { DeviationTrack } from "./charts/DeviationTrack.tsx";
import { PlddtLddtScatter } from "./charts/PlddtLddtScatter.tsx";
import { BFactorScatter } from "./charts/BFactorScatter.tsx";
import type { ColorMode } from "./viewer/MolstarViewer.tsx";
import { ViewerErrorBoundary } from "./viewer/ErrorBoundary.tsx";
import { prepareViewerModels } from "./viewer/prepareModels.ts";
import { DataSheet } from "./components/DataSheet.tsx";
import { NotesEditor } from "./components/NotesEditor.tsx";
import { ConfidenceSummary } from "./components/ConfidenceSummary.tsx";
import { StructuralBreakdown } from "./components/StructuralBreakdown.tsx";
import { UploadPanel } from "./components/UploadPanel.tsx";
import { SearchPanel } from "./search/SearchPanel.tsx";
import { PaePanel } from "./components/PaePanel.tsx";
import { DomainPanel } from "./components/DomainPanel.tsx";
import { DdmPanel } from "./components/DdmPanel.tsx";
import { FeatureTrack } from "./components/FeatureTrack.tsx";
import { MultiStatePanel } from "./components/MultiStatePanel.tsx";
import { Dashboard } from "./workspace/Dashboard.tsx";
import { BatchView } from "./batch/BatchView.tsx";
import { FoldView } from "./fold/FoldView.tsx";
import { LearnView } from "./ui/LearnView.tsx";
import { InspectView } from "./components/InspectView.tsx";
import { useWorkspace } from "./workspace/useWorkspace.ts";
import type { StoredStructures, WorkspaceEntry } from "./workspace/types.ts";
import { exportEntryXlsx, exportEntryCsv, exportEntryLog, exportEverything } from "./workspace/export.ts";
import { downloadReport } from "./workspace/report.ts";
import { exportPaperBundle } from "./workspace/paper.ts";
import { transformPdb } from "./engine/pdbTransform.ts";
import { ValidationPanel } from "./components/ValidationPanel.tsx";
import { TagEditor } from "./components/TagEditor.tsx";
import { AnnotationEditor } from "./components/AnnotationEditor.tsx";
import { ExternalLinks } from "./components/ExternalLinks.tsx";
import { SettingsPanel } from "./components/SettingsPanel.tsx";
import { CompareTwo } from "./components/CompareTwo.tsx";
import { useTheme } from "./useTheme.ts";
import { parseCompareHash, compareUrl, parseEntryHash, encodeEntryHash } from "./permalink.ts";
import { Sidebar } from "./ui/Sidebar.tsx";
import { TopBar } from "./ui/TopBar.tsx";
import { CommandPalette, type Command } from "./ui/CommandPalette.tsx";
import { ShortcutsHelp } from "./ui/ShortcutsHelp.tsx";
import { Onboarding, hasOnboarded } from "./ui/Onboarding.tsx";
import { useToast } from "./ui/toast.tsx";
import { Icon } from "./ui/Icon.tsx";
import "./styles.css";

interface Loc {
  view: View;
  entryId?: string;
}

const BREADCRUMBS: Record<string, string> = {
  dashboard: "Dashboard",
  compare: "Compare",
  batch: "Batch",
  compare2: "Compare two",
  fold: "Fold sequences",
  learn: "Learn",
  inspect: "Inspect model",
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
    matched: data.matched,
    superposition: data.superposition,
  };
}

const MolstarViewer = lazy(() =>
  import("./viewer/MolstarViewer.tsx").then((m) => ({ default: m.MolstarViewer })),
);

type Status = "idle" | "loading" | "error" | "done";
type View = "dashboard" | "compare" | "batch" | "compare2" | "fold" | "learn" | "inspect";

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
  const { toast } = useToast();
  const [view, setView] = useState<View>("dashboard");
  const [theme, setTheme] = useTheme();
  const [compareMode, setCompareMode] = useState<"database" | "upload">("database");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [active, setActive] = useState<Active | null>(null);
  const [pair, setPair] = useState<[WorkspaceEntry, WorkspaceEntry] | null>(null);
  const [pendingModel, setPendingModel] = useState<UploadedFile | null>(null);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("openfoldui-sidebar") === "collapsed");
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem("openfoldui-sidebar-w")) || 256);

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => setSidebarWidth(Math.min(440, Math.max(200, ev.clientX)));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
  useEffect(() => {
    localStorage.setItem("openfoldui-sidebar-w", String(sidebarWidth));
  }, [sidebarWidth]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [onboardOpen, setOnboardOpen] = useState(() => !hasOnboarded());
  const [dashTag, setDashTag] = useState<string | null>(null);
  const [dashProject, setDashProject] = useState<string | null>(null);
  const [inspectQuery, setInspectQuery] = useState<string | null>(null);
  const [viewedIds, setViewedIds] = useState<string[]>([]);
  const [backStack, setBackStack] = useState<Loc[]>([]);
  const prevLoc = useRef<Loc | null>(null);
  const isBack = useRef(false);

  // Record location history (view + open entry) so the Back button can jump back.
  useEffect(() => {
    const cur: Loc = { view, entryId: active?.id };
    const prev = prevLoc.current;
    if (prev && (prev.view !== cur.view || prev.entryId !== cur.entryId)) {
      if (isBack.current) isBack.current = false;
      else setBackStack((s) => [...s.slice(-29), prev]);
    }
    prevLoc.current = cur;
  }, [view, active?.id]);

  async function openEntryById(id: string) {
    const e = ws.entries.find((x) => x.id === id);
    if (e) await openEntry(e);
  }

  function goBack() {
    setBackStack((s) => {
      if (s.length === 0) return s;
      const loc = s[s.length - 1];
      isBack.current = true;
      if (loc.entryId) void openEntryById(loc.entryId);
      else {
        setActive(null);
        setView(loc.view);
      }
      return s.slice(0, -1);
    });
  }

  const recentEntries = useMemo(
    () => viewedIds.map((id) => ws.entries.find((e) => e.id === id)).filter((e): e is WorkspaceEntry => !!e),
    [viewedIds, ws.entries],
  );

  const recordViewed = (id: string) => setViewedIds((v) => [id, ...v.filter((x) => x !== id)].slice(0, 12));

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
      recordViewed(entry.id);
      setStatus("done");
      toast(`${entry.proteinName} vs ${entry.pdbId}: TM ${entry.tmScore.toFixed(2)}, RMSD ${entry.rmsd.toFixed(2)} Å`, "success");
    } catch (e) {
      const msg = e instanceof ApiError ? `${e.source}: ${e.message}` : (e as Error).message;
      setError(msg);
      setStatus("error");
      toast(msg, "error");
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
    recordViewed(entry.id);
    setStatus("done");
    setView("compare");
    history.replaceState(null, "", encodeEntryHash(entry.id));
  }

  // Open a comparison from a shared permalink (#compare=… or #entry=…) on load.
  const routedRef = useRef(false);
  useEffect(() => {
    if (routedRef.current) return;
    const link = parseCompareHash(location.hash);
    if (link) {
      routedRef.current = true;
      setQuery(link.query);
      setCompareMode("database");
      void run(link.query, link.pdbId);
      return;
    }
    const entryId = parseEntryHash(location.hash);
    if (entryId && ws.ready) {
      const e = ws.entries.find((x) => x.id === entryId);
      if (e) {
        routedRef.current = true;
        void openEntry(e);
      } else {
        routedRef.current = true; // entry not found; don't keep retrying
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.ready, ws.entries]);

  // Global keyboard shortcuts. ⌘K works everywhere; single-key shortcuts only
  // fire when not typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        setHelpOpen(false);
        return;
      }
      if (e.key === "?") setHelpOpen(true);
      else if (e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === "d") setView("dashboard");
      else if (e.key === "b") setView("batch");
      else if (e.key === "n") {
        setActive(null);
        setStatus("idle");
        setCompareMode("database");
        setView("compare");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commands: Command[] = useMemo(
    () => [
      { id: "new", label: "New comparison", hint: "from database", run: startNewComparison },
      { id: "upload", label: "Upload your own files", hint: "compare local structures", run: () => { setCompareMode("upload"); setView("compare"); } },
      { id: "inspect", label: "Inspect an AlphaFold model", hint: "any protein, no experimental needed", run: () => setView("inspect") },
      { id: "fold", label: "Fold a sequence", hint: "ESMFold", run: () => setView("fold") },
      { id: "dashboard", label: "Go to Dashboard", run: () => setView("dashboard") },
      { id: "batch", label: "Go to Batch", run: () => setView("batch") },
      { id: "learn", label: "Open Learn / docs", run: () => setView("learn") },
      { id: "exportall", label: "Export everything", hint: ".zip bundle", run: () => exportEverything(ws.entries) },
      { id: "tour", label: "Take the tour", run: () => setOnboardOpen(true) },
      { id: "theme", label: "Toggle dark mode", run: () => setTheme(theme === "dark" ? "light" : "dark") },
    ],
    [theme, setTheme, ws.entries],
  );

  const liveEntry = active ? ws.entries.find((e) => e.id === active.id) ?? null : null;

  return (
    <div className={`shell ${collapsed ? "collapsed" : ""}`}>
      <Sidebar
        view={view}
        entries={ws.entries}
        recentEntries={recentEntries}
        collapsed={collapsed}
        width={sidebarWidth}
        onResizeStart={startResize}
        onNavigate={setView}
        onNewComparison={startNewComparison}
        onOpenEntry={openEntry}
        onSelectTag={(t) => { setDashTag(t); setView("dashboard"); }}
        onSelectProject={(p) => { setDashProject(p); setView("dashboard"); }}
        onShowShortcuts={() => setHelpOpen(true)}
      />
      <div className="main">
        <TopBar
          breadcrumb={BREADCRUMBS[view] ?? "Dashboard"}
          canBack={backStack.length > 0}
          onBack={goBack}
          onToggleSidebar={toggleSidebar}
          onOpenPalette={() => setPaletteOpen(true)}
        >
          <SettingsPanel />
          <button
            className="theme-toggle"
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} />
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
            <UploadPanel onCompare={runUpload} busy={status === "loading"} initialModel={pendingModel} />
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
              onAnnotations={(a) => void ws.setAnnotations(liveEntry.id, a)}
              onProject={(p) => void ws.setProject(liveEntry.id, p)}
              projectOptions={[...new Set(ws.entries.map((e) => e.project).filter((p): p is string => !!p))]}
              tagSuggestions={[...new Set(ws.entries.flatMap((e) => e.tags ?? []))]}
              onCompareAccession={(acc) => { setQuery(acc); void run(acc); }}
              onInspect={(acc) => { setInspectQuery(acc); setView("inspect"); }}
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
          externalProject={dashProject}
          onProjectConsumed={() => setDashProject(null)}
          examples={EXAMPLES}
        />
      )}

      {view === "compare2" && pair && (
        <CompareTwo a={pair[0]} b={pair[1]} onClose={() => setView("dashboard")} onOpen={openEntry} />
      )}

      {view === "batch" && <BatchView ws={ws} onOpen={openEntry} />}

      {view === "fold" && (
        <FoldView
          onUseModel={(f) => { setPendingModel(f); setCompareMode("upload"); setView("compare"); }}
        />
      )}

      {view === "learn" && <LearnView />}

      {view === "inspect" && (
        <InspectView
          initialQuery={inspectQuery}
          onCompare={(acc) => { setQuery(acc); setCompareMode("database"); void run(acc); }}
        />
      )}

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
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <Onboarding
        open={onboardOpen}
        onClose={() => setOnboardOpen(false)}
        onTry={(q) => { setOnboardOpen(false); setQuery(q); setCompareMode("database"); void run(q); }}
        onLearn={() => { setOnboardOpen(false); setView("learn"); }}
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
  onAnnotations,
  onProject,
  projectOptions,
  tagSuggestions,
  onCompareAccession,
  onInspect,
}: {
  entry: WorkspaceEntry;
  structures?: StoredStructures;
  alternatives?: RankedStructure[];
  onPickStructure: (pdbId: string) => void;
  onToggleFavorite: () => void;
  onNotes: (notes: string) => void;
  onTags: (tags: string[]) => void;
  onAnnotations: (a: Array<{ residue: number; text: string }>) => void;
  onProject: (project: string) => void;
  projectOptions: string[];
  tagSuggestions: string[];
  onCompareAccession: (accession: string) => void;
  onInspect: (accession: string) => void;
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
            <Icon name="star" size={20} filled={entry.favorite} />
          </button>
          {entry.proteinName} <span className="muted">({entry.uniprot})</span>
        </h2>
        <ExternalLinks uniprot={entry.uniprot} pdbId={entry.pdbId} />
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
              <button onClick={() => onInspect(entry.uniprot)} title="Inspect the AlphaFold model on its own">
                Inspect model
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
            <button onClick={() => { downloadReport(entry); toast("Report downloaded — open and print to PDF.", "success"); }} title="One-click HTML report (print to PDF)">
              <Icon name="book" size={14} /> Report
            </button>
            <button onClick={() => { exportPaperBundle(entry); toast("Paper bundle exported (Markdown + SVG figures + BibTeX).", "success"); }} title="Publication-ready bundle: methods, figures, data, citations">
              <Icon name="book" size={14} /> Paper
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
        <Metric label="lDDT" value={entry.lddt != null ? entry.lddt.toFixed(3) : "n/a"} hint="superposition-free; what pLDDT predicts" />
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
            <li key={w}><Icon name="alert" size={14} className="warn-icon" /> {w}</li>
          ))}
        </ul>
      )}

      <div className="charts">
        <ScatterPlddtDeviation perResidue={entry.perResidue} spearman={entry.plddtErrorSpearman} />
        <DeviationTrack perResidue={entry.perResidue} annotations={entry.annotations ?? []} />
        <PlddtLddtScatter perResidue={entry.perResidue} />
        <BFactorScatter perResidue={entry.perResidue} />
      </div>

      {entry.uniprot && /^[A-Z0-9]{6,10}$/.test(entry.uniprot) && entry.perResidue.length > 0 && (
        <FeatureTrack
          uniprot={entry.uniprot}
          minRes={Math.min(...entry.perResidue.map((r) => r.uniprotNum))}
          maxRes={Math.max(...entry.perResidue.map((r) => r.uniprotNum))}
        />
      )}

      <ConfidenceSummary perResidue={entry.perResidue} />

      {structures?.modelCaPdb && structures.refText && (
        <StructuralBreakdown
          perResidue={entry.perResidue}
          modelCaPdb={structures.modelCaPdb}
          refText={structures.refText}
          refFormat={structures.refFormat}
        />
      )}

      <div className="project-row">
        <span className="tag-label muted">Project:</span>
        <input
          className="project-input"
          list="ofu-projects"
          defaultValue={entry.project ?? ""}
          placeholder="none"
          onBlur={(e) => { if ((e.target.value.trim() || "") !== (entry.project ?? "")) onProject(e.target.value); }}
        />
        <datalist id="ofu-projects">{projectOptions.map((p) => <option key={p} value={p} />)}</datalist>
      </div>
      <TagEditor tags={entry.tags ?? []} onChange={onTags} suggestions={tagSuggestions} />
      <AnnotationEditor annotations={entry.annotations ?? []} onChange={onAnnotations} />
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
          matched={structures.matched}
          nativeTm={entry.tmScore}
          nativeRmsd={entry.rmsd}
        />
      )}

      {alternatives && alternatives.length > 1 && (
        <MultiStatePanel uniprot={entry.uniprot} alternatives={alternatives} />
      )}

      {structures?.paeUrl && structures.matched && (
        <DomainPanel paeUrl={structures.paeUrl} matched={structures.matched} globalRmsd={entry.rmsd} />
      )}

      {structures?.matched && structures.matched.uniprotNums.length > 3 && (
        <DdmPanel matched={structures.matched} />
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
