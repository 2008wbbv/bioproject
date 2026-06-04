/**
 * "Learn" view: a self-contained docs page — what OpenFoldUI does, how to read
 * AlphaFold confidence, what each metric means, how to interpret results, how the
 * pipeline works, a glossary, an FAQ, and links to the canonical sources.
 */
import { Icon, type IconName } from "./Icon.tsx";

const LINKS: Array<{ title: string; desc: string; href: string }> = [
  { title: "AlphaFold Protein Structure DB", desc: "Predicted structures for ~200M proteins.", href: "https://alphafold.ebi.ac.uk/" },
  { title: "AlphaFold — how confident?", desc: "pLDDT & PAE explained by EMBL-EBI.", href: "https://alphafold.ebi.ac.uk/faq" },
  { title: "AlphaFold 2 paper (Nature, 2021)", desc: "Jumper et al., the original method.", href: "https://www.nature.com/articles/s41586-021-03819-2" },
  { title: "ESMFold / ESM Atlas", desc: "The sequence→structure model used in Fold.", href: "https://esmatlas.com/" },
  { title: "Foldseek", desc: "Fast structure search used in similarity search.", href: "https://search.foldseek.com/" },
  { title: "PDBe", desc: "Experimental structures + SIFTS numbering.", href: "https://www.ebi.ac.uk/pdbe/" },
  { title: "TM-score", desc: "Fold-level similarity (Zhang lab).", href: "https://zhanggroup.org/TM-score/" },
  { title: "lDDT", desc: "Local, superposition-free accuracy (Mariani 2013).", href: "https://swissmodel.expasy.org/lddt/" },
];

const METRICS: Array<{ name: string; range: string; what: string; good: string }> = [
  { name: "RMSD", range: "0 → ∞ Å", what: "Average Cα distance after best-fit superposition.", good: "lower; < 2 Å is close. Sensitive to outliers and domain motion." },
  { name: "TM-score", range: "0 → 1", what: "Length-normalised fold similarity.", good: "higher; ≥ 0.5 = same fold. Robust to a few local errors." },
  { name: "GDT-TS", range: "0 → 1", what: "Mean fraction of residues within 1, 2, 4, 8 Å.", good: "higher; rewards getting most of the structure right." },
  { name: "lDDT", range: "0 → 1", what: "Local distance differences — superposition-FREE.", good: "higher; this is exactly what pLDDT predicts." },
  { name: "pLDDT–error ρ", range: "−1 → 1", what: "Spearman of confidence vs deviation.", good: "negative = confident where it's accurate (well-calibrated)." },
];

const GLOSSARY: Array<[string, string]> = [
  ["AlphaFold", "DeepMind's deep-learning method that predicts 3D structure from sequence."],
  ["pLDDT", "AlphaFold's per-residue confidence (0–100), stored in the PDB B-factor column."],
  ["PAE", "Predicted Aligned Error — expected error (Å) of residue i when aligned on residue j."],
  ["RMSD", "Root-mean-square deviation of matched Cα atoms after superposition."],
  ["TM-score", "Template-modeling score; length-normalised fold similarity (0–1)."],
  ["GDT-TS", "Global Distance Test (Total Score); fraction of residues within distance cutoffs."],
  ["lDDT", "Local Distance Difference Test; superposition-free per-residue accuracy."],
  ["SIFTS", "PDBe mapping between PDB and UniProt residue numbering — how we match residues."],
  ["Kabsch", "The optimal rigid-body superposition algorithm (SVD-based)."],
  ["apo / holo", "Without ligand (apo) vs bound to a ligand (holo)."],
  ["IDR", "Intrinsically disordered region — flexible, often low-pLDDT."],
  ["ESMFold", "A protein language model that folds a single sequence (no MSA)."],
  ["Foldseek", "Fast structural similarity search across large databases."],
];

const FAQ: Array<[string, React.ReactNode]> = [
  ["Where does the data come from?", "UniProt (resolve names), PDBe (best experimental structure + SIFTS numbering), RCSB/PDBe (structure files), and the AlphaFold DB (models + PAE). All are public, CORS-enabled APIs."],
  ["Is anything uploaded to a server?", "No. Every comparison runs in your browser; uploaded files never leave your machine. The only optional remote calls are AlphaFold-DB/PDBe fetches, Foldseek search, and folding (ESMFold or your own endpoint)."],
  ["What if there's no experimental structure?", "Use Inspect model — it analyses the AlphaFold prediction on its own (confidence, disorder, PAE, domains, 3D)."],
  ["Why do RMSD/TM differ slightly from other tools?", "TM-align iteratively re-superposes on the core; our plain value is close, and we also show an iterative-refined TM-score and validate against tmalign-wasm (~0.001 agreement)."],
  ["Can I fold a sequence with real AlphaFold?", "There's no free public AlphaFold folding API (it needs GPU + MSA). Fold uses ESMFold by default, or point it at your own AlphaFold/ColabFold endpoint."],
  ["Why is the model wrong at a flexible loop?", "Low-pLDDT / disordered regions are often genuinely flexible, and holo binding sites move on ligand binding — high deviation there usually isn't the predictor's fault."],
];

export function LearnView({ onStartTour }: { onStartTour?: () => void }) {
  return (
    <section className="learn">
      <div className="learn-hero">
        <div>
          <h2>How OpenFoldUI works</h2>
          <p className="muted">
            The AlphaFold companion: <strong>inspect</strong> a prediction, <strong>validate</strong> it against the
            real experimental structure, and find where the model was <em>confidently wrong</em>.
          </p>
        </div>
        {onStartTour && (
          <button className="learn-tour-btn primary" onClick={onStartTour}>
            <Icon name="flask" size={16} /> Start the guided tour
          </button>
        )}
      </div>

      <nav className="learn-toc">
        {[
          ["confidence", "Confidence"],
          ["metrics", "The metrics"],
          ["interpret", "Interpreting results"],
          ["how", "How it works"],
          ["glossary", "Glossary"],
          ["faq", "FAQ"],
          ["resources", "Resources"],
        ].map(([id, label]) => (
          <a key={id} href={`#learn-${id}`}>{label}</a>
        ))}
      </nav>

      <h3 id="learn-confidence" className="learn-section">Understanding AlphaFold confidence</h3>
      <div className="learn-grid">
        <Card icon="flask" title="pLDDT — per-residue confidence">
          AlphaFold's confidence (0–100), stored in the B-factor column. Bands:
          <div className="band-bar" style={{ marginTop: 8 }}>
            <span className="band vhigh" style={{ width: "30%" }} />
            <span className="band conf" style={{ width: "30%" }} />
            <span className="band low" style={{ width: "20%" }} />
            <span className="band vlow" style={{ width: "20%" }} />
          </div>
          <ul className="band-legend">
            <li><span className="dot vhigh" /> Very high &gt; 90 — backbone & often side-chains reliable</li>
            <li><span className="dot conf" /> Confident 70–90 — backbone reliable</li>
            <li><span className="dot low" /> Low 50–70 — treat with caution</li>
            <li><span className="dot vlow" /> Very low &lt; 50 — often disordered</li>
          </ul>
        </Card>
        <Card icon="grid" title="PAE — relative position error">
          Predicted Aligned Error: the expected error in residue i's position when the structure is aligned on
          residue j. Low square blocks on the diagonal are confident <strong>domains</strong>; bright off-diagonal
          regions mean the relative orientation of two domains is uncertain.
        </Card>
        <Card icon="layers" title="Calibration">
          pLDDT is a <em>prediction of lDDT</em>. OpenFoldUI computes the observed lDDT and plots pLDDT vs lDDT — on
          the diagonal means perfectly calibrated; below it means the model was over-confident.
        </Card>
        <Card icon="alert" title="Predicted disorder">
          Long stretches of pLDDT &lt; 50 flag likely intrinsically disordered regions. High deviation there is
          usually genuine flexibility, not a prediction error.
        </Card>
      </div>

      <h3 id="learn-metrics" className="learn-section">The metrics</h3>
      <div className="datasheet-scroll">
        <table className="learn-metrics-table">
          <thead><tr><th>Metric</th><th>Range</th><th>What it measures</th><th>Reading it</th></tr></thead>
          <tbody>
            {METRICS.map((m) => (
              <tr key={m.name}><td><strong>{m.name}</strong></td><td>{m.range}</td><td>{m.what}</td><td className="muted">{m.good}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 id="learn-interpret" className="learn-section">Interpreting your results</h3>
      <div className="learn-grid">
        <Card icon="alert" title="Confidently wrong">
          The headline signal: residues with <strong>high pLDDT yet high deviation</strong>. Shown as a shaded
          quadrant in the scatter and a dedicated table. These are where the model was sure — and missed.
        </Card>
        <Card icon="grid" title="Domains right, orientation wrong">
          When global RMSD is poor but each domain's RMSD is good, AlphaFold folded the domains correctly but
          mis-placed them relative to each other. The PAE domain panel exposes this.
        </Card>
        <Card icon="beaker" title="apo vs holo">
          If the experiment is ligand-bound (holo) and the model is apo, the binding site can deviate for reasons
          that aren't the predictor's fault. The binding-site panel separates that out.
        </Card>
        <Card icon="book" title="Experimental flexibility">
          The B-factor-vs-deviation plot asks whether the model errs where the <em>crystal</em> is also fuzzy —
          reframing "errors" against experimental uncertainty.
        </Card>
      </div>

      <h3 id="learn-how" className="learn-section">How it works</h3>
      <ol className="learn-steps">
        <li><strong>Resolve</strong> a name/accession to a UniProt id.</li>
        <li><strong>Pick</strong> the best experimental structure (PDBe; prefer X-ray, coverage, resolution).</li>
        <li><strong>Fetch</strong> the AlphaFold model + PAE and the experimental file in parallel.</li>
        <li><strong>Number</strong> residues by UniProt — read per-atom from PDBe's updated mmCIF (SIFTS), so no fragile numbering maths.</li>
        <li><strong>Align</strong> by inner-join on UniProt residue (same sequence → no combinatorial search).</li>
        <li><strong>Superpose</strong> the matched Cα atoms (Kabsch / SVD) and compute every metric.</li>
        <li><strong>Validate</strong> against canonical TM-align (compiled to WASM) — they agree to ~0.001 TM-score.</li>
      </ol>
      <p className="muted small">The engine is pure and headless (no DOM/network), fully unit-tested, and produces every metric itself — TM-align is only a cross-check.</p>

      <h3 id="learn-glossary" className="learn-section">Glossary</h3>
      <dl className="learn-glossary">
        {GLOSSARY.map(([term, def]) => (
          <div key={term}><dt>{term}</dt><dd className="muted">{def}</dd></div>
        ))}
      </dl>

      <h3 id="learn-faq" className="learn-section">FAQ</h3>
      <div className="learn-faq">
        {FAQ.map(([q, a]) => (
          <details key={q}><summary>{q}</summary><p className="muted">{a}</p></details>
        ))}
      </div>

      <h3 id="learn-resources" className="learn-section">Resources</h3>
      <div className="learn-links">
        {LINKS.map((l) => (
          <a key={l.href} className="learn-link" href={l.href} target="_blank" rel="noreferrer">
            <Icon name="book" size={16} />
            <div>
              <div className="learn-link-title">{l.title} <Icon name="share" size={11} /></div>
              <div className="muted small">{l.desc}</div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function Card({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <div className="learn-card">
      <div className="learn-card-head"><Icon name={icon} size={18} /> <strong>{title}</strong></div>
      <div className="learn-card-body">{children}</div>
    </div>
  );
}
