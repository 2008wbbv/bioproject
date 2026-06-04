/**
 * UniProt feature track: domains, functional sites, and modifications laid out by
 * residue, beneath the deviation chart. Fetched on demand for entries with a real
 * UniProt accession. Answers "does the model get the functional regions right?".
 */
import { useState } from "react";
import { fetchUniprotFeatures, type Feature, type FeatureCategory } from "../api/uniprotFeatures.ts";

const LANES: Array<{ key: FeatureCategory; label: string; color: string }> = [
  { key: "domain", label: "Domains & regions", color: "#2563eb" },
  { key: "site", label: "Functional sites", color: "#dc2626" },
  { key: "modification", label: "Modifications", color: "#7c3aed" },
  { key: "variant", label: "Variants", color: "#16a34a" },
];

const WIDTH = 560;
const LANE_H = 18;
const PAD_L = 130;

export function FeatureTrack({ uniprot, minRes, maxRes }: { uniprot: string; minRes: number; maxRes: number }) {
  const [phase, setPhase] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [features, setFeatures] = useState<Feature[]>([]);
  const [error, setError] = useState("");
  const [hover, setHover] = useState<Feature | null>(null);

  async function load() {
    setPhase("loading");
    setError("");
    try {
      setFeatures(await fetchUniprotFeatures(uniprot));
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  const span = Math.max(1, maxRes - minRes);
  const x = (res: number) => PAD_L + ((res - minRes) / span) * (WIDTH - PAD_L - 8);

  const lanesWithData = LANES.filter((l) => features.some((f) => f.category === l.key));
  const height = Math.max(1, lanesWithData.length) * (LANE_H + 6) + 8;

  return (
    <div className="feature-track">
      <div className="search-head">
        <strong>UniProt features</strong>
        <button onClick={() => void load()} disabled={phase === "loading"}>
          {phase === "loading" ? "Loading…" : features.length ? "Reload" : "Show features"}
        </button>
        <span className="muted small">Domains, sites & modifications over the sequence</span>
      </div>

      {phase === "error" && <p className="status error">Features unavailable: {error}</p>}
      {phase === "done" && features.length === 0 && <p className="muted">No annotated features for this protein.</p>}

      {lanesWithData.length > 0 && (
        <>
          <svg width={WIDTH} height={height} className="feature-svg">
            {lanesWithData.map((lane, li) => {
              const y = li * (LANE_H + 6) + 4;
              return (
                <g key={lane.key}>
                  <text x={0} y={y + LANE_H / 2 + 4} fontSize={11} fill="var(--muted)">{lane.label}</text>
                  <rect x={PAD_L} y={y} width={WIDTH - PAD_L - 8} height={LANE_H} fill="var(--bg)" rx={3} />
                  {features
                    .filter((f) => f.category === lane.key)
                    .map((f, i) => {
                      const x0 = x(Math.max(minRes, f.start));
                      const w = Math.max(2, x(Math.min(maxRes, f.end)) - x0);
                      return (
                        <rect
                          key={i}
                          x={x0}
                          y={y}
                          width={w}
                          height={LANE_H}
                          rx={2}
                          fill={lane.color}
                          fillOpacity={0.78}
                          onMouseEnter={() => setHover(f)}
                          onMouseLeave={() => setHover(null)}
                        />
                      );
                    })}
                </g>
              );
            })}
          </svg>
          <div className="feature-hover muted small">
            {hover ? `${hover.type} ${hover.start}${hover.end !== hover.start ? `–${hover.end}` : ""}: ${hover.description}` : "Hover a feature for details."}
          </div>
        </>
      )}
    </div>
  );
}
