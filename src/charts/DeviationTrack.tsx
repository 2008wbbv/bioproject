/**
 * Per-residue deviation along the sequence (SPEC §5): deviation (Å) vs UniProt
 * residue number, with points tinted by pLDDT. Reveals *where* along the chain the
 * model and experiment diverge (loops, termini, binding regions).
 */
import { useMemo } from "react";
import * as Plot from "@observablehq/plot";
import type { PerResidue } from "../engine/types.ts";
import { PlotFigure } from "./PlotFigure.tsx";

export function DeviationTrack({ perResidue }: { perResidue: PerResidue[] }) {
  const options = useMemo<Plot.PlotOptions>(() => {
    const sorted = [...perResidue].sort((a, b) => a.uniprotNum - b.uniprotNum);
    return {
      width: 560,
      height: 220,
      marginLeft: 56,
      marginBottom: 44,
      x: { label: "UniProt residue →", grid: true },
      y: { label: "↑ deviation (Å)", grid: true, domain: [0, Math.max(2, ...sorted.map((r) => r.deviation))] },
      color: {
        label: "pLDDT",
        domain: [50, 100],
        // AlphaFold-ish: low confidence orange, high confidence blue.
        range: ["#f59e0b", "#2563eb"],
        legend: true,
      },
      marks: [
        Plot.areaY(sorted, { x: "uniprotNum", y: "deviation", fill: "#e2e8f0", fillOpacity: 0.6 }),
        Plot.lineY(sorted, { x: "uniprotNum", y: "deviation", stroke: "#94a3b8", strokeWidth: 1 }),
        Plot.dot(sorted, {
          x: "uniprotNum",
          y: "deviation",
          fill: "plddt",
          r: 2.5,
          channels: { residue: "uniprotNum", plddt: "plddt" },
          tip: true,
        }),
      ],
    };
  }, [perResidue]);

  return (
    <figure className="chart">
      <figcaption>Per-residue deviation along the sequence</figcaption>
      <PlotFigure options={options} />
    </figure>
  );
}
