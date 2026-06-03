/**
 * In-app spreadsheet view of the per-residue data points (the user's "look at the
 * data in a sheet form"). Sortable columns; the "confidently wrong" rows (high
 * pLDDT yet high deviation) are tinted so they stand out.
 */
import { useMemo, useState } from "react";
import type { PerResidue } from "../engine/types.ts";

type SortKey = "uniprotNum" | "plddt" | "deviation";
const CONFIDENT = 70;
const WRONG = 3;

export function DataSheet({ perResidue }: { perResidue: PerResidue[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("uniprotNum");
  const [asc, setAsc] = useState(true);

  const rows = useMemo(() => {
    const sorted = [...perResidue].sort((a, b) => a[sortKey] - b[sortKey]);
    return asc ? sorted : sorted.reverse();
  }, [perResidue, sortKey, asc]);

  function sortBy(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(true);
    }
  }

  const arrow = (key: SortKey) => (key === sortKey ? (asc ? " ▲" : " ▼") : "");

  return (
    <div className="datasheet">
      <div className="datasheet-meta muted">
        {perResidue.length} matched residues · click a header to sort
      </div>
      <div className="datasheet-scroll">
        <table>
          <thead>
            <tr>
              <th onClick={() => sortBy("uniprotNum")}>UniProt residue{arrow("uniprotNum")}</th>
              <th onClick={() => sortBy("plddt")}>pLDDT{arrow("plddt")}</th>
              <th onClick={() => sortBy("deviation")}>Deviation (Å){arrow("deviation")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const wrong = r.plddt >= CONFIDENT && r.deviation >= WRONG;
              return (
                <tr key={r.uniprotNum} className={wrong ? "row-wrong" : ""}>
                  <td>{r.uniprotNum}</td>
                  <td>{r.plddt.toFixed(1)}</td>
                  <td>{r.deviation.toFixed(3)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
