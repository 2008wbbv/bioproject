# SPEC.md

Full technical spec. `CLAUDE.md` is the summary, `BUILD_PLAN.md` is the ordered task list. This document is the source of truth for how each piece works.

## 1. The pipeline, end to end

```
protein name or UniProt ID
  -> resolve to UniProt accession        (UniProt REST)
  -> pick best experimental structure    (PDBe best_structures)
  -> fetch AlphaFold model + PAE          (AlphaFold EBI)
  -> fetch experimental structure         (RCSB files)
  -> fetch SIFTS residue mapping          (PDBe mappings)
  -> build residue correspondence (same UniProt residue in both)
  -> Kabsch superposition on matched CA atoms
  -> compute RMSD, TM-score, GDT-TS, per-residue deviation
  -> render overlay in Mol*, color by deviation or pLDDT
  -> plot pLDDT vs actual deviation
```

Batch mode runs this loop over many IDs in Web Workers and produces a sortable table.

## 2. API layer (`src/api/`)

One typed module per source. Every call returns a typed result or a typed error. No raw fetch in components.

**Name to UniProt.** UniProt REST search: `https://rest.uniprot.org/uniprotkb/search?query={name}&format=json&size=5` Take the top reviewed (Swiss-Prot) hit. Let the user disambiguate if several reasonable hits. If the input already looks like an accession (regex `[OPQ][0-9][A-Z0-9]{3}[0-9]` etc.), skip this.

**Best experimental structure.** PDBe: `https://www.ebi.ac.uk/pdbe/api/mappings/best_structures/{uniprot}` Returns PDB structures ranked by coverage and resolution. Pick the top one, but prefer X-ray, prefer higher coverage, and (see section 8) prefer apo over ligand-bound when coverage is comparable. Keep the ranked list so the user can override the pick.

**Experimental structure file.** RCSB: `https://files.rcsb.org/download/{PDB}.cif` (prefer mmCIF for metadata; `.pdb` is the fallback).

**AlphaFold model + metadata + PAE.** AlphaFold EBI:

* metadata: `https://alphafold.ebi.ac.uk/api/prediction/{uniprot}`
* model: `https://alphafold.ebi.ac.uk/files/AF-{uniprot}-F1-model_v4.pdb`
* PAE: `https://alphafold.ebi.ac.uk/files/AF-{uniprot}-predicted_aligned_error_v4.json`

The metadata endpoint gives the exact file URLs, so prefer reading them from there rather than hardcoding `v4`. (Phase 0 confirmed the live version is now `v6`; always read from metadata.)

**SIFTS residue mapping.** PDBe: `https://www.ebi.ac.uk/pdbe/api/mappings/{pdb}` Returns, per chain, the mapping between PDB residue numbering and UniProt residue numbering as aligned segments. This is how you reconcile the two numbering schemes. Treat it as required, not optional.

**CORS is the project's main risk.** These are public programmatic APIs and generally send permissive CORS headers, but this MUST be verified in Phase 0 before anything else is built, because the entire client-only architecture depends on it. If any single endpoint blocks browser cross-origin requests, the options are: a tiny serverless proxy for that one endpoint only (Vercel edge function), or an alternative endpoint. Do not assume. Test each of the six URLs above from a browser fetch and write down the result. (Done — see `docs/PHASE0.md`: all six send `Access-Control-Allow-Origin: *`, no proxy needed.)

## 3. Structure parsing (`src/engine/parse.ts`)

Use Mol*'s model API to parse both files, then extract a flat per-residue array. The engine does not care about Mol*'s internal model beyond extraction; keep the extracted form simple:

```ts
interface ResidueRecord {
  uniprotNum: number | null; // filled via SIFTS for experimental, direct for AF
  authNum: number;           // original numbering in the file
  chain: string;
  resName: string;           // 3-letter
  caXyz: [number, number, number] | null; // CA coordinate, null if missing
  bFactor: number;           // pLDDT for AF models (it lives in the B-factor column), real B-factor for experimental
}
```

For the AlphaFold model, `uniprotNum` is just the residue number (AF models are numbered by the full UniProt sequence). For the experimental structure, `uniprotNum` comes from applying the SIFTS segments to `authNum`. Residues with no CA or no UniProt mapping are dropped from the comparison set but kept for display.

Multi-fragment AF models (proteins longer than ~2700 residues split into F1, F2, ...) are an edge case: handle the single-fragment case in v1 and show a clear "long protein, only fragment 1 compared" notice otherwise.

## 4. Residue correspondence (`src/engine/align.ts`)

Inner-join the two residue arrays on `uniprotNum`. The result is the matched set: a list of pairs where both structures have a CA atom for the same UniProt residue. This is the alignment. There is no combinatorial search because both structures are the same sequence.

Output: two parallel `Float64Array`s of matched CA coordinates (P = AlphaFold, Q = experimental) plus the UniProt residue numbers they correspond to, for later per-residue reporting.

## 5. Comparison engine (`src/engine/compare.ts`)

This is the core. Pure math, fully unit-tested. It is the primary path: the native tools in section 6 are validation and optional alternatives, not dependencies. The engine must produce every metric on its own.

**Kabsch superposition.** Standard optimal-rotation algorithm:

1. Compute centroids of P and Q, subtract to center both.
2. Covariance `H = Pᵀ Q` (3x3).
3. SVD `H = U S Vᵀ` (use `ml-matrix`).
4. `d = sign(det(V Uᵀ))` to avoid a reflection.
5. Rotation `R = V · diag(1, 1, d) · Uᵀ`.
6. Apply R to centered P, then translate to Q's centroid.

Superpose AlphaFold (moving) onto experimental (reference).

**RMSD** over the matched CA atoms after superposition.

**Per-residue deviation** `d_i` = distance between the matched CA pair after superposition, indexed by UniProt residue. This array drives the heatmap and the pLDDT-vs-error scatter. This is the most important output.

**TM-score:**

```
d0 = 1.24 * cbrt(L - 15) - 1.8     // clamp to a floor of ~0.5 for small L
TM = (1 / L) * Σ_i  1 / (1 + (d_i / d0)^2)
```

where L is the number of residues in the reference (experimental) structure. Be honest in code comments about what this is: TM-score computed on the native sequence correspondence under the optimal CA superposition. Real TM-align iteratively re-superposes to maximize TM, which can nudge the value up slightly. For two models of the same protein the difference is small, and section 6's validation measures it. Optional refinement: a few rounds of re-superposing on only the residues currently within d0, recomputing TM, to converge toward TM-align's number. Implement plain version first, add refinement only if validation shows it is needed.

**GDT-TS** = mean of the fraction of matched CAs within 1, 2, 4, and 8 angstroms after superposition. Cheap, standard, worth including.

**pLDDT vs error.** For each matched residue you now have both the AlphaFold pLDDT (its B-factor) and the actual deviation `d_i`. The Spearman correlation between them, and the scatter plot of the two, is the scientific payload of the whole tool. Compute Spearman in TS (rank, then Pearson on ranks).

Engine output shape:

```ts
interface ComparisonResult {
  uniprot: string;
  pdbId: string;
  nMatched: number;
  rmsd: number;
  tmScore: number;
  gdtTs: number;
  plddtErrorSpearman: number;
  perResidue: Array<{
    uniprotNum: number;
    deviation: number;
    plddt: number;
  }>;
  warnings: string[]; // e.g. "experimental structure is ligand-bound", "low UniProt coverage"
  backend: "native" | "tmalign-wasm"; // which engine produced these numbers
}
```

## 6. Comparison backends and validation (`src/engine/backends/`)

The TypeScript engine in section 5 is the default and always works with no extra setup. On top of it sit two native tools, both compiled to WebAssembly so they still run fully in the browser and the client-only rule holds. Neither is a CLI binary on a server.

**TM-align via `tmalign-wasm`.** This is a published npm package (the Foldseek webserver uses it to run TM-align in the browser). Wire it as a swappable backend: feed it the two PDB strings, parse its TM-score and RMSD out of the text output. Two uses:

1. Validation. Run the native TS engine and `tmalign-wasm` on the same protein and assert the numbers agree within tolerance. This is the proof that the from-scratch engine is correct, and it is the headline feature for a portfolio: a self-built structural-alignment engine verified against the canonical reference tool, side by side in the UI.
2. Optional backend. Let the user pick which engine computed a given result. The `backend` field on `ComparisonResult` records the choice.

The TS engine stays primary because it also produces the per-residue deviation array and pLDDT correlation that drive the visuals; `tmalign-wasm` only returns summary scores.

**Secondary structure (in place of DSSP).** Do not ship a DSSP binary. Mol* assigns secondary structure (helix/sheet/coil) in pure JS from coordinates, which is enough for coloring and for the secondary-structure-aware deviation breakdown. Only consider a WASM DSSP build if canonical DSSP output is specifically required, since modern mkdssp pulls in libcifpp and boost and is a hard build.

**US-align: deferred.** Same WASM approach as TM-align but no ready-made npm package exists, so it is a real Emscripten build. Its advantages (complexes, multi-chain, RNA) do not apply to same-sequence single-protein comparison, so it buys almost nothing here. Leave it out of v1. Revisit only if the tool grows into multi-chain comparison.

## 7. Viewer (`src/viewer/`)

Mol* in a React wrapper. Load both structures, apply the rotation+translation from the engine so they are superposed in the same coordinate frame. Two color modes with a toggle:

* Deviation mode: color each residue by `d_i` on a blue (agree) to red (disagree) scale. Make the scale legend explicit in angstroms.
* pLDDT mode: the standard AlphaFold palette (orange <50, yellow 50 to 70, cyan 70 to 90, blue >90).

The story the user should be able to see by toggling: regions that are blue in pLDDT mode (high confidence) but red in deviation mode (high actual error) are where AlphaFold was confidently wrong. Make that comparison easy.

Mol* is heavy and has a learning curve. If it becomes a time sink in Phase 2, NGL (`ngl`) is a lighter fallback that still does both structures and custom per-residue coloring. Prefer Mol* for polish; do not let it block the milestone.

## 8. Apo/holo handling (stretch, but design for it)

A confound in the science: the experimental structure may be bound to a ligand (holo) while AlphaFold predicts the bare protein (apo), which inflates RMSD in the binding region for reasons that are not AlphaFold's "fault." Detect it by scanning HETATM records in the experimental file. Filter out the usual crystallization junk (water, GOL, EDO, SO4, PO4, common ions, etc.; keep a maintained ignore-list) and flag any remaining heteroatom groups as a likely real ligand. Surface this as a warning, and in batch mode as a sortable column, so the user can exclude or segregate holo structures. This is a v1.5 feature but the data flow (parse HETATM, keep a warnings array) should exist from the start.

## 9. Caching (`src/cache/`)

IndexedDB via `idb`. Two stores: raw structure files keyed by ID, and computed `ComparisonResult`s keyed by `{uniprot}:{pdbId}:{backend}`. Check cache before any fetch or compute. Add a visible "clear cache" control. This is what makes batch mode over hundreds of proteins bearable on a second run.

## 10. Batch mode (`src/batch/`)

Input: a textarea of IDs or a CSV/text file upload. Run the full per-protein pipeline in a pool of Web Workers (the engine is pure TS, so it runs cleanly in a worker; the only catch is Mol* parsing, which may need to happen on the main thread or via a lighter parser inside the worker, decide during Phase 4). Show live progress. Output a sortable, filterable table of every metric plus warnings, with CSV export. This is the feature that turns a 10-protein study into a 500-protein study, so it should feel effortless.

## 11. Structure search via Foldseek (`src/search/`, the one non-client-side feature)

This is a different job from the rest of the tool. Everything else compares two known structures of the same protein. Foldseek answers "what else in the world looks like this," searching a query structure against large databases (AlphaFoldDB, PDB, CATH, ESM Atlas). It cannot run in the browser: it needs gigabyte reference databases resident in memory. So this feature, and only this feature, depends on a remote service.

v1 approach: best-effort remote call. POST the query structure to the public Foldseek webserver (`https://search.foldseek.com`), poll for the result ticket, render the hit list and let the user open any hit as a new comparison. Treat it as explicitly best-effort: that public API is known to be unreliable and has had extended outages, so this feature must degrade gracefully (clear "search service unavailable" state, never block the rest of the app) and must be verifiable in a de-risk spike before any UI is built on it, exactly like the CORS check.

Reliability upgrade, documented but not built in v1: self-host Foldseek via the MMseqs2-App docker-compose deployment, then point `src/search/` at your own instance. That is the only path to dependable search, and it is the single place where adding a backend becomes worth it. Keep this isolated in `src/search/` so the rest of the app never gains a server dependency.

## 12. Charts (`src/charts/`)

* pLDDT vs deviation scatter (per residue, for the single-protein view).
* Distribution plots for batch results (violin or histogram of TM-score, RMSD across the set).

Decision: **Observable Plot** (nicer statistical plots; a bit more glue in React than Recharts, accepted).

## 13. Out of scope for v1 (write down so it does not creep in)

* Aligning two different proteins (this tool assumes same-sequence comparison).
* US-align and any multi-chain / complex / RNA comparison (see section 6).
* A backend server for anything except the optional self-hosted Foldseek in section 11. The core app stays a static site.
* Canonical DSSP binary output (Mol*'s JS assignment is the v1 answer).
* User accounts, saved sessions beyond the local cache.
* Comparing more than two structures at once.
