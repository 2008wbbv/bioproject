/** Distribution of per-residue pLDDT for an AlphaFold model, banded by confidence. */
import { useMemo } from "react";
import * as Plot from "@observablehq/plot";
import { PlotFigure } from "./PlotFigure.tsx";

function band(p: number): string {
  if (p > 90) return "#2563eb";
  if (p >= 70) return "#38bdf8";
  if (p >= 50) return "#fbbf24";
  return "#f97316";
}

export function PlddtHistogram({ plddts }: { plddts: number[] }) {
  const options = useMemo<Plot.PlotOptions>(() => {
    const data = plddts.map((p) => ({ plddt: p, color: band(p) }));
    return {
      width: 460,
      height: 220,
      marginBottom: 40,
      x: { label: "pLDDT →", domain: [0, 100] },
      y: { label: "↑ residues", grid: true },
      marks: [
        Plot.rectY(data, { ...Plot.binX({ y: "count" }, { x: "plddt", thresholds: 25 }), fill: "color" }),
        Plot.ruleY([0]),
        Plot.ruleX([50, 70, 90], { stroke: "#cbd5e1", strokeDasharray: "3,3" }),
      ],
    };
  }, [plddts]);

  if (plddts.length === 0) return null;
  return (
    <figure className="chart">
      <figcaption>pLDDT distribution ({plddts.length} residues)</figcaption>
      <PlotFigure options={options} />
    </figure>
  );
}
