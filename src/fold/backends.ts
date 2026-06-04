/**
 * Folding backends. In-browser AlphaFold isn't possible (GPU + multi-GB weights +
 * MSA), and there is no free public "fold with AlphaFold" API. So:
 *   - ESMFold (default): a REAL single-sequence structure predictor over a public
 *     API, no setup — pLDDT in the B-factor column.
 *   - Custom endpoint: bring your own AlphaFold2 / ColabFold server (e.g. an NVIDIA
 *     NIM or self-hosted ColabFold). We POST the sequence (+ optional API key) and
 *     accept a PDB back — so you can "AlphaFold it for real" if you have access.
 */
import { foldSequence, FoldError } from "./esmfold.ts";

export type BackendId = "esmfold" | "custom";

export interface FoldBackend {
  id: BackendId;
  label: string;
  description: string;
  needsConfig: boolean;
}

export const BACKENDS: FoldBackend[] = [
  { id: "esmfold", label: "ESMFold", description: "Public, no setup · single-sequence · ≤400 aa", needsConfig: false },
  { id: "custom", label: "AlphaFold2 / custom endpoint", description: "Your own AlphaFold/ColabFold server (POST sequence → PDB)", needsConfig: true },
];

export interface FoldConfig {
  /** Endpoint that accepts a sequence and returns a PDB (or JSON containing one). */
  endpoint: string;
  /** Optional bearer token / API key. */
  apiKey: string;
}

export const DEFAULT_FOLD_CONFIG: FoldConfig = { endpoint: "", apiKey: "" };
const CONFIG_KEY = "openfoldui-fold-config";

export function loadFoldConfig(): FoldConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return { ...DEFAULT_FOLD_CONFIG, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_FOLD_CONFIG;
}
export function saveFoldConfig(c: FoldConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
}

/** Pull a PDB out of an arbitrary response (raw PDB text, or JSON with common keys). */
export function extractPdb(body: string): string | null {
  const t = body.trimStart();
  // JSON-wrapped response (AF/ColabFold/NIM-style services).
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      const j = JSON.parse(body);
      const cand =
        j.pdb ?? j.pdb_string ?? j.structure ?? j.pdbs?.[0] ?? j.structures_in_ranked_order?.[0]?.structure ?? j.result?.pdb;
      if (typeof cand === "string" && cand.includes("ATOM")) return cand;
    } catch {
      /* not JSON */
    }
    return null;
  }
  // Raw PDB text.
  if (/(^|\n)(ATOM|HETATM|HEADER)/.test(body)) return body;
  return null;
}

async function foldCustom(seq: string, config: FoldConfig, signal?: AbortSignal): Promise<string> {
  if (!config.endpoint) throw new FoldError("No custom endpoint configured (set it in Fold settings).");
  let res: Response;
  try {
    res = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({ sequence: seq }),
      signal,
    });
  } catch (e) {
    throw new FoldError(`Could not reach endpoint: ${(e as Error).message}`);
  }
  if (!res.ok) throw new FoldError(`Endpoint HTTP ${res.status}.`);
  const pdb = extractPdb(await res.text());
  if (!pdb) throw new FoldError("Endpoint did not return a PDB structure.");
  return pdb;
}

/** Fold one sequence with the chosen backend. Returns PDB text. */
export function foldWith(
  seq: string,
  backend: BackendId,
  config: FoldConfig,
  signal?: AbortSignal,
): Promise<string> {
  return backend === "custom" ? foldCustom(seq, config, signal) : foldSequence(seq, signal);
}
