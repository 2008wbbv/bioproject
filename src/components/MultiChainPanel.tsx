/**
 * Multi-chain / complex analysis. For oligomers, compares the (monomer) model
 * against EACH experimental chain — does AlphaFold match every copy equally, or is
 * one chain in a different conformation? — and reports the assembly interface
 * residues and whether they deviate more than the core.
 */
import { useState } from "react";
import { parseByFormat, type StructFormat } from "../engine/format.ts";
import { assignUniprotFromAuth } from "../engine/sifts.ts";
import { alignByUniprot } from "../engine/align.ts";
import { computeComparison } from "../engine/compare.ts";
import { mappedChains, interfaceResidues } from "../engine/interface.ts";
import type { ResidueRecord } from "../engine/types.ts";

interface ChainRow {
  chain: string;
  nMatched: number;
  rmsd: number;
  tmScore: number;
  lddt: number;
}

export function MultiChainPanel({
  uniprot,
  modelText,
  modelFormat,
  refText,
  refFormat,
}: {
  uniprot: string;
  modelText: string;
  modelFormat: StructFormat;
  refText: string;
  refFormat: StructFormat;
}) {
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [chains, setChains] = useState<ChainRow[]>([]);
  const [iface, setIface] = useState<{ n: number; meanDev: number; coreMeanDev: number } | null>(null);
  const [single, setSingle] = useState(false);
  const [error, setError] = useState("");

  function analyze() {
    setPhase("running");
    setError("");
    try {
      const model = parseByFormat(modelText, modelFormat, { uniprotAcc: uniprot });
      if (model.residues.every((r) => r.uniprotNum === null)) assignUniprotFromAuth(model.residues);
      const ref = parseByFormat(refText, refFormat, { uniprotAcc: uniprot });
      const chainIds = mappedChains(ref.residues);

      if (chainIds.length <= 1) {
        setSingle(true);
        setPhase("done");
        return;
      }

      const rows: ChainRow[] = [];
      for (const chain of chainIds) {
        const chainResidues = ref.residues.filter((r: ResidueRecord) => r.chain === chain);
        const alignment = alignByUniprot(model.residues, chainResidues);
        if (alignment.nMatched < 3) continue;
        const m = computeComparison(alignment, { referenceLength: alignment.nMatched });
        rows.push({ chain, nMatched: m.nMatched, rmsd: m.rmsd, tmScore: m.tmScore, lddt: m.lddt });
      }
      setChains(rows);

      // Interface analysis on the best (lowest-RMSD) chain.
      if (rows.length > 0) {
        const best = [...rows].sort((a, b) => a.rmsd - b.rmsd)[0].chain;
        const ifaceSet = interfaceResidues(ref.residues, best, 8);
        const chainResidues = ref.residues.filter((r) => r.chain === best);
        const alignment = alignByUniprot(model.residues, chainResidues);
        const m = computeComparison(alignment, { referenceLength: alignment.nMatched });
        const inSite: number[] = [];
        const core: number[] = [];
        for (const pr of m.perResidue) (ifaceSet.has(pr.uniprotNum) ? inSite : core).push(pr.deviation);
        const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
        if (inSite.length >= 3) setIface({ n: inSite.length, meanDev: mean(inSite), coreMeanDev: mean(core) });
      }
      setSingle(false);
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  const spread = chains.length > 1 ? Math.max(...chains.map((c) => c.rmsd)) - Math.min(...chains.map((c) => c.rmsd)) : 0;

  return (
    <div className="multichain-panel">
      <div className="search-head">
        <strong>Multi-chain / assembly</strong>
        <button onClick={analyze} disabled={phase === "running"}>{phase === "running" ? "Analyzing…" : "Analyze chains"}</button>
        <span className="muted small">Compare the model against every experimental chain</span>
      </div>

      {phase === "error" && <p className="status error">{error}</p>}
      {phase === "done" && single && <p className="muted">Single chain — not an oligomer.</p>}

      {chains.length > 1 && (
        <>
          <table className="validate-table">
            <thead><tr><th>Chain</th><th>Matched</th><th>RMSD (Å)</th><th>TM</th><th>lDDT</th></tr></thead>
            <tbody>
              {chains.map((c) => (
                <tr key={c.chain}><td>{c.chain}</td><td>{c.nMatched}</td><td>{c.rmsd.toFixed(2)}</td><td>{c.tmScore.toFixed(3)}</td><td>{c.lddt.toFixed(3)}</td></tr>
              ))}
            </tbody>
          </table>
          {spread > 1 && (
            <p className="muted small">RMSD varies by {spread.toFixed(1)} Å across chains — the copies adopt different conformations in this assembly, and the model matches some better than others.</p>
          )}
          {iface && (
            <p className="muted small">
              Interface: {iface.n} residues. Mean deviation at the interface <strong>{iface.meanDev.toFixed(2)} Å</strong> vs core {iface.coreMeanDev.toFixed(2)} Å
              {iface.meanDev > iface.coreMeanDev * 1.3 ? " — the model is worse at the assembly contacts (expected for a monomer prediction)." : "."}
            </p>
          )}
        </>
      )}
    </div>
  );
}
