/**
 * The home/dashboard (OpenFoldUI landing page): an at-a-glance overview of the whole
 * workspace — quick-compare entry point, aggregate stats, TM/RMSD distributions,
 * favorites, a tag filter, and the full sortable/filterable table with bulk export,
 * JSON backup/import, and replication-log export (SPEC §9-10).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceEntry } from "./types.ts";
import type { Workspace } from "./useWorkspace.ts";
import { useToast } from "../ui/toast.tsx";
import { workspaceStats, allTags } from "./stats.ts";
import {
  exportEntriesXlsx,
  exportEntriesCsv,
  downloadWorkspaceBackup,
  exportEntriesLogs,
  exportEverything,
} from "./export.ts";
import { parseWorkspace } from "./backup.ts";
import { Distributions } from "../charts/Distributions.tsx";
import { Icon } from "../ui/Icon.tsx";
import { Sparkline } from "../ui/Sparkline.tsx";
import { HeroArt } from "../ui/HeroArt.tsx";

type SortKey = "proteinName" | "rmsd" | "tmScore" | "gdtTs" | "plddtErrorSpearman" | "nMatched" | "updatedAt";

export function Dashboard({
  ws,
  onOpen,
  onQuickCompare,
  onUpload,
  onCompareTwo,
  externalTag,
  onTagConsumed,
  examples,
}: {
  ws: Workspace;
  onOpen: (e: WorkspaceEntry) => void;
  onQuickCompare: (query: string) => void;
  onUpload: () => void;
  onCompareTwo: (a: WorkspaceEntry, b: WorkspaceEntry) => void;
  externalTag?: string | null;
  onTagConsumed?: () => void;
  examples: Array<{ label: string; query: string }>;
}) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-2)));
  const [favOnly, setFavOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [asc, setAsc] = useState(false);
  const [quick, setQuick] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (externalTag) {
      setTag(externalTag);
      onTagConsumed?.();
    }
  }, [externalTag, onTagConsumed]);

  const stats = useMemo(() => workspaceStats(ws.entries), [ws.entries]);
  const tags = useMemo(() => allTags(ws.entries), [ws.entries]);
  const favorites = useMemo(() => ws.entries.filter((e) => e.favorite).slice(0, 12), [ws.entries]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = ws.entries;
    if (favOnly) list = list.filter((e) => e.favorite);
    if (tag) list = list.filter((e) => (e.tags ?? []).includes(tag));
    if (q) {
      list = list.filter(
        (e) =>
          e.uniprot.toLowerCase().includes(q) ||
          e.proteinName.toLowerCase().includes(q) ||
          e.pdbId.toLowerCase().includes(q) ||
          (e.tags ?? []).some((t) => t.toLowerCase().includes(q)),
      );
    }
    const sorted = [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv);
      return (av as number) - (bv as number);
    });
    return asc ? sorted : sorted.reverse();
  }, [ws.entries, favOnly, search, tag, sortKey, asc]);

  function sortBy(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(key === "proteinName");
    }
  }
  const arrow = (key: SortKey) => (key === sortKey ? (asc ? " ▲" : " ▼") : "");

  async function handleImport(file: File) {
    try {
      const entries = parseWorkspace(await file.text());
      const n = await ws.importEntries(entries);
      toast(`Imported ${n} comparison${n === 1 ? "" : "s"}.`, "success");
    } catch (e) {
      toast(`Import failed: ${(e as Error).message}`, "error");
    }
  }

  const importInput = (
    <input
      ref={importRef}
      type="file"
      accept=".json,application/json"
      style={{ display: "none" }}
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void handleImport(f);
        e.target.value = "";
      }}
    />
  );

  const quickBar = (
    <form
      className="quick-compare"
      onSubmit={(e) => {
        e.preventDefault();
        if (quick.trim()) onQuickCompare(quick.trim());
      }}
    >
      <input
        type="text"
        placeholder="Compare a protein — name or UniProt accession (e.g. p53 or P04637)"
        value={quick}
        onChange={(e) => setQuick(e.target.value)}
      />
      <button type="submit" className="primary">Compare</button>
      <button type="button" onClick={onUpload}>Upload files</button>
    </form>
  );

  // ---- empty state ----
  if (ws.entries.length === 0) {
    return (
      <section className="dashboard">
        <div className="hero">
          <HeroArt />
          <h2>Welcome to OpenFoldUI</h2>
          <p className="muted">
            Compare a predicted structure against the real one and see where the model was{" "}
            <em>confidently wrong</em>. Everything runs in your browser.
          </p>
          {quickBar}
          <div className="examples">
            <span className="muted">Try:</span>
            {examples.map((ex) => (
              <button key={ex.query} className="link" onClick={() => onQuickCompare(ex.query)}>
                {ex.label}
              </button>
            ))}
            {importInput}
            <button className="link" onClick={() => importRef.current?.click()}>Import workspace</button>
          </div>
        </div>
      </section>
    );
  }

  // ---- populated dashboard ----
  return (
    <section className="dashboard">
      {quickBar}

      <div className="metrics dash-stats">
        <Stat label="Comparisons" value={String(stats.count)} sub={`${stats.uploads} uploaded`} />
        <Stat label="Favorites" value={String(stats.favorites)} sub="starred" />
        <Stat label="Median TM" value={stats.medianTm.toFixed(3)} sub={`mean ${stats.meanTm.toFixed(3)}`} />
        <Stat label="Mean RMSD" value={`${stats.meanRmsd.toFixed(2)} Å`} sub="across set" />
        <Stat label="Same-fold" value={`${(stats.fractionGoodFold * 100).toFixed(0)}%`} sub="TM ≥ 0.5" />
      </div>

      {stats.count >= 3 && (
        <Distributions points={ws.entries.map((e) => ({ tmScore: e.tmScore, rmsd: e.rmsd }))} />
      )}

      {favorites.length > 0 && (
        <div className="fav-strip">
          <span className="muted"><Icon name="star" size={13} filled /> Favorites</span>
          {favorites.map((e) => (
            <button key={e.id} className="chip" onClick={() => onOpen(e)}>
              {e.proteinName} <span className="muted">· TM {e.tmScore.toFixed(2)}</span>
            </button>
          ))}
        </div>
      )}

      {tags.length > 0 && (
        <div className="tag-filter">
          <span className="muted">Tags:</span>
          <button className={`chip ${tag === null ? "on" : ""}`} onClick={() => setTag(null)}>All</button>
          {tags.map((t) => (
            <button key={t.tag} className={`chip ${tag === t.tag ? "on" : ""}`} onClick={() => setTag(t.tag === tag ? null : t.tag)}>
              {t.tag} <span className="muted">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="dash-toolbar">
        <input type="search" placeholder="Search protein / UniProt / PDB / tag…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="chk">
          <input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} /> Favorites only
        </label>
        <div className="spacer" />
        {selected.length === 2 && (
          <button
            className="primary compare-sel"
            onClick={() => {
              const a = ws.entries.find((e) => e.id === selected[0]);
              const b = ws.entries.find((e) => e.id === selected[1]);
              if (a && b) onCompareTwo(a, b);
            }}
          >
            Compare selected (2)
          </button>
        )}
        <span className="muted">{rows.length} shown</span>
        <button className="accent-btn" onClick={() => { exportEverything(ws.entries); toast("Exported everything as a .zip bundle.", "success"); }} title="Everything: JSON + Excel + CSV + logs + per-residue">
          <Icon name="download" size={14} /> Export all
        </button>
        <button onClick={() => exportEntriesXlsx(rows, favOnly ? "favorites" : "comparisons")}>Export Excel</button>
        <button onClick={() => exportEntriesCsv(rows, favOnly ? "favorites" : "comparisons")}>CSV</button>
        <button onClick={() => exportEntriesLogs(rows, "logs")} title="Replication logs (provenance + methods)">Logs</button>
        <button onClick={() => downloadWorkspaceBackup(ws.entries)} title="Back up all comparisons as JSON">Backup</button>
        {importInput}
        <button onClick={() => importRef.current?.click()}>Import</button>
        <button
          className="danger"
          onClick={async () => {
            const n = ws.entries.length;
            await ws.clear();
            toast(`Cleared ${n} comparison${n === 1 ? "" : "s"}.`, "info", { label: "Undo", run: () => void ws.undoDelete() });
          }}
        >
          Clear
        </button>
      </div>

      <div className="dash-scroll">
        <table>
          <thead>
            <tr>
              <th title="Select up to 2 to compare"></th>
              <th></th>
              <th onClick={() => sortBy("proteinName")}>Protein{arrow("proteinName")}</th>
              <th>PDB</th>
              <th onClick={() => sortBy("rmsd")}>RMSD{arrow("rmsd")}</th>
              <th onClick={() => sortBy("tmScore")}>TM{arrow("tmScore")}</th>
              <th onClick={() => sortBy("gdtTs")}>GDT{arrow("gdtTs")}</th>
              <th onClick={() => sortBy("plddtErrorSpearman")}>ρ{arrow("plddtErrorSpearman")}</th>
              <th onClick={() => sortBy("nMatched")}>Matched{arrow("nMatched")}</th>
              <th>Deviation</th>
              <th>Tags</th>
              <th onClick={() => sortBy("updatedAt")}>Updated{arrow("updatedAt")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className={selected.includes(e.id) ? "row-selected" : ""}>
                <td className="fav-cell">
                  <input type="checkbox" checked={selected.includes(e.id)} onChange={() => toggleSelect(e.id)} title="Select to compare" />
                </td>
                <td className="fav-cell">
                  <button className={`star ${e.favorite ? "on" : ""}`} title={e.favorite ? "Unfavorite" : "Favorite"} onClick={() => void ws.toggleFavorite(e.id)}>
                    <Icon name="star" size={15} filled={e.favorite} />
                  </button>
                </td>
                <td>
                  <button className="link strong" onClick={() => onOpen(e)}>{e.proteinName}</button>
                  <div className="muted small">{e.uniprot}{e.source === "upload" ? " · uploaded" : ""}{e.notes ? " · notes" : ""}</div>
                </td>
                <td>{e.pdbId}·{e.chain}</td>
                <td>{e.rmsd.toFixed(2)}</td>
                <td>{e.tmScore.toFixed(3)}</td>
                <td>{e.gdtTs.toFixed(3)}</td>
                <td>{Number.isNaN(e.plddtErrorSpearman) ? "—" : e.plddtErrorSpearman.toFixed(2)}</td>
                <td>{e.nMatched}</td>
                <td className="spark-cell">
                  <Sparkline
                    values={[...e.perResidue].sort((a, b) => a.uniprotNum - b.uniprotNum).map((r) => r.deviation)}
                    stroke={e.tmScore >= 0.5 ? "#2563eb" : "#ef4444"}
                  />
                </td>
                <td className="tags-cell">
                  {(e.tags ?? []).map((t) => (
                    <button key={t} className="tag mini" onClick={() => setTag(t)}>{t}</button>
                  ))}
                </td>
                <td className="muted small">{new Date(e.updatedAt).toLocaleDateString()}</td>
                <td>
                  <button
                    className="link danger"
                    title="Delete"
                    onClick={async () => {
                      const name = e.proteinName;
                      await ws.remove(e.id);
                      toast(`Deleted ${name}.`, "info", { label: "Undo", run: () => void ws.undoDelete() });
                    }}
                  >
                    <Icon name="close" size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
