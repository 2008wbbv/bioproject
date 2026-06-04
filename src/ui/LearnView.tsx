/**
 * "Learn" view: an intro to AlphaFold and the metrics OpenFoldUI computes, plus
 * links to the canonical docs. Also surfaced in the first-run onboarding.
 */
import { Icon } from "./Icon.tsx";

const LINKS: Array<{ title: string; desc: string; href: string }> = [
  { title: "AlphaFold Protein Structure DB", desc: "Predicted structures for ~200M proteins.", href: "https://alphafold.ebi.ac.uk/" },
  { title: "AlphaFold — how confident?", desc: "pLDDT & PAE explained by EMBL-EBI.", href: "https://alphafold.ebi.ac.uk/faq" },
  { title: "AlphaFold 2 paper (Nature, 2021)", desc: "Jumper et al., the original method.", href: "https://www.nature.com/articles/s41586-021-03819-2" },
  { title: "ESMFold / ESM Atlas", desc: "The sequence→structure model used in Fold.", href: "https://esmatlas.com/" },
  { title: "Foldseek", desc: "Fast structure search used in similarity search.", href: "https://search.foldseek.com/" },
  { title: "PDBe", desc: "Experimental structures + SIFTS numbering.", href: "https://www.ebi.ac.uk/pdbe/" },
  { title: "TM-score", desc: "Fold-level similarity (Zhang lab).", href: "https://zhanggroup.org/TM-score/" },
];

export function LearnView() {
  return (
    <section className="learn">
      <div className="learn-hero">
        <div>
          <h2>How OpenFoldUI works</h2>
          <p className="muted">
            It compares a <strong>predicted</strong> structure (AlphaFold-DB, ESMFold, or your own file) against the
            best <strong>experimental</strong> structure of the same protein, and quantifies the agreement — highlighting
            where the model was <em>confidently wrong</em>.
          </p>
        </div>
      </div>

      <div className="learn-grid">
        <Card icon="flask" title="pLDDT — model confidence">
          AlphaFold's per-residue confidence (0–100), stored in the B-factor column. Bands:
          <div className="band-bar" style={{ marginTop: 8 }}>
            <span className="band vhigh" style={{ width: "30%" }} />
            <span className="band conf" style={{ width: "30%" }} />
            <span className="band low" style={{ width: "20%" }} />
            <span className="band vlow" style={{ width: "20%" }} />
          </div>
          <ul className="band-legend">
            <li><span className="dot vhigh" /> Very high &gt; 90</li>
            <li><span className="dot conf" /> Confident 70–90</li>
            <li><span className="dot low" /> Low 50–70</li>
            <li><span className="dot vlow" /> Very low &lt; 50</li>
          </ul>
        </Card>

        <Card icon="grid" title="PAE — relative position error">
          Predicted Aligned Error: how confident AlphaFold is about the relative position of two residues. Bright
          off-diagonal blocks mean two domains' orientation is uncertain.
        </Card>

        <Card icon="layers" title="The metrics">
          <ul className="learn-list">
            <li><strong>RMSD</strong> — average Cα distance after best-fit superposition (lower is better).</li>
            <li><strong>TM-score</strong> — fold similarity, 0–1 (≥ 0.5 = same fold).</li>
            <li><strong>GDT-TS</strong> — fraction of residues within 1–8 Å.</li>
            <li><strong>pLDDT–error ρ</strong> — Spearman of confidence vs deviation; negative = confident & accurate.</li>
          </ul>
        </Card>

        <Card icon="play" title="Quick start">
          <ol className="learn-list">
            <li>Type a protein on the <strong>Dashboard</strong> (e.g. <code>p53</code>).</li>
            <li>Read the metrics, charts, and 3D overlay.</li>
            <li><strong>Upload</strong> your own model, or <strong>Fold</strong> a sequence.</li>
            <li>Star, tag, and export — everything is saved locally.</li>
          </ol>
        </Card>
      </div>

      <h3 className="learn-links-title">Resources</h3>
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

function Card({ icon, title, children }: { icon: Parameters<typeof Icon>[0]["name"]; title: string; children: React.ReactNode }) {
  return (
    <div className="learn-card">
      <div className="learn-card-head"><Icon name={icon} size={18} /> <strong>{title}</strong></div>
      <div className="learn-card-body">{children}</div>
    </div>
  );
}
