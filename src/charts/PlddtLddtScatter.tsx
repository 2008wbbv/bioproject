/**
 * The correct calibration plot: AlphaFold pLDDT (its *prediction* of lDDT) vs the
 * OBSERVED lDDT computed from the experimental structure. Points on the diagonal mean
 * the confidence was perfectly calibrated; below it means the model was over-confident.
 */
import { useMemo } from "react";
import * as Plot from "@observablehq/plot";
import type { PerResidue } from "../engine/types.ts";
import { PlotFigure } from "./PlotFigure.tsx";

export function PlddtLddtScatter({ perResidue }: { perResidue: PerResidue[] }) {
  const data = useMemo(
    () => perResidue.filter((r) => r.lddt != null && !Number.isNaN(r.lddt)).map((r) => ({ plddt: r.plddt, lddt: r.lddt! * 100, uniprotNum: r.uniprotNum })),
    [perResidue],
  );

  const options = useMemo<Plot.PlotOptions>(
    () => ({
      width: 460,
      height: 340,
      marginLeft: 50,
      marginBottom: 44,
      x: { label: "AlphaFold pLDDT (predicted) →", domain: [0, 100], grid: true },
      y: { label: "↑ observed lDDT", domain: [0, 100], grid: true },
      marks: [
        Plot.line([{ x: 0, y: 0 }, { x: 100, y: 100 }], { x: "x", y: "y", stroke: "#cbd5e1", strokeDasharray: "4,4" }),
        Plot.dot(data, { x: "plddt", y: "lddt", fill: "#2563eb", fillOpacity: 0.55, r: 2.6, channels: { residue: "uniprotNum" }, tip: true }),
      ],
    }),
    [data],
  );

  if (data.length === 0) return null;
  return (
    <figure className="chart">
      <figcaption>Confidence calibration — pLDDT vs observed lDDT (diagonal = perfect)</figcaption>
      <PlotFigure options={options} />
    </figure>
  );
}
