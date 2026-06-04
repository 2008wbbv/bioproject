/**
 * Experimental B-factor vs model deviation. Crystallographic B-factor measures how
 * flexible/uncertain each residue is in the experiment — if the model deviates where
 * the crystal is also fuzzy, the "error" is partly the experiment's, not the
 * predictor's. Reframes deviation in light of experimental uncertainty.
 */
import { useMemo } from "react";
import * as Plot from "@observablehq/plot";
import type { PerResidue } from "../engine/types.ts";
import { spearman } from "../engine/compare.ts";
import { PlotFigure } from "./PlotFigure.tsx";

export function BFactorScatter({ perResidue }: { perResidue: PerResidue[] }) {
  const data = useMemo(
    () => perResidue.filter((r) => r.expBFactor != null && r.expBFactor > 0).map((r) => ({ b: r.expBFactor!, deviation: r.deviation, uniprotNum: r.uniprotNum })),
    [perResidue],
  );

  const rho = useMemo(() => (data.length > 2 ? spearman(data.map((d) => d.b), data.map((d) => d.deviation)) : NaN), [data]);

  const options = useMemo<Plot.PlotOptions>(() => {
    const maxB = Math.max(10, ...data.map((d) => d.b));
    const maxD = Math.max(2, ...data.map((d) => d.deviation));
    return {
      width: 460,
      height: 340,
      marginLeft: 50,
      marginBottom: 44,
      x: { label: "experimental B-factor →", domain: [0, maxB], grid: true },
      y: { label: "↑ deviation (Å)", domain: [0, maxD], grid: true },
      marks: [Plot.dot(data, { x: "b", y: "deviation", fill: "#7c3aed", fillOpacity: 0.5, r: 2.6, channels: { residue: "uniprotNum" }, tip: true })],
    };
  }, [data]);

  // Need a spread of B-factors to be meaningful (AlphaFold models store pLDDT, not B).
  if (data.length < 10 || new Set(data.map((d) => Math.round(d.b))).size < 4) return null;
  return (
    <figure className="chart">
      <figcaption>Experimental flexibility — B-factor vs deviation (Spearman {Number.isNaN(rho) ? "n/a" : rho.toFixed(2)})</figcaption>
      <PlotFigure options={options} />
    </figure>
  );
}
