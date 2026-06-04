/** Quick links out to the canonical databases for a protein/structure. */
import { Icon } from "../ui/Icon.tsx";

const ACCESSION = /^[A-Z0-9]{6,10}$/;

export function ExternalLinks({ uniprot, pdbId }: { uniprot: string; pdbId?: string }) {
  const links: Array<{ label: string; href: string }> = [];
  if (ACCESSION.test(uniprot)) {
    links.push({ label: "AlphaFold DB", href: `https://alphafold.ebi.ac.uk/entry/${uniprot}` });
    links.push({ label: "UniProt", href: `https://www.uniprot.org/uniprotkb/${uniprot}` });
  }
  if (pdbId && /^[0-9A-Za-z]{4}$/.test(pdbId)) {
    links.push({ label: `PDBe ${pdbId.toUpperCase()}`, href: `https://www.ebi.ac.uk/pdbe/entry/pdb/${pdbId.toLowerCase()}` });
  }
  if (links.length === 0) return null;
  return (
    <div className="external-links">
      {links.map((l) => (
        <a key={l.href} className="ext-link" href={l.href} target="_blank" rel="noreferrer">
          {l.label} <Icon name="share" size={11} />
        </a>
      ))}
    </div>
  );
}
