/**
 * PAE domain decomposition + per-domain agreement. Fetches the PAE, segments the
 * sequence into rigid domains, and re-superposes each one independently — exposing
 * cases where AlphaFold folded the domains well but mis-oriented them (global RMSD
 * high, per-domain RMSD low).
 */
import { useState } from "react";
import { fetchPae } from "../api/alphafold.ts";
import { segmentDomains } from "../engine/paeDomains.ts";
import { perDomainCompare, type DomainResult } from "../engine/perDomain.ts";
import type { MatchedCoords } from "../api/pipeline.ts";
import { Icon } from "../ui/Icon.tsx";

const COLORS = ["#2563eb", "#16a34a", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#dc2626"];

export function DomainPanel({
  paeUrl,
  matched,
  globalRmsd,
}: {
  paeUrl: string;
  matched: MatchedCoords;
  globalRmsd: number;
}) {
  const [phase, setPhase] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [domains, setDomains] = useState<DomainResult[]>([]);
  const [error, setError] = useState("");

  async function analyze() {
    setPhase("loading");
    setError("");
    try {
      const pae = await fetchPae(paeUrl);
      if (!pae) throw new Error("PAE unavailable.");
      const ranges = segmentDomains(pae.matrix).map((d) => ({ start: d.start + 1, end: d.end + 1 }));
      setDomains(perDomainCompare(matched, ranges));
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  const valid = domains.filter((d) => Number.isFinite(d.rmsd));
  const bestPerDomain = valid.length ? Math.min(...valid.map((d) => d.rmsd)) : NaN;
  const domainMotion = valid.length > 1 && globalRmsd - bestPerDomain > 2;

  return (
    <div className="domain-panel">
      <div className="search-head">
        <strong>Domain decomposition (PAE)</strong>
        <button onClick={() => void analyze()} disabled={phase === "loading"}>
          {phase === "loading" ? "Analyzing…" : domains.length ? "Re-analyze" : "Find domains"}
        </button>
        <span className="muted small">Per-domain superposition reveals domain motion</span>
      </div>

      {phase === "error" && <p className="status error">{error}</p>}

      {phase === "done" && domains.length === 1 && (
        <p className="muted">Single domain — global RMSD already reflects the whole structure.</p>
      )}

      {domains.length > 1 && (
        <>
          <div className="domain-ribbon">
            {domains.map((d, i) => (
              <div
                key={`${d.start}-${d.end}`}
                className="domain-seg"
                style={{ flex: d.end - d.start + 1, background: COLORS[i % COLORS.length] }}
                title={`Domain ${i + 1}: ${d.start}–${d.end}`}
              >
                {d.end - d.start > 30 ? `D${i + 1}` : ""}
              </div>
            ))}
          </div>
          <table className="validate-table">
            <thead>
              <tr><th>Domain</th><th>Residues</th><th>Matched</th><th>RMSD (Å)</th><th>TM</th></tr>
            </thead>
            <tbody>
              {domains.map((d, i) => (
                <tr key={`${d.start}-${d.end}`}>
                  <td><span className="domain-dot" style={{ background: COLORS[i % COLORS.length] }} /> Domain {i + 1}</td>
                  <td>{d.start}–{d.end}</td>
                  <td>{d.nMatched}</td>
                  <td>{Number.isFinite(d.rmsd) ? d.rmsd.toFixed(2) : "—"}</td>
                  <td>{Number.isFinite(d.tmScore) ? d.tmScore.toFixed(3) : "—"}</td>
                </tr>
              ))}
              <tr className="domain-global">
                <td colSpan={3}>Global (all domains together)</td>
                <td>{globalRmsd.toFixed(2)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
          {domainMotion && (
            <p className="domain-insight">
              <Icon name="alert" size={14} /> Global RMSD ({globalRmsd.toFixed(1)} Å) is much worse than the best
              per-domain fit ({bestPerDomain.toFixed(1)} Å): AlphaFold likely got the <strong>domains right but their
              relative orientation wrong</strong>.
            </p>
          )}
        </>
      )}
    </div>
  );
}
