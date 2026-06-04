/**
 * Shareable gallery: a curated shelf of instructive AlphaFold-vs-experiment
 * comparisons. Each card explains *why* the example is interesting, opens the real
 * comparison in one click, and exposes a copyable permalink so a colleague reproduces
 * it without an account. Doubles as the hosted-demo landing content.
 */
import { compareUrl } from "../permalink.ts";
import { useToast } from "../ui/toast.tsx";
import { Icon } from "../ui/Icon.tsx";

interface Example {
  name: string;
  uniprot: string;
  pdbId?: string;
  category: string;
  blurb: string;
}

/** Hand-picked, each chosen to teach a different lesson about prediction quality. */
const EXAMPLES: Example[] = [
  {
    name: "p53 tumour suppressor",
    uniprot: "P04637",
    category: "Disorder",
    blurb: "The textbook case: a well-folded DNA-binding core flanked by long disordered tails AlphaFold flags with low pLDDT.",
  },
  {
    name: "Lysozyme C",
    uniprot: "P00698",
    category: "Near-perfect",
    blurb: "A small, rigid, exhaustively-studied enzyme — expect a near-perfect match and tightly calibrated confidence.",
  },
  {
    name: "Myoglobin",
    uniprot: "P02185",
    category: "Classic fold",
    blurb: "The first protein ever solved. An all-α globin fold AlphaFold reproduces almost exactly.",
  },
  {
    name: "Haemoglobin α",
    uniprot: "P69905",
    category: "Assembly",
    blurb: "A subunit of a heterotetramer — a good place to try the multi-chain / interface analysis.",
  },
  {
    name: "Ubiquitin",
    uniprot: "P0CG48",
    category: "Near-perfect",
    blurb: "Tiny, ultra-stable, and present in countless structures — a clean baseline for the metrics.",
  },
  {
    name: "Calmodulin",
    uniprot: "P0DP23",
    category: "Conformational",
    blurb: "Famously flexible: open vs closed states. Try 'compare across experimental states' to see which one was predicted.",
  },
  {
    name: "Src kinase",
    uniprot: "P12931",
    category: "Active/inactive",
    blurb: "A kinase that toggles between active and inactive conformations — a conformational-landscape showcase.",
  },
  {
    name: "Green fluorescent protein",
    uniprot: "P42212",
    category: "Beta-barrel",
    blurb: "An eleven-stranded β-barrel — a stringent test of getting strand register and topology right.",
  },
  {
    name: "Insulin",
    uniprot: "P01308",
    category: "Processed",
    blurb: "Cleaved into chains from a single precursor — illustrates how numbering and chains are handled.",
  },
];

export function GalleryView({ onOpen }: { onOpen: (uniprot: string, pdbId?: string) => void }) {
  const { toast } = useToast();
  async function copyLink(ex: Example) {
    const url = compareUrl({ query: ex.uniprot, pdbId: ex.pdbId });
    try {
      await navigator.clipboard.writeText(url);
      toast("Shareable link copied", "success");
    } catch {
      toast(url, "info");
    }
  }

  return (
    <section className="gallery">
      <div className="gallery-hero">
        <h2>Example gallery</h2>
        <p className="muted">
          Curated AlphaFold-vs-experiment comparisons, each chosen to teach something. Open one in a click, or copy a
          shareable link — every comparison reproduces from the URL, no account needed.
        </p>
      </div>

      <div className="gallery-grid">
        {EXAMPLES.map((ex) => (
          <div key={ex.uniprot} className="gallery-card">
            <div className="gallery-card-head">
              <span className="gallery-cat">{ex.category}</span>
              <button className="link gallery-copy" onClick={() => void copyLink(ex)} title="Copy shareable link">
                <Icon name="share" size={13} /> link
              </button>
            </div>
            <h3 className="gallery-name">{ex.name}</h3>
            <p className="gallery-blurb muted">{ex.blurb}</p>
            <div className="gallery-card-foot">
              <code className="gallery-acc">{ex.uniprot}</code>
              <button className="primary" onClick={() => onOpen(ex.uniprot, ex.pdbId)}>Open comparison</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
