/**
 * Predicted Aligned Error heatmap (SPEC §2). Best-effort: fetches AlphaFold's PAE
 * JSON on demand and draws the NxN matrix to a canvas with the AlphaFold green
 * colormap (low error dark green, high error pale). Off-diagonal bright blocks mean
 * the relative orientation of two regions is uncertain.
 */
import { useEffect, useRef, useState } from "react";
import { fetchPae } from "../api/alphafold.ts";
import type { Pae } from "../engine/pae.ts";

const MAX_CANVAS = 460;

/** AlphaFold-style colormap: 0 Å = dark green, max = near white. */
function paeColor(v: number, max: number): [number, number, number] {
  const t = Math.min(1, v / max);
  // dark teal (0,68,89) -> pale green/white (247,252,245)
  return [Math.round(0 + t * 247), Math.round(68 + t * 184), Math.round(89 + t * 156)];
}

export function PaePanel({ paeUrl }: { paeUrl: string }) {
  const [phase, setPhase] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [pae, setPae] = useState<Pae | null>(null);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  async function load() {
    setPhase("loading");
    setError("");
    try {
      const p = await fetchPae(paeUrl);
      if (!p) throw new Error("PAE could not be parsed.");
      setPae(p);
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  useEffect(() => {
    if (!pae || !canvasRef.current) return;
    const n = pae.size;
    const canvas = canvasRef.current;
    // Render at native resolution into an offscreen buffer, then scale via CSS.
    canvas.width = n;
    canvas.height = n;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(n, n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const [r, g, b] = paeColor(pae.matrix[i][j], pae.max);
        const idx = (i * n + j) * 4;
        img.data[idx] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [pae]);

  return (
    <div className="pae-panel">
      <div className="search-head">
        <strong>Predicted Aligned Error (PAE)</strong>
        <button onClick={() => void load()} disabled={phase === "loading"}>
          {phase === "loading" ? "Loading…" : pae ? "Reload" : "Show PAE"}
        </button>
        <span className="muted small">AlphaFold inter-residue position confidence</span>
      </div>
      {phase === "error" && <p className="status error">PAE unavailable: {error}</p>}
      {pae && (
        <div className="pae-figure">
          <canvas
            ref={canvasRef}
            className="pae-canvas"
            style={{ width: Math.min(MAX_CANVAS, pae.size), height: Math.min(MAX_CANVAS, pae.size) }}
          />
          <div className="pae-legend">
            <span className="muted small">Scored residue (j) →, aligned on (i) ↓ · dark = low error, pale = high (max {pae.max.toFixed(0)} Å)</span>
          </div>
        </div>
      )}
    </div>
  );
}
