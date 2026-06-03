/**
 * Thin React bridge for Observable Plot (SPEC §12). Plot returns a DOM node rather
 * than React elements, so we render it into a ref and replace it whenever the spec
 * changes. All chart components funnel through this.
 */
import { useEffect, useRef } from "react";
import * as Plot from "@observablehq/plot";

export function PlotFigure({ options }: { options: Plot.PlotOptions }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const chart = Plot.plot(options);
    container.append(chart);
    return () => chart.remove();
  }, [options]);

  return <div ref={ref} />;
}
