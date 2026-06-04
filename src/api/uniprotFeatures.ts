/**
 * UniProt sequence features (domains, functional sites, modifications) — overlaid on
 * the per-residue deviation track so a lab can ask "does the model get the
 * functional regions right?". Pure parse/categorize + a fetch wrapper.
 */
import { fetchJson } from "./http.ts";

export type FeatureCategory = "domain" | "site" | "modification" | "variant";

export interface Feature {
  type: string;
  category: FeatureCategory;
  start: number;
  end: number;
  description: string;
}

const CATEGORY: Record<string, FeatureCategory> = {
  Domain: "domain",
  Region: "domain",
  Motif: "domain",
  Repeat: "domain",
  "Zinc finger": "domain",
  "DNA binding": "domain",
  "Active site": "site",
  "Binding site": "site",
  Site: "site",
  "Metal binding": "site",
  "Modified residue": "modification",
  Glycosylation: "modification",
  "Disulfide bond": "modification",
  Lipidation: "modification",
  Mutagenesis: "variant",
  "Natural variant": "variant",
};

interface RawFeature {
  type?: string;
  description?: string;
  location?: { start?: { value?: number }; end?: { value?: number } };
}

export function parseFeatures(json: { features?: RawFeature[] }): Feature[] {
  const out: Feature[] = [];
  for (const f of json.features ?? []) {
    const category = CATEGORY[f.type ?? ""];
    if (!category) continue;
    const start = f.location?.start?.value;
    const end = f.location?.end?.value ?? start;
    if (typeof start !== "number" || typeof end !== "number") continue;
    out.push({ type: f.type!, category, start, end, description: f.description ?? f.type! });
  }
  return out;
}

const FIELDS = [
  "ft_domain", "ft_region", "ft_motif", "ft_dna_bind", "ft_zn_fing",
  "ft_act_site", "ft_binding", "ft_site",
  "ft_mod_res", "ft_carbohyd", "ft_disulfid", "ft_lipid",
].join(",");

export async function fetchUniprotFeatures(accession: string): Promise<Feature[]> {
  const url = `https://rest.uniprot.org/uniprotkb/${accession}.json?fields=${FIELDS}`;
  return parseFeatures(await fetchJson<{ features?: RawFeature[] }>(url, "UniProt"));
}
