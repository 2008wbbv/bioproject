# Phase 0 — De-risk: CORS + endpoint verification

Status: **PASSED**. Date: 2026-06-03.

The entire client-only architecture depends on every public API sending permissive
CORS headers so a browser can fetch them cross-origin. SPEC §2 mandates verifying
this before building anything. Each endpoint was probed with an `Origin` header and
its `Access-Control-Allow-Origin` (ACAO) response header inspected.

## Result: all six endpoints allow cross-origin requests

| Endpoint | URL | Status | ACAO |
|---|---|---|---|
| UniProt search | `rest.uniprot.org/uniprotkb/search` | 200 | `*` |
| PDBe best_structures | `ebi.ac.uk/pdbe/api/mappings/best_structures/{u}` | 200 | `*` |
| RCSB file download | `files.rcsb.org/download/{PDB}.cif` | 200 | `*` |
| AlphaFold metadata | `alphafold.ebi.ac.uk/api/prediction/{u}` | 200 | `*` |
| AlphaFold model file | `alphafold.ebi.ac.uk/files/AF-{u}-F1-model_v6.pdb` | 200 | `*` |
| PDBe SIFTS mappings | `ebi.ac.uk/pdbe/api/mappings/{pdb}` | 200 | `*` |

**Conclusion: no proxy is needed.** The app can be a pure static site. If any of
these regress in the future, SPEC §2's fallback (a one-endpoint Vercel edge proxy)
applies, but it is not needed now.

## Findings that change the implementation

1. **AlphaFold files are on `v6`, not the spec's `v4`.** The model/PAE filenames now
   read `..._v6.pdb` / `..._v6.json`. Hardcoding any version is wrong — always read
   the exact file URLs from the metadata endpoint
   (`/api/prediction/{uniprot}` returns `pdbUrl`, `cifUrl`, `paeDocUrl`). This is
   already what SPEC §2 instructs; the version bump confirms why.

2. **The SIFTS numbering bridge is the real subtlety, not CORS.** The
   `/mappings/{pdb}` segment endpoint frequently returns
   `author_residue_number: null`, and the populated `residue_number` is PDBe's
   *label/entity* number, NOT the author number found in `.pdb` ATOM records.
   `best_structures` reports `start`/`end` that are likewise *label* numbers, so
   naively treating them as author numbers mis-pairs residues and inflates RMSD.

   **Resolution (implemented):** for experimental structures, prefer PDBe's
   **updated mmCIF** (`{pdb}_updated.cif`), which annotates every atom with its
   UniProt residue number directly via `_atom_site.pdbx_sifts_xref_db_num`. Reading
   that column sidesteps the entire author-vs-label reconciliation. The SIFTS
   segment logic in `src/engine/sifts.ts` remains as a fallback for files without
   the xref columns. See `parseCif.ts`.

3. **RCSB's `files.rcsb.org` CDN is intermittently flaky** (repeated `504`s observed
   during this session, while PDBe mirrors served the same files fine). PDBe
   alternatives: `ebi.ac.uk/pdbe/entry-files/download/{pdb}_updated.cif` (preferred,
   carries SIFTS xrefs) and `.../pdb{pdb}.ent`. The api layer (Phase 1) should try
   PDBe-updated first and fall back to RCSB.

4. **Node's `fetch` (undici) is sometimes blocked** by EBI (403 without a browser
   UA) and by RCSB's CDN (504). This is a Node-only quirk and does **not** affect
   browsers — Phase 0's ACAO checks via `curl` are the authoritative browser-proxy
   for CORS. The headless validation script works around it by reading
   pre-downloaded files.

## Real-data engine validation (p53, P04637 vs 2OCJ)

Run headless via `npx vite-node scripts/validate-local.ts`. The full
parse → SIFTS → align → compare pipeline on real data produces canonical numbers:

```
Matched CA pairs:     194   (reference monomer length 194; 2OCJ is a homotetramer)
RMSD:                 0.506 A
Median deviation:     0.337 A
TM-score:             0.9909
GDT-TS:               0.9884
pLDDT-error Spearman: -0.5622   (confident residues deviate less — the payload)
```

These match expectations for the p53 DNA-binding domain (AlphaFold vs crystal),
giving end-to-end confidence in the engine beyond the synthetic unit tests.
