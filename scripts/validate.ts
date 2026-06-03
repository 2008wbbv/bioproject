/**
 * Real-data engine validation (not part of the network-free test suite).
 *
 *   npx vite-node scripts/validate.ts [UNIPROT] [PDB_ID]
 *   npx vite-node scripts/validate.ts P04637 2ocj      (default)
 *
 * Runs the full parse -> assign-UniProt -> align -> compare pipeline against real
 * data and prints the metrics, as an end-to-end sanity check beyond the unit tests.
 *
 * Uses PDBe's "updated" mmCIF for the experimental structure: it annotates every
 * atom with its UniProt residue number (SIFTS xref), so no numbering reconciliation
 * is needed. AlphaFold file URLs are read from the metadata endpoint (never a
 * hardcoded version). A browser-like User-Agent is sent only because Node's fetch
 * is otherwise blocked by EBI — real browser requests do not need it.
 */
import { parsePdb } from "../src/engine/parse.ts";
import { parseCif } from "../src/engine/parseCif.ts";
import { assignUniprotFromAuth } from "../src/engine/sifts.ts";
import { alignByUniprot } from "../src/engine/align.ts";
import { computeComparison } from "../src/engine/compare.ts";

const UNIPROT = process.argv[2] ?? "P04637";
const PDB_ID = (process.argv[3] ?? "2ocj").toLowerCase();
const HEADERS = { "User-Agent": "Mozilla/5.0 (engine-validation)" };

async function fetchRetry(url: string): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url, { headers: HEADERS });
      if (r.ok) return r;
      if (r.status < 500) throw new Error(`${r.status} ${url}`);
      lastErr = new Error(`${r.status} ${url}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
  }
  throw lastErr;
}
const getText = async (u: string) => (await fetchRetry(u)).text();
const getJson = async (u: string) => (await fetchRetry(u)).json();

async function main() {
  // 1. AlphaFold model: read the real file URL from metadata, then parse the .pdb.
  const meta = (await getJson(`https://alphafold.ebi.ac.uk/api/prediction/${UNIPROT}`)) as Array<{
    pdbUrl: string;
  }>;
  const af = parsePdb(await getText(meta[0].pdbUrl));
  assignUniprotFromAuth(af.residues);

  // 2. Experimental: PDBe updated mmCIF carries per-atom UniProt numbers.
  const exp = parseCif(
    await getText(`https://www.ebi.ac.uk/pdbe/entry-files/download/${PDB_ID}_updated.cif`),
    { uniprotAcc: UNIPROT },
  );

  // 3. Align + compare. Reference length = monomer length (unique UniProt residues
  //    with a CA), so homo-oligomers in the file don't deflate the TM-score.
  const al = alignByUniprot(af.residues, exp.residues);
  const refLen = new Set(
    exp.residues.filter((r) => r.uniprotNum !== null && r.caXyz).map((r) => r.uniprotNum),
  ).size;
  const result = computeComparison(al, { referenceLength: refLen });

  const devs = [...result.deviations].sort((a, b) => a - b);
  const median = devs[Math.floor(devs.length / 2)] ?? 0;
  const assigned = exp.residues.filter((r) => r.uniprotNum !== null).length;

  console.log(`Protein:              ${UNIPROT} vs ${PDB_ID.toUpperCase()}`);
  console.log(`AF residues:          ${af.residues.length}`);
  console.log(`Exp residues:         ${exp.residues.length} (UniProt-mapped ${assigned})`);
  console.log(`Reference monomer:    ${refLen} residues`);
  console.log(`Exp ligands:          ${exp.ligands.map((l) => `${l.resName}x${l.atomCount}`).join(", ") || "(none)"}`);
  console.log(`Matched CA pairs:     ${result.nMatched}`);
  console.log(`RMSD:                 ${result.rmsd.toFixed(3)} A`);
  console.log(`Median deviation:     ${median.toFixed(3)} A`);
  console.log(`TM-score:             ${result.tmScore.toFixed(4)}`);
  console.log(`GDT-TS:               ${result.gdtTs.toFixed(4)}`);
  console.log(`pLDDT-error Spearman: ${result.plddtErrorSpearman.toFixed(4)}`);
  console.log(`Warnings:             ${[...af.warnings, ...exp.warnings].join(" | ") || "(none)"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
