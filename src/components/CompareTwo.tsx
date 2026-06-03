/**
 * Side-by-side comparison of two saved comparisons: metrics next to each other
 * (with deltas) and their per-residue deviation tracks overlaid. Answers "did the
 * new model/structure actually improve?".
 */
import { useMemo } from "react";
import * as Plot from "@observablehq/plot";
import type { WorkspaceEntry } from "../workspace/types.ts";
import { PlotFigure } from "../charts/PlotFigure.tsx";

function delta(a: number, b: number, dp: number, betterUp: boolean): { text: string; cls: string } {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { text: "—", cls: "" };
  const d = b - a;
  if (Math.abs(d) < Math.pow(10, -dp) / 2) return { text: "≈", cls: "" };
  const improved = betterUp ? d > 0 : d < 0;
  return { text: `${d > 0 ? "+" : ""}${d.toFixed(dp)}`, cls: improved ? "delta-good" : "delta-bad" };
}

export function CompareTwo({
  a,
  b,
  onClose,
  onOpen,
}: {
  a: WorkspaceEntry;
  b: WorkspaceEntry;
  onClose: () => void;
  onOpen: (e: WorkspaceEntry) => void;
}) {
  const overlay = useMemo<Plot.PlotOptions>(() => {
    const data = [
      ...a.perResidue.map((r) => ({ ...r, which: `A · ${a.proteinName}` })),
      ...b.perResidue.map((r) => ({ ...r, which: `B · ${b.proteinName}` })),
    ];
    return {
      width: 920,
      height: 280,
      marginLeft: 56,
      marginBottom: 44,
      x: { label: "UniProt residue →", grid: true },
      y: { label: "↑ deviation (Å)", grid: true },
      color: { legend: true, scheme: "set1" },
      marks: [
        Plot.lineY(data, { x: "uniprotNum", y: "deviation", stroke: "which", strokeWidth: 1.2, tip: true }),
        Plot.ruleY([0]),
      ],
    };
  }, [a, b]);

  const rows: Array<{ label: string; av: number; bv: number; dp: number; up: boolean; unit?: string }> = [
    { label: "RMSD", av: a.rmsd, bv: b.rmsd, dp: 2, up: false, unit: " Å" },
    { label: "TM-score", av: a.tmScore, bv: b.tmScore, dp: 3, up: true },
    { label: "GDT-TS", av: a.gdtTs, bv: b.gdtTs, dp: 3, up: true },
    { label: "pLDDT–error ρ", av: a.plddtErrorSpearman, bv: b.plddtErrorSpearman, dp: 2, up: false },
    { label: "Matched", av: a.nMatched, bv: b.nMatched, dp: 0, up: true },
  ];

  return (
    <section className="compare-two">
      <div className="result-head">
        <h2>Compare two</h2>
        <button onClick={onClose}>← Back to dashboard</button>
      </div>

      <table className="validate-table compare-table">
        <thead>
          <tr>
            <th></th>
            <th><button className="link strong" onClick={() => onOpen(a)}>A · {a.proteinName}</button><div className="muted small">{a.uniprot} · {a.pdbId}·{a.chain}</div></th>
            <th><button className="link strong" onClick={() => onOpen(b)}>B · {b.proteinName}</button><div className="muted small">{b.uniprot} · {b.pdbId}·{b.chain}</div></th>
            <th>Δ (B−A)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const av = Number.isNaN(r.av) ? "n/a" : r.av.toFixed(r.dp) + (r.unit ?? "");
            const bv = Number.isNaN(r.bv) ? "n/a" : r.bv.toFixed(r.dp) + (r.unit ?? "");
            const d = delta(r.av, r.bv, r.dp, r.up);
            return (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td>{av}</td>
                <td>{bv}</td>
                <td className={d.cls}>{d.text}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <figure className="chart" style={{ marginTop: "1rem" }}>
        <figcaption>Per-residue deviation — overlaid</figcaption>
        <PlotFigure options={overlay} />
      </figure>
    </section>
  );
}
