/**
 * The scientific payload (SPEC §5, §12): per-residue AlphaFold pLDDT (x) vs actual
 * CA deviation from the experimental structure (y). The story lives in the
 * bottom-right: high pLDDT + high deviation = AlphaFold was *confidently wrong*.
 */
import { useMemo } from "react";
import * as Plot from "@observablehq/plot";
import type { PerResidue } from "../engine/types.ts";
import { PlotFigure } from "./PlotFigure.tsx";
import { useSettings } from "../settings.tsx";

export function ScatterPlddtDeviation({
  perResidue,
  spearman,
}: {
  perResidue: PerResidue[];
  spearman: number;
}) {
  const { settings } = useSettings();
  const CONFIDENT = settings.plddtConfident;
  const WRONG = settings.deviationWrong;
  const options = useMemo<Plot.PlotOptions>(() => {
    const maxDev = Math.max(WRONG + 1, ...perResidue.map((r) => r.deviation));
    return {
      width: 560,
      height: 360,
      marginLeft: 56,
      marginBottom: 44,
      x: { label: "AlphaFold pLDDT →", domain: [0, 100], grid: true },
      y: { label: "↑ CA deviation (Å)", domain: [0, maxDev], grid: true },
      color: { scheme: "turbo", legend: false },
      marks: [
        // Shade the "confidently wrong" quadrant.
        Plot.rect([{ x1: CONFIDENT, x2: 100, y1: WRONG, y2: maxDev }], {
          x1: "x1",
          x2: "x2",
          y1: "y1",
          y2: "y2",
          fill: "#ef4444",
          fillOpacity: 0.08,
        }),
        Plot.text([{ x: CONFIDENT + 1, y: maxDev }], {
          x: "x",
          y: "y",
          text: () => "confidently wrong",
          fill: "#b91c1c",
          textAnchor: "start",
          dy: 12,
          fontSize: 11,
        }),
        Plot.ruleY([WRONG], { stroke: "#cbd5e1", strokeDasharray: "3,3" }),
        Plot.ruleX([CONFIDENT], { stroke: "#cbd5e1", strokeDasharray: "3,3" }),
        Plot.dot(perResidue, {
          x: "plddt",
          y: "deviation",
          fill: "deviation",
          r: 3,
          fillOpacity: 0.8,
          channels: { residue: "uniprotNum" },
          tip: true,
        }),
      ],
    };
  }, [perResidue, CONFIDENT, WRONG]);

  return (
    <figure className="chart">
      <figcaption>
        pLDDT vs deviation — Spearman <strong>{fmt(spearman)}</strong>
      </figcaption>
      <PlotFigure options={options} />
    </figure>
  );
}

function fmt(v: number): string {
  return Number.isNaN(v) ? "n/a" : v.toFixed(3);
}
