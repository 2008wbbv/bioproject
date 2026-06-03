/**
 * Foldseek "find similar structures" panel (SPEC §11). Best-effort: it submits the
 * AlphaFold model to the public Foldseek webserver and renders the hit list, letting
 * the user open any AlphaFold-DB hit as a brand-new comparison. If the service is
 * down or slow it shows a clear unavailable/timeout state and never blocks the app.
 */
import { useState } from "react";
import { runFoldseekSearch, SearchError, type FoldseekHit, type TicketStatus } from "./foldseek.ts";

type Phase = "idle" | "searching" | "done" | "error";

export function SearchPanel({
  afPdbText,
  onOpenAccession,
}: {
  afPdbText: string;
  onOpenAccession: (accession: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState<TicketStatus>("UNKNOWN");
  const [hits, setHits] = useState<FoldseekHit[]>([]);
  const [error, setError] = useState("");

  async function search() {
    setPhase("searching");
    setError("");
    setHits([]);
    try {
      const results = await runFoldseekSearch(afPdbText, { onStatus: setStatus });
      setHits(results);
      setPhase("done");
    } catch (e) {
      setError(e instanceof SearchError ? e.message : (e as Error).message);
      setPhase("error");
    }
  }

  return (
    <div className="search-panel">
      <div className="search-head">
        <strong>Find structurally similar proteins</strong>
        <button onClick={() => void search()} disabled={phase === "searching"}>
          {phase === "searching" ? `Searching… (${status.toLowerCase()})` : "Foldseek search"}
        </button>
        <span className="muted small">Best-effort · public Foldseek webserver · searches AlphaFold-DB</span>
      </div>

      {phase === "error" && (
        <p className="status error">Search unavailable: {error}</p>
      )}

      {phase === "done" && hits.length === 0 && <p className="muted">No hits returned.</p>}

      {hits.length > 0 && (
        <div className="dash-scroll search-results">
          <table>
            <thead>
              <tr>
                <th>Target</th>
                <th>Taxon</th>
                <th>Prob</th>
                <th>Seq id %</th>
                <th>Aln len</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {hits.map((h, i) => (
                <tr key={`${h.target}-${i}`}>
                  <td>{h.description || h.target}</td>
                  <td className="muted small">{h.taxName}</td>
                  <td>{h.prob.toFixed(2)}</td>
                  <td>{h.seqId.toFixed(0)}</td>
                  <td>{h.alnLength}</td>
                  <td>
                    {h.accession ? (
                      <button className="link" onClick={() => onOpenAccession(h.accession!)}>
                        Compare {h.accession}
                      </button>
                    ) : (
                      <span className="muted small">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
