/**
 * Batch distribution plots (SPEC §12): histograms of TM-score and RMSD across all
 * successful comparisons in a batch, so a 500-protein study reads at a glance.
 */
import { useMemo } from "react";
import * as Plot from "@observablehq/plot";
import { PlotFigure } from "./PlotFigure.tsx";

export interface DistPoint {
  tmScore: number;
  rmsd: number;
}

export function Distributions({ points }: { points: DistPoint[] }) {
  const tmOptions = useMemo<Plot.PlotOptions>(
    () => ({
      width: 460,
      height: 220,
      marginBottom: 40,
      x: { label: "TM-score →", domain: [0, 1] },
      y: { label: "↑ count", grid: true },
      marks: [
        Plot.rectY(points, { ...Plot.binX({ y: "count" }, { x: "tmScore", thresholds: 20 }), fill: "#2563eb" }),
        Plot.ruleY([0]),
      ],
    }),
    [points],
  );

  const rmsdOptions = useMemo<Plot.PlotOptions>(() => {
    const maxRmsd = Math.max(2, ...points.map((p) => p.rmsd));
    return {
      width: 460,
      height: 220,
      marginBottom: 40,
      x: { label: "RMSD (Å) →", domain: [0, maxRmsd] },
      y: { label: "↑ count", grid: true },
      marks: [
        Plot.rectY(points, { ...Plot.binX({ y: "count" }, { x: "rmsd", thresholds: 20 }), fill: "#ef4444" }),
        Plot.ruleY([0]),
      ],
    };
  }, [points]);

  if (points.length === 0) return null;

  return (
    <div className="charts">
      <figure className="chart">
        <figcaption>TM-score distribution ({points.length})</figcaption>
        <PlotFigure options={tmOptions} />
      </figure>
      <figure className="chart">
        <figcaption>RMSD distribution ({points.length})</figcaption>
        <PlotFigure options={rmsdOptions} />
      </figure>
    </div>
  );
}
