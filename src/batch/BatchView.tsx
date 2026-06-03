/**
 * Batch mode UI (SPEC §10): paste many IDs/names, run the pipeline over all of them
 * with live progress, see a per-item status table and distribution plots, and find
 * every result in the Workspace (where it can be exported). Opening a finished row
 * jumps to its full comparison.
 */
import { useMemo, useState } from "react";
import type { Workspace } from "../workspace/useWorkspace.ts";
import type { WorkspaceEntry } from "../workspace/types.ts";
import { parseIdList } from "./parseIds.ts";
import { runBatch, DEFAULT_CONCURRENCY, type BatchItem } from "./runBatch.ts";
import { Distributions } from "../charts/Distributions.tsx";

const PLACEHOLDER = `One per line, or comma-separated. e.g.
P04637
P24941
P00698
hemoglobin`;

export function BatchView({ ws, onOpen }: { ws: Workspace; onOpen: (e: WorkspaceEntry) => void }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);

  const ids = useMemo(() => parseIdList(text), [text]);
  const done = items.filter((i) => i.status === "done").length;
  const errored = items.filter((i) => i.status === "error").length;
  const finished = done + errored;

  const distPoints = useMemo(
    () =>
      items
        .filter((i) => i.status === "done" && i.entry)
        .map((i) => ({ tmScore: i.entry!.tmScore, rmsd: i.entry!.rmsd })),
    [items],
  );

  async function start() {
    if (ids.length === 0 || running) return;
    setRunning(true);
    setItems(ids.map((query) => ({ query, status: "pending" })));
    try {
      await runBatch(ids, ws.saveResult, setItems);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="batch">
      <h2>Batch comparison</h2>
      <p className="muted">
        Compare many proteins at once. Each result is saved to your Workspace and can be exported there.
        Up to {DEFAULT_CONCURRENCY} run concurrently.
      </p>

      <textarea
        className="batch-input"
        value={text}
        placeholder={PLACEHOLDER}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        disabled={running}
      />

      <div className="batch-controls">
        <button className="primary" onClick={() => void start()} disabled={running || ids.length === 0}>
          {running ? `Running… ${finished}/${items.length}` : `Compare ${ids.length || ""} protein${ids.length === 1 ? "" : "s"}`}
        </button>
        {items.length > 0 && (
          <span className="muted">
            {done} done · {errored} failed · {items.length - finished} left
          </span>
        )}
      </div>

      {items.length > 0 && (
        <>
          <div className="progress">
            <div className="progress-bar" style={{ width: `${(finished / items.length) * 100}%` }} />
          </div>

          <Distributions points={distPoints} />

          <div className="dash-scroll batch-table">
            <table>
              <thead>
                <tr>
                  <th>Query</th>
                  <th>Status</th>
                  <th>Protein</th>
                  <th>PDB</th>
                  <th>RMSD</th>
                  <th>TM</th>
                  <th>GDT</th>
                  <th>ρ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={`${it.query}-${i}`} className={it.status === "error" ? "row-wrong" : ""}>
                    <td>{it.query}</td>
                    <td>
                      <span className={`badge badge-${it.status}`}>{it.status}</span>
                    </td>
                    <td>
                      {it.entry ? (
                        <button className="link strong" onClick={() => onOpen(it.entry!)}>
                          {it.entry.proteinName}
                        </button>
                      ) : it.error ? (
                        <span className="muted small">{it.error}</span>
                      ) : (
                        ""
                      )}
                    </td>
                    <td>{it.entry ? `${it.entry.pdbId}·${it.entry.chain}` : ""}</td>
                    <td>{it.entry ? it.entry.rmsd.toFixed(2) : ""}</td>
                    <td>{it.entry ? it.entry.tmScore.toFixed(3) : ""}</td>
                    <td>{it.entry ? it.entry.gdtTs.toFixed(3) : ""}</td>
                    <td>{it.entry && !Number.isNaN(it.entry.plddtErrorSpearman) ? it.entry.plddtErrorSpearman.toFixed(2) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
