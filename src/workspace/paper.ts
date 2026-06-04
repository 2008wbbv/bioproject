/**
 * "Export for paper": a publication-ready bundle (.zip) for one comparison —
 * a Markdown methods+results document, the key figures as standalone SVGs, the
 * metrics and per-residue data as CSV, and a BibTeX file citing the tools and
 * databases used. Drop it straight into a manuscript repo.
 */
import * as Plot from "@observablehq/plot";
import { zipText } from "../zip.ts";
import { methodsText } from "./log.ts";
import { perResidueCsv } from "./csv.ts";
import { APP_VERSION } from "../version.ts";
import type { WorkspaceEntry } from "./types.ts";

function svgOf(options: Plot.PlotOptions): string {
  const node = Plot.plot(options);
  const svg = node instanceof SVGElement ? node : node.querySelector("svg");
  const html = (svg ?? node).outerHTML;
  node.remove?.();
  return `<?xml version="1.0" encoding="UTF-8"?>\n${html.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"')}`;
}

const BIBTEX = `@article{jumper2021alphafold,
  title={Highly accurate protein structure prediction with AlphaFold},
  author={Jumper, John and others}, journal={Nature}, volume={596}, pages={583--589}, year={2021}}

@article{varadi2022alphafolddb,
  title={AlphaFold Protein Structure Database},
  author={Varadi, Mihaly and others}, journal={Nucleic Acids Research}, volume={50}, pages={D439--D444}, year={2022}}

@article{zhang2004tmscore,
  title={Scoring function for automated assessment of protein structure template quality},
  author={Zhang, Yang and Skolnick, Jeffrey}, journal={Proteins}, volume={57}, pages={702--710}, year={2004}}

@article{mariani2013lddt,
  title={lDDT: a local superposition-free score for comparing protein structures},
  author={Mariani, Valerio and others}, journal={Bioinformatics}, volume={29}, pages={2722--2728}, year={2013}}

@article{lin2023esmfold,
  title={Evolutionary-scale prediction of atomic-level protein structure with a language model},
  author={Lin, Zeming and others}, journal={Science}, volume={379}, pages={1123--1130}, year={2023}}

@article{vankempen2024foldseek,
  title={Fast and accurate protein structure search with Foldseek},
  author={van Kempen, Michel and others}, journal={Nature Biotechnology}, volume={42}, pages={243--246}, year={2024}}

@article{dana2019sifts,
  title={SIFTS: updated Structure Integration with Function, Taxonomy and Sequences},
  author={Dana, Jose M and others}, journal={Nucleic Acids Research}, volume={47}, pages={D482--D489}, year={2019}}
`;

function methodsMarkdown(entry: WorkspaceEntry): string {
  const rho = Number.isNaN(entry.plddtErrorSpearman) ? "n/a" : entry.plddtErrorSpearman.toFixed(2);
  const lddt = entry.lddt != null ? entry.lddt.toFixed(3) : "n/a";
  return `# ${entry.proteinName} (${entry.uniprot}) — predicted vs experimental

_Predicted model vs ${entry.pdbId} chain ${entry.chain}. Generated with OpenFoldUI v${APP_VERSION}._

## Methods

${methodsText(entry)}

## Results

| Metric | Value |
| --- | --- |
| Matched Cα residues | ${entry.nMatched} |
| RMSD | ${entry.rmsd.toFixed(2)} Å |
| TM-score | ${entry.tmScore.toFixed(3)} |
| GDT-TS | ${entry.gdtTs.toFixed(3)} |
| lDDT (observed) | ${lddt} |
| pLDDT–error Spearman ρ | ${rho} |

**Figures** — \`figure1_plddt_vs_deviation.svg\` (per-residue pLDDT vs Cα deviation) and
\`figure2_deviation_track.svg\` (deviation along the sequence). Tabular data in
\`metrics.csv\` and \`per-residue.csv\`.

${entry.warnings.length ? `> **Caveats:** ${entry.warnings.join("; ")}\n` : ""}
${entry.notes ? `## Notes\n\n${entry.notes}\n` : ""}
## Citing

See \`citations.bib\` for AlphaFold, the AlphaFold DB, TM-score, lDDT, ESMFold, Foldseek, and SIFTS.
`;
}

export function exportPaperBundle(entry: WorkspaceEntry): void {
  const per = entry.perResidue;
  const fig1 = svgOf({
    width: 520, height: 360, marginLeft: 52, marginBottom: 44,
    x: { label: "pLDDT", domain: [0, 100], grid: true },
    y: { label: "Cα deviation (Å)", grid: true },
    marks: [Plot.dot(per, { x: "plddt", y: "deviation", fill: "deviation", r: 2.6 })],
  });
  const sorted = [...per].sort((a, b) => a.uniprotNum - b.uniprotNum);
  const fig2 = svgOf({
    width: 720, height: 240, marginLeft: 52, marginBottom: 44,
    x: { label: "UniProt residue", grid: true },
    y: { label: "Cα deviation (Å)", grid: true },
    marks: [Plot.areaY(sorted, { x: "uniprotNum", y: "deviation", fill: "#dbeafe" }), Plot.lineY(sorted, { x: "uniprotNum", y: "deviation", stroke: "#2563eb" })],
  });

  const metricsCsv =
    "metric,value\r\n" +
    [
      ["matched", entry.nMatched],
      ["rmsd_angstrom", entry.rmsd.toFixed(3)],
      ["tm_score", entry.tmScore.toFixed(4)],
      ["gdt_ts", entry.gdtTs.toFixed(4)],
      ["lddt", entry.lddt != null ? entry.lddt.toFixed(4) : ""],
      ["plddt_error_spearman", Number.isNaN(entry.plddtErrorSpearman) ? "" : entry.plddtErrorSpearman.toFixed(4)],
    ]
      .map(([k, v]) => `${k},${v}`)
      .join("\r\n");

  const slug = `${entry.uniprot}_${entry.pdbId}_${entry.chain}`;
  const bytes = zipText([
    { name: "methods.md", text: methodsMarkdown(entry) },
    { name: "figure1_plddt_vs_deviation.svg", text: fig1 },
    { name: "figure2_deviation_track.svg", text: fig2 },
    { name: "metrics.csv", text: metricsCsv },
    { name: "per-residue.csv", text: perResidueCsv(entry) },
    { name: "citations.bib", text: BIBTEX },
  ]);
  const blob = new Blob([bytes as BlobPart], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}_paper.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
