/**
 * pLDDT calibration across the whole workspace: is AlphaFold's confidence actually
 * predictive of accuracy on your dataset? Mean Cα deviation per pLDDT bin — it should
 * fall as confidence rises.
 */
import { useMemo } from "react";
import * as Plot from "@observablehq/plot";
import { calibrationCurve } from "../engine/analysis.ts";
import type { WorkspaceEntry } from "../workspace/types.ts";
import { PlotFigure } from "../charts/PlotFigure.tsx";

export function CalibrationCard({ entries }: { entries: WorkspaceEntry[] }) {
  const curve = useMemo(() => {
    const all = entries.flatMap((e) => e.perResidue.map((r) => ({ plddt: r.plddt, deviation: r.deviation })));
    return calibrationCurve(all, 10);
  }, [entries]);

  const options = useMemo<Plot.PlotOptions>(() => {
    const data = curve.map((b) => ({ plddt: (b.plddtLo + b.plddtHi) / 2, dev: b.meanDeviation, n: b.n }));
    return {
      width: 460,
      height: 220,
      marginBottom: 40,
      x: { label: "pLDDT bin →", domain: [0, 100] },
      y: { label: "↑ mean deviation (Å)", grid: true },
      marks: [
        Plot.lineY(data, { x: "plddt", y: "dev", stroke: "#2563eb", strokeWidth: 2 }),
        Plot.dot(data, { x: "plddt", y: "dev", fill: "#2563eb", r: 4, channels: { residues: "n" }, tip: true }),
        Plot.ruleY([0]),
      ],
    };
  }, [curve]);

  const total = useMemo(() => entries.reduce((a, e) => a + e.perResidue.length, 0), [entries]);
  if (total < 50) return null;

  return (
    <figure className="chart calibration-card">
      <figcaption>pLDDT calibration — {total.toLocaleString()} residues across {entries.length} comparisons</figcaption>
      <PlotFigure options={options} />
      <span className="muted small">Well-calibrated confidence = deviation falls as pLDDT rises.</span>
    </figure>
  );
}
