/**
 * Foldseek structure search (SPEC §11) — the ONE feature that depends on a remote
 * service. Everything else compares two known structures; Foldseek answers "what
 * else looks like this" against huge databases that can't live in the browser.
 *
 * This is explicitly best-effort: the public webserver (search.foldseek.com) is
 * known to be flaky and has had outages, so every call is wrapped and surfaced as a
 * clear "search unavailable" state rather than breaking the app. Phase-0-style
 * de-risk confirmed the endpoints send CORS `*` and accept browser submissions.
 *
 * Isolated here so the rest of the app never gains a server dependency. The pure
 * parsing functions are unit-tested; the network orchestration is best-effort.
 */
const BASE = "https://search.foldseek.com/api";

export class SearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchError";
  }
}

export type TicketStatus = "PENDING" | "RUNNING" | "COMPLETE" | "ERROR" | "UNKNOWN";

export interface FoldseekHit {
  /** Raw target id, e.g. "AF-P0CG48-F1-model_v6 Polyubiquitin-C". */
  target: string;
  /** UniProt accession parsed from an AlphaFold-DB target, if present. */
  accession: string | null;
  description: string;
  /** Foldseek probability (0–1). */
  prob: number;
  eval: number;
  score: number;
  /** Sequence identity over the alignment (%). */
  seqId: number;
  alnLength: number;
  taxName: string;
}

/** Pull the UniProt accession out of an AlphaFold-DB target name. */
export function parseTargetAccession(target: string): string | null {
  const m = /^AF-([A-Z0-9]+)-F\d+/.exec(target.trim());
  return m ? m[1] : null;
}

/** The human-readable part of a target id (after the model token). */
export function parseTargetDescription(target: string): string {
  // "AF-P0CG48-F1-model_v6 Polyubiquitin-C" -> "Polyubiquitin-C"
  const space = target.indexOf(" ");
  return space >= 0 ? target.slice(space + 1).trim() : target.trim();
}

interface RawHit {
  target?: string;
  prob?: number;
  eval?: number;
  score?: number;
  seqId?: number;
  alnLength?: number;
  taxName?: string;
}
interface RawResult {
  results?: Array<{ alignments?: RawHit[][] | RawHit[] }>;
}

/** Flatten the Foldseek result JSON into a sorted hit list (defensive parsing). */
export function parseResults(json: RawResult, limit = 50): FoldseekHit[] {
  const hits: FoldseekHit[] = [];
  for (const group of json.results ?? []) {
    const aln = group.alignments ?? [];
    // alignments is an array-of-arrays (one per query); flatten one level if needed.
    const flat: RawHit[] = Array.isArray(aln[0]) ? (aln as RawHit[][]).flat() : (aln as RawHit[]);
    for (const h of flat) {
      const target = h.target ?? "";
      hits.push({
        target,
        accession: parseTargetAccession(target),
        description: parseTargetDescription(target),
        prob: h.prob ?? 0,
        eval: h.eval ?? Number.POSITIVE_INFINITY,
        score: h.score ?? 0,
        seqId: h.seqId ?? 0,
        alnLength: h.alnLength ?? 0,
        taxName: h.taxName ?? "",
      });
    }
  }
  hits.sort((a, b) => b.prob - a.prob || a.eval - b.eval);
  return hits.slice(0, limit);
}

export function normalizeStatus(s: string | undefined): TicketStatus {
  switch (s) {
    case "PENDING":
    case "RUNNING":
    case "COMPLETE":
    case "ERROR":
      return s;
    default:
      return "UNKNOWN";
  }
}

async function jsonOrThrow(res: Response): Promise<unknown> {
  if (!res.ok) throw new SearchError(`Foldseek HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new SearchError("Foldseek returned invalid JSON");
  }
}

/** Submit a structure; returns the ticket id. */
async function submit(pdbText: string, databases: string[], mode: string): Promise<string> {
  const form = new FormData();
  form.append("q", new Blob([pdbText], { type: "chemical/x-pdb" }), "query.pdb");
  for (const db of databases) form.append("database[]", db);
  form.append("mode", mode);
  let res: Response;
  try {
    res = await fetch(`${BASE}/ticket`, { method: "POST", body: form });
  } catch (e) {
    throw new SearchError(`Could not reach Foldseek: ${(e as Error).message}`);
  }
  const data = (await jsonOrThrow(res)) as { id?: string; status?: string };
  if (!data.id) throw new SearchError("Foldseek did not return a ticket.");
  return data.id;
}

async function ticketStatus(id: string): Promise<TicketStatus> {
  const res = await fetch(`${BASE}/ticket/${id}`);
  const data = (await jsonOrThrow(res)) as { status?: string };
  return normalizeStatus(data.status);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface SearchOptions {
  databases?: string[];
  mode?: string;
  onStatus?: (status: TicketStatus) => void;
  /** Overall timeout in ms (default 120s). */
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Run a full Foldseek search: submit → poll → fetch results. Throws SearchError on
 * any failure (the UI degrades gracefully). Best-effort by design.
 */
export async function runFoldseekSearch(pdbText: string, opts: SearchOptions = {}): Promise<FoldseekHit[]> {
  const databases = opts.databases ?? ["afdb50"];
  const mode = opts.mode ?? "3diaa";
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const deadline = Date.now() + timeoutMs;

  const id = await submit(pdbText, databases, mode);
  opts.onStatus?.("PENDING");

  let delay = 1500;
  for (;;) {
    if (opts.signal?.aborted) throw new SearchError("Search cancelled.");
    if (Date.now() > deadline) throw new SearchError("Foldseek search timed out.");
    const status = await ticketStatus(id);
    opts.onStatus?.(status);
    if (status === "COMPLETE") break;
    if (status === "ERROR") throw new SearchError("Foldseek reported an error for this search.");
    await sleep(delay);
    delay = Math.min(delay * 1.4, 6000);
  }

  const res = await fetch(`${BASE}/result/${id}/0`);
  return parseResults((await jsonOrThrow(res)) as RawResult);
}
