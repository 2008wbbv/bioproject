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

## Phase 3 — Validation backend (`src/engine/backends/`)

- [ ] `tmalign-wasm` backend; parse TM-score + RMSD from text output.
- [ ] Side-by-side native-vs-TM-align validation panel; assert agreement in tests.
- [ ] Add iterative TM refinement only if validation shows the plain value drifts.

## Phase 4 — Cache + batch (`src/cache/`, `src/batch/`)

- [ ] IndexedDB via `idb`: raw files + results keyed `{uniprot}:{pdbId}:{backend}`.
- [ ] Web Worker pool; live progress; sortable/filterable table; CSV export.
- [ ] Charts: Observable Plot scatter (single) + distributions (batch).

## Phase 5 — Foldseek search (`src/search/`)

- [ ] De-risk spike against `search.foldseek.com`; degrade gracefully.
- [ ] Hit list → open any hit as a new comparison.
- [ ] Document the self-hosted MMseqs2-App upgrade path.

## Toolchain follow-ups

- [ ] Bump vite/vitest to clear the dev-only audit advisories (vite 6 / vitest 3).
      All current advisories are in the dev server / test UI chain, not shipped code.
