# BUILD_PLAN.md

Ordered task list. `SPEC.md` is the source of truth; `CLAUDE.md` is the summary.
Checkboxes reflect actual repo state.

## Phase 0 — De-risk (gating) ✅ DONE

- [x] Verify CORS on all six endpoints (UniProt, PDBe best_structures, RCSB,
      AlphaFold metadata, AlphaFold model, PDBe SIFTS). **All send ACAO `*` — no
      proxy needed.** See `docs/PHASE0.md`.
- [x] Confirm AlphaFold file version (now `v6`; always read URLs from metadata).
- [x] Characterize the SIFTS numbering bridge; choose the updated-mmCIF approach.
- [ ] Foldseek search de-risk spike (deferred until Phase 5; it is best-effort and
      isolated, so it does not gate the rest).

## Phase 1 — Engine core ✅ DONE (this milestone)

- [x] Project scaffold: Vite + React + TypeScript + Vitest, strict tsconfig.
- [x] `src/engine/types.ts` — shared types.
- [x] `src/engine/parse.ts` — fixed-column `.pdb` parser (AlphaFold models).
- [x] `src/engine/parseCif.ts` — mmCIF parser reading UniProt numbers directly from
      PDBe updated-cif SIFTS xref columns; falls back to null for plain mmCIF.
- [x] `src/engine/ligands.ts` — crystallization-junk ignore-list (apo/holo).
- [x] `src/engine/sifts.ts` — SIFTS segment application + tolerant extractors +
      `assignUniprotFromAuth`.
- [x] `src/engine/align.ts` — inner-join on `uniprotNum` → parallel CA arrays.
- [x] `src/engine/compare.ts` — Kabsch, RMSD, TM-score, GDT-TS, per-residue
      deviation, Spearman.
- [x] Unit tests: 48 passing (synthetic, with known-answer cases for every metric).
- [x] Real-data validation script (p53 / 2OCJ): RMSD 0.51 Å, TM 0.99, GDT 0.99.

### Known limitations to revisit
- Insertion codes are ignored in the SIFTS segment path (`sifts.ts`); the
  updated-cif path handles them via per-atom numbers. Fine for v1.
- Multi-chain experimental structures (homo-oligomers): the alignment takes the
  first CA per UniProt number, effectively comparing against one representative
  chain. The caller supplies `referenceLength` = unique-UniProt-residue count
  (monomer length) for correct TM normalization. Best-chain selection is a Phase 1
  api-layer refinement.
- Multi-fragment AF models (>2700 aa, F1/F2/...): only F1 in v1, with a notice
  (SPEC §3) — to be surfaced in the api layer.

## Phase 1.5 — API layer (`src/api/`) ✅ DONE

- [x] `errors.ts` / `http.ts` — typed ApiError/NotFoundError; the single network
      surface; multi-URL fallback helper. No raw `fetch` in components.
- [x] `uniprot.ts` — name→accession (skips the search when the input matches the
      accession regex); top reviewed hit; disambiguation candidates.
- [x] `pdbe.ts` — `best_structures` re-ranked (X-ray, then coverage, then
      resolution); SIFTS `/mappings` for the segment fallback.
- [x] `structure.ts` — prefer PDBe `{pdb}_updated.cif` (per-atom UniProt numbers),
      fall back to PDBe/RCSB plain `.cif` (RCSB CDN is flaky, see Phase 0).
- [x] `alphafold.ts` — metadata → real file URLs (no hardcoded version) → model.
- [x] `pipeline.ts` — id → result; best-chain selection; monomer `referenceLength`;
      holo + degenerate-case warnings.
- [x] Tests for the pure logic (accession regex, hit/structure ranking, best-chain).

### Still to refine in the api layer
- [ ] Apo-over-holo *preference* in the pick (currently only flags holo; choosing apo
      needs fetching candidates' HETATM — SPEC §8, v1.5).
- [ ] Multi-fragment AF models (>2700 aa): currently F1 only, no explicit notice yet.

## Phase 2 — Viewer + charts ✅ DONE

- [x] `charts/` — Observable Plot: pLDDT-vs-deviation scatter (with a "confidently
      wrong" quadrant) + per-residue deviation track tinted by pLDDT.
- [x] `viewer/MolstarViewer.tsx` — Mol* React wrapper, lazy-loaded, error-boundaried;
      experimental (grey) + AF superposed; deviation/pLDDT color toggle via the
      B-factor-encoding trick (`prepareModels.ts` + `engine/pdbTransform.ts`).
- [x] `App.tsx` + `styles.css` — input, examples, metrics cards, structure-override
      dropdown, warnings, charts, viewer.
- [ ] **Visual QA pending:** the 3D render was not eyeballed in a browser (headless
      build env). Verify colors/superposition look right; tune the `uncertainty`
      palette/domain if needed. NGL remains the fallback if Mol* misbehaves.

## Phase 3 — Validation backend (`src/engine/backends/`) ✅ DONE

- [x] `tmalign-wasm` backend (`backends/tmalign.ts`): lazy-imported WASM, parses
      TM-score + RMSD; typed TmalignError; Vite configured (`assetsInclude` wasm).
- [x] `writePdb.ts`: CA-only PDB writer so TM-align gets clean PDB (no mmCIF-support
      assumption); `ValidationPanel.tsx`: native-vs-TM-align side-by-side.
- [x] **Verified for real**: drove tmalign-wasm in Node on p53/2OCJ — TM-score
      0.9916 (TM-align) vs 0.9909 (engine), RMSD 0.48 vs 0.51 Å. The from-scratch
      engine agrees with the canonical tool to ~0.001 TM-score. (Pass experimental
      as pdb1 so TM-align's Chain_1 normalisation matches the engine's.)
- [ ] Iterative TM refinement: not needed — plain value already matches TM-align.

## Phase 4 — Cache + batch ✅ DONE

- [x] IndexedDB via `idb` (`src/workspace/db.ts`): comparisons keyed
      `{uniprot}:{pdbId}:{chain}` + a separate `structures` store. (This is the
      workspace; it also covers caching.)
- [x] Batch (`src/batch/`): `parseIds.ts`, a bounded-concurrency promise pool
      (`pool.ts`), `runBatch.ts` (saves each result to the workspace), and
      `BatchView.tsx` with live progress + a per-item status table.
- [x] Charts: single-protein scatter + per-residue track (Phase 2); batch TM-score
      and RMSD distributions (`charts/Distributions.tsx`).
- [x] Export: per-comparison and bulk (the workspace dashboard), .xlsx + .csv.
- Note: a main-thread promise pool is used instead of a Web Worker pool — the
  pipeline is network-bound, so workers wouldn't help; the pure engine stays
  worker-ready if compute ever dominates.

## Phase 5 — Foldseek search (`src/search/`) ✅ DONE

- [x] De-risk spike: `search.foldseek.com` endpoints send CORS `*` and accept
      browser submissions; ran a full real search (submit → poll → result) and
      captured the JSON shape to build the parser.
- [x] `foldseek.ts`: submit → poll (backoff + timeout) → parse results; typed
      SearchError; pure parsing (target→accession, result flattening) unit-tested.
- [x] `SearchPanel.tsx`: best-effort UI, degrades gracefully to an "unavailable"
      state; each AlphaFold-DB hit opens as a new comparison.
- [ ] Self-hosted MMseqs2-App upgrade path — documented in SPEC §11 (not built).

## Product features (OpenFoldUI) ✅ DONE

- [x] **Dashboard home** (`workspace/Dashboard.tsx`, `stats.ts`): the landing page —
      quick-compare, aggregate stats, TM/RMSD distributions, favorites strip, tag
      filter, and the full sortable table. Friendly empty state.
- [x] **Tags** on comparisons (`TagEditor`, dashboard filter, in exports/backup).
- [x] **Dark mode** (`useTheme.ts`, persisted) with a header toggle.
- [x] Rebrand to **OpenFoldUI**.
- [x] **Upload your own files**: compare a local model (PDB/CIF, pLDDT in B-factor)
      vs a local or fetched reference (`UploadPanel`, `runCustomComparison`,
      `engine/format.ts`). Format-aware viewer + format-safe TM-align validation
      (CA-only PDBs precomputed).
- [x] **Confidence analysis** (`engine/analysis.ts`, `ConfidenceSummary`): pLDDT
      bands, agreement stats, and a "confidently wrong" worst-residues table.
- [x] **Download superposed model** (PDB) for use in external tools.
- [x] **Workspace backup**: export/import the workspace as JSON (`backup.ts`).
- [x] **Batch**: load an ID list from a file.
- [x] **Replication logs** (`log.ts`): per-comparison + bulk provenance + methods
      text, so analyses can be reproduced.
- [x] **Side-by-side compare** two saved comparisons (deltas + overlaid deviation).
- [x] **Configurable thresholds** (`settings.tsx`) across scatter/sheet/summary.
- [x] **PAE heatmap** (`engine/pae.ts`, `PaePanel`) for AlphaFold entries.
- [x] **Divergent-region** breakdown (`engine/analysis.divergentRegions`).
- [x] **Re-run** a database comparison.
- [x] **Cross-numbering uploads**: author / UniProt / **sequence alignment**
      (`engine/seqalign.ts`, Needleman–Wunsch).
- [x] **Shareable permalinks** (`permalink.ts`, `#compare=…`).
- [x] **Batch file import** with column picker (`batch/csvColumns.ts`) + per-batch
      Excel export.
- [x] **App shell** (`src/ui/`): Notion-style collapsible sidebar (favorites /
      recent / tags), top taskbar, **⌘K command palette** (`fuzzy.ts`), toast
      notifications, keyboard shortcuts + help overlay.

## Toolchain follow-ups

- [ ] Bump vite/vitest to clear the dev-only audit advisories (vite 6 / vitest 3).
      All current advisories are in the dev server / test UI chain, not shipped code.
