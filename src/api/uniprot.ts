/**
 * Resolve a free-text protein name OR a UniProt accession to a canonical accession.
 * SPEC §2 ("Name to UniProt").
 *
 * If the input already looks like an accession we skip the search entirely. Else we
 * query the UniProt REST search and prefer the top reviewed (Swiss-Prot) hit, while
 * returning the full candidate list so the UI can let the user disambiguate.
 */
import { fetchJson } from "./http.ts";
import { NotFoundError } from "./errors.ts";

/** UniProtKB accession format (SPEC §2). Covers both the 6- and 10-char forms. */
const ACCESSION_RE =
  /^(?:[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})$/;

export function looksLikeAccession(query: string): boolean {
  return ACCESSION_RE.test(query.trim().toUpperCase());
}

export interface UniprotHit {
  accession: string;
  /** Entry name, e.g. "P53_HUMAN". */
  entryId: string;
  proteinName: string;
  organism: string;
  reviewed: boolean;
  length: number;
}

interface RawSearchResult {
  primaryAccession: string;
  uniProtkbId?: string;
  entryType?: string;
  sequence?: { length?: number };
  organism?: { scientificName?: string };
  proteinDescription?: {
    recommendedName?: { fullName?: { value?: string } };
    submissionNames?: Array<{ fullName?: { value?: string } }>;
  };
}

/** Tolerant extraction of hits from the (deeply-nested) UniProt search JSON. */
export function extractUniprotHits(json: { results?: RawSearchResult[] }): UniprotHit[] {
  const results = json.results ?? [];
  return results.map((r) => {
    const rec = r.proteinDescription?.recommendedName?.fullName?.value;
    const sub = r.proteinDescription?.submissionNames?.[0]?.fullName?.value;
    return {
      accession: r.primaryAccession,
      entryId: r.uniProtkbId ?? r.primaryAccession,
      proteinName: rec ?? sub ?? "(unnamed protein)",
      organism: r.organism?.scientificName ?? "",
      // "UniProtKB reviewed (Swiss-Prot)" vs "UniProtKB unreviewed (TrEMBL)" —
      // guard against "unreviewed" matching the "reviewed" substring.
      reviewed: (() => {
        const t = (r.entryType ?? "").toLowerCase();
        return t.includes("reviewed") && !t.includes("unreviewed");
      })(),
      length: r.sequence?.length ?? 0,
    };
  });
}

/** Reviewed (Swiss-Prot) hits first, then by descending sequence length. */
export function rankUniprotHits(hits: UniprotHit[]): UniprotHit[] {
  return [...hits].sort((a, b) => {
    if (a.reviewed !== b.reviewed) return a.reviewed ? -1 : 1;
    return b.length - a.length;
  });
}

const FIELDS = "accession,id,protein_name,reviewed,organism_name,length";

export interface UniprotResolution {
  accession: string;
  name: string;
  /** True when the input was already an accession (search was skipped). */
  fromAccession: boolean;
  /** Ranked candidates (empty when resolved directly from an accession). */
  candidates: UniprotHit[];
}

/** Resolve a query to a UniProt accession. Throws NotFoundError if nothing matches. */
export async function resolveUniprot(query: string): Promise<UniprotResolution> {
  const q = query.trim();
  if (looksLikeAccession(q)) {
    return { accession: q.toUpperCase(), name: q.toUpperCase(), fromAccession: true, candidates: [] };
  }

  const url =
    `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(q)}` +
    `&format=json&size=5&fields=${FIELDS}`;
  const json = await fetchJson<{ results?: RawSearchResult[] }>(url, "UniProt");
  const ranked = rankUniprotHits(extractUniprotHits(json));
  if (ranked.length === 0) {
    throw new NotFoundError("UniProt", `No UniProt entry found for "${query}".`);
  }
  const top = ranked[0];
  return { accession: top.accession, name: top.proteinName, fromAccession: false, candidates: ranked };
}
