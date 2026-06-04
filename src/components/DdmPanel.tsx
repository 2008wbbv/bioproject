/**
 * Distance-difference matrix heatmap. Computes model−reference Cα distance
 * differences from the matched coordinates and draws them as a diverging heatmap
 * (blue = model too close, red = model too far). Bright off-diagonal blocks =
 * domains/regions in the wrong relative place.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { distanceDifferenceMatrix } from "../engine/ddm.ts";
import type { MatchedCoords } from "../api/pipeline.ts";

const MAX_CANVAS = 460;

export function DdmPanel({ matched }: { matched: MatchedCoords }) {
  const [show, setShow] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const ddm = useMemo(() => {
    if (!show) return null;
    const n = matched.uniprotNums.length;
    return distanceDifferenceMatrix(matched.p, matched.q, n);
  }, [show, matched]);

  useEffect(() => {
    if (!ddm || !canvasRef.current) return;
    const n = ddm.size;
    const canvas = canvasRef.current;
    canvas.width = n;
    canvas.height = n;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(n, n);
    // Clamp scale to the 98th percentile-ish so a few outliers don't wash it out.
    const scale = Math.min(ddm.maxAbs, 12) || 1;
    for (let i = 0; i < n * n; i++) {
      const v = Math.max(-1, Math.min(1, ddm.data[i] / scale));
      // diverging: blue (neg) -> white (0) -> red (pos)
      let r: number, g: number, b: number;
      if (v < 0) {
        const t = -v;
        r = Math.round(255 * (1 - t));
        g = Math.round(255 * (1 - t));
        b = 255;
      } else {
        const t = v;
        r = 255;
        g = Math.round(255 * (1 - t));
        b = Math.round(255 * (1 - t));
      }
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [ddm]);

  const sizePx = ddm ? Math.min(MAX_CANVAS, ddm.size) : 0;

  return (
    <div className="ddm-panel">
      <div className="search-head">
        <strong>Distance-difference matrix</strong>
        <button onClick={() => setShow((s) => !s)}>{show ? "Hide" : "Show DDM"}</button>
        <span className="muted small">Topological disagreements (superposition-free)</span>
      </div>
      {ddm && (
        <div className="pae-figure">
          <canvas ref={canvasRef} className="pae-canvas" style={{ width: sizePx, height: sizePx }} />
          <div className="pae-legend muted small">
            <span style={{ color: "#2563eb" }}>■</span> model too close · white = agree ·
            <span style={{ color: "#dc2626" }}> ■</span> model too far · max ±{Math.min(ddm.maxAbs, 12).toFixed(0)} Å
          </div>
        </div>
      )}
    </div>
  );
}
