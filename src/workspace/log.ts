/**
 * Replication logs (the user's "export logs so you can replicate stuff").
 *
 * For each comparison we emit a structured provenance record — inputs, data sources,
 * app version, the exact metrics, and warnings — plus a human-readable "methods"
 * paragraph a lab can paste into notes or a paper. Pure + testable.
 */
import { APP_NAME, APP_VERSION } from "../version.ts";
import type { WorkspaceEntry } from "./types.ts";

export interface ReplicationLog {
  app: string;
  appVersion: string;
  exportedAt: string;
  comparison: {
    id: string;
    source: string;
    query: string;
    uniprot: string;
    pdbId: string;
    chain: string;
    proteinName: string;
    modelSource: string;
    refSource: string;
    ranAt: string;
    backend: string;
  };
  metrics: {
    rmsd: number;
    tmScore: number;
    gdtTs: number;
    plddtErrorSpearman: number | null;
    nMatched: number;
  };
  warnings: string[];
  methods: string;
}

export function methodsText(entry: WorkspaceEntry): string {
  const prov = entry.provenance;
  const model = prov?.modelSource ?? (entry.source === "upload" ? "an uploaded model" : "AlphaFold DB");
  const ref = prov?.refSource ?? `PDB ${entry.pdbId}`;
  const rho = Number.isNaN(entry.plddtErrorSpearman) ? "n/a" : entry.plddtErrorSpearman.toFixed(2);
  return (
    `Using ${APP_NAME} v${prov?.appVersion ?? APP_VERSION}, the predicted model (${model}) was compared ` +
    `against the reference structure (${ref}, chain ${entry.chain}) for ${entry.proteinName} ` +
    `(${entry.uniprot}). Residues were matched by UniProt number; the model was superposed onto the ` +
    `reference by Kabsch superposition over matched Cα atoms. Over ${entry.nMatched} matched residues this ` +
    `gave RMSD ${entry.rmsd.toFixed(2)} Å, TM-score ${entry.tmScore.toFixed(3)}, and GDT-TS ` +
    `${entry.gdtTs.toFixed(3)}. The Spearman correlation between AlphaFold pLDDT and per-residue Cα ` +
    `deviation was ρ = ${rho}. All computation ran client-side in the browser.`
  );
}

export function replicationLog(entry: WorkspaceEntry): ReplicationLog {
  return {
    app: APP_NAME,
    appVersion: entry.provenance?.appVersion ?? APP_VERSION,
    exportedAt: new Date().toISOString(),
    comparison: {
      id: entry.id,
      source: entry.source,
      query: entry.query,
      uniprot: entry.uniprot,
      pdbId: entry.pdbId,
      chain: entry.chain,
      proteinName: entry.proteinName,
      modelSource: entry.provenance?.modelSource ?? "",
      refSource: entry.provenance?.refSource ?? "",
      ranAt: new Date(entry.createdAt).toISOString(),
      backend: "native",
    },
    metrics: {
      rmsd: entry.rmsd,
      tmScore: entry.tmScore,
      gdtTs: entry.gdtTs,
      plddtErrorSpearman: Number.isNaN(entry.plddtErrorSpearman) ? null : entry.plddtErrorSpearman,
      nMatched: entry.nMatched,
    },
    warnings: entry.warnings,
    methods: methodsText(entry),
  };
}
