/**
 * Compare the predicted model against MULTIPLE experimental structures at once —
 * "which conformational state did AlphaFold predict?". Runs the pipeline against the
 * top few distinct PDBs and ranks them; flags apo vs holo.
 */
import { useMemo, useState } from "react";
import { runComparison } from "../api/pipeline.ts";
import type { RankedStructure } from "../api/pdbe.ts";
import { mapWithConcurrency } from "../batch/pool.ts";
import { Icon } from "../ui/Icon.tsx";

interface StateRow {
  pdbId: string;
  method?: string;
  resolution?: number | null;
  rmsd: number;
  tmScore: number;
  holo: boolean;
  nMatched: number;
}

export function MultiStatePanel({ uniprot, alternatives }: { uniprot: string; alternatives: RankedStructure[] }) {
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [rows, setRows] = useState<StateRow[]>([]);
  const [error, setError] = useState("");

  // Up to 6 distinct PDB ids.
  const targets = useMemo(() => {
    const seen = new Set<string>();
    const out: RankedStructure[] = [];
    for (const s of alternatives) {
      const id = s.pdb_id.toLowerCase();
      if (!seen.has(id)) {
        seen.add(id);
        out.push(s);
      }
      if (out.length >= 6) break;
    }
    return out;
  }, [alternatives]);

  async function run() {
    setPhase("running");
    setError("");
    setRows([]);
    try {
      const results = await mapWithConcurrency(targets, 2, async (s) => {
        const data = await runComparison(uniprot, { pdbId: s.pdb_id });
        const r = data.result;
        return {
          pdbId: r.pdbId,
          method: s.experimental_method,
          resolution: s.resolution,
          rmsd: r.rmsd,
          tmScore: r.tmScore,
          holo: r.warnings.some((w) => w.toLowerCase().includes("ligand-bound")),
          nMatched: r.nMatched,
        } as StateRow;
      });
      const ok = results.filter((x) => x.ok && x.value).map((x) => x.value!);
      ok.sort((a, b) => a.rmsd - b.rmsd);
      setRows(ok);
      setPhase(ok.length ? "done" : "error");
      if (!ok.length) setError("No states could be compared.");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  const maxRmsd = Math.max(1, ...rows.map((r) => r.rmsd));

  return (
    <div className="multistate-panel">
      <div className="search-head">
        <strong>Compare across experimental states</strong>
        <button onClick={() => void run()} disabled={phase === "running"}>
          {phase === "running" ? "Comparing…" : `Compare ${targets.length} structures`}
        </button>
        <span className="muted small">Which state did the model predict?</span>
      </div>

      {phase === "error" && <p className="status error">{error}</p>}

      {rows.length > 0 && (
        <table className="validate-table multistate-table">
          <thead>
            <tr><th>PDB</th><th>Method</th><th>Res.</th><th>State</th><th>RMSD (Å)</th><th>TM</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.pdbId} className={i === 0 ? "state-best" : ""}>
                <td>{r.pdbId}{i === 0 && <span className="state-tag"> closest</span>}</td>
                <td className="small">{r.method ?? "—"}</td>
                <td>{r.resolution ? `${r.resolution.toFixed(1)} Å` : "—"}</td>
                <td>{r.holo ? <span className="holo-tag">holo</span> : <span className="apo-tag">apo</span>}</td>
                <td>
                  <div className="rmsd-bar"><div className="rmsd-fill" style={{ width: `${(r.rmsd / maxRmsd) * 100}%` }} /></div>
                  {r.rmsd.toFixed(2)}
                </td>
                <td>{r.tmScore.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {phase === "done" && rows[0] && (
        <p className="muted small"><Icon name="check" size={13} /> Closest experimental state: <strong>{rows[0].pdbId}</strong> ({rows[0].holo ? "holo" : "apo"}, RMSD {rows[0].rmsd.toFixed(2)} Å).</p>
      )}
    </div>
  );
}
