/**
 * Workspace dashboard: every saved comparison, with favorites, search, sortable
 * columns, per-row open/favorite/delete, and bulk export to Excel/CSV (SPEC §10).
 */
import { useMemo, useState } from "react";
import type { WorkspaceEntry } from "./types.ts";
import type { Workspace } from "./useWorkspace.ts";
import { exportEntriesXlsx, exportEntriesCsv } from "./export.ts";

type SortKey = "proteinName" | "rmsd" | "tmScore" | "gdtTs" | "plddtErrorSpearman" | "nMatched" | "updatedAt";

export function Dashboard({ ws, onOpen }: { ws: Workspace; onOpen: (e: WorkspaceEntry) => void }) {
  const [favOnly, setFavOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = ws.entries;
    if (favOnly) list = list.filter((e) => e.favorite);
    if (q) {
      list = list.filter(
        (e) =>
          e.uniprot.toLowerCase().includes(q) ||
          e.proteinName.toLowerCase().includes(q) ||
          e.pdbId.toLowerCase().includes(q),
      );
    }
    const sorted = [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv);
      return (av as number) - (bv as number);
    });
    return asc ? sorted : sorted.reverse();
  }, [ws.entries, favOnly, search, sortKey, asc]);

  function sortBy(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(key === "proteinName");
    }
  }
  const arrow = (key: SortKey) => (key === sortKey ? (asc ? " ▲" : " ▼") : "");

  if (ws.entries.length === 0) {
    return (
      <div className="empty">
        <p>No saved comparisons yet.</p>
        <p className="muted">Run a comparison and it will appear here automatically.</p>
      </div>
    );
  }

  return (
    <section className="dashboard">
      <div className="dash-toolbar">
        <input
          type="search"
          placeholder="Search protein / UniProt / PDB…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="chk">
          <input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} /> ★ Favorites
          only
        </label>
        <div className="spacer" />
        <span className="muted">{rows.length} shown</span>
        <button onClick={() => exportEntriesXlsx(rows, favOnly ? "favorites" : "comparisons")}>
          Export Excel
        </button>
        <button onClick={() => exportEntriesCsv(rows, favOnly ? "favorites" : "comparisons")}>Export CSV</button>
        <button
          className="danger"
          onClick={() => {
            if (confirm("Clear all saved comparisons? This cannot be undone.")) void ws.clear();
          }}
        >
          Clear history
        </button>
      </div>

      <div className="dash-scroll">
        <table>
          <thead>
            <tr>
              <th></th>
              <th onClick={() => sortBy("proteinName")}>Protein{arrow("proteinName")}</th>
              <th>PDB</th>
              <th onClick={() => sortBy("rmsd")}>RMSD{arrow("rmsd")}</th>
              <th onClick={() => sortBy("tmScore")}>TM{arrow("tmScore")}</th>
              <th onClick={() => sortBy("gdtTs")}>GDT{arrow("gdtTs")}</th>
              <th onClick={() => sortBy("plddtErrorSpearman")}>ρ{arrow("plddtErrorSpearman")}</th>
              <th onClick={() => sortBy("nMatched")}>Matched{arrow("nMatched")}</th>
              <th onClick={() => sortBy("updatedAt")}>Updated{arrow("updatedAt")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="fav-cell">
                  <button
                    className={`star ${e.favorite ? "on" : ""}`}
                    title={e.favorite ? "Unfavorite" : "Favorite"}
                    onClick={() => void ws.toggleFavorite(e.id)}
                  >
                    {e.favorite ? "★" : "☆"}
                  </button>
                </td>
                <td>
                  <button className="link strong" onClick={() => onOpen(e)}>
                    {e.proteinName}
                  </button>
                  <div className="muted small">
                    {e.uniprot} {e.notes ? "· 📝" : ""}
                  </div>
                </td>
                <td>{e.pdbId}·{e.chain}</td>
                <td>{e.rmsd.toFixed(2)}</td>
                <td>{e.tmScore.toFixed(3)}</td>
                <td>{e.gdtTs.toFixed(3)}</td>
                <td>{Number.isNaN(e.plddtErrorSpearman) ? "—" : e.plddtErrorSpearman.toFixed(2)}</td>
                <td>{e.nMatched}</td>
                <td className="muted small">{new Date(e.updatedAt).toLocaleDateString()}</td>
                <td>
                  <button className="link danger" onClick={() => void ws.remove(e.id)} title="Delete">
                    ✕
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
