# CLAUDE.md

Summary for working in this repo. `SPEC.md` is the full source of truth;
`BUILD_PLAN.md` is the ordered task list and current status.

## What this is

A **client-only** web tool that compares an AlphaFold prediction against the best
experimental structure of the same protein and quantifies the agreement: RMSD,
TM-score, GDT-TS, per-residue deviation, and — the scientific payload — the
**Spearman correlation between AlphaFold pLDDT and actual per-residue error**. The
story it tells: where AlphaFold was *confidently wrong* (high pLDDT, high deviation).

Everything runs in the browser. No backend, except the optional self-hosted Foldseek
search (SPEC §11), which is isolated in `src/search/` and never a core dependency.

## Architecture (one-liners)

- `src/api/` — one typed module per data source (UniProt, PDBe, RCSB, AlphaFold).
  No raw `fetch` in components. *(Phase 1, not yet built.)*
- `src/engine/` — **pure, headless, fully unit-tested** comparison engine. No DOM,
  no Mol*, no network. Runs identically in Node, a Web Worker, or the main thread.
  **This is built and tested.**
- `src/viewer/` — Mol* React wrapper, deviation/pLDDT color modes. *(Phase 2.)*
- `src/charts/` — Observable Plot: pLDDT-vs-deviation scatter, batch distributions.
- `src/cache/` — IndexedDB (`idb`): raw files + computed results. *(Phase 4.)*
- `src/batch/` — Web Worker pool over many IDs → sortable table + CSV. *(Phase 4.)*
- `src/search/` — Foldseek remote search, best-effort, degrades gracefully. *(Phase 5.)*

## The engine (the part that exists)

Data flow: `parse → assign UniProt numbers → align → compare`.

- `types.ts` — `ResidueRecord`, `Alignment`, `ComparisonResult`, etc.
- `parse.ts` — `.pdb` → `ResidueRecord[]` (fixed-column reader). Used for AlphaFold
  models (which are `.pdb`, numbered directly by UniProt).
- `parseCif.ts` — mmCIF → `ResidueRecord[]`. **Preferred for experimental
  structures**: PDBe's `{pdb}_updated.cif` carries each atom's UniProt number in the
  SIFTS xref column (`_atom_site.pdbx_sifts_xref_db_num`), read directly so no
  numbering reconciliation is needed.
- `sifts.ts` — fallback numbering bridge for files without xref columns: apply SIFTS
  segments (`uniprotNum = authNum - authStart + unpStart`), plus `assignUniprotFromAuth`
  for AlphaFold. Tolerant extractors for the messy PDBe responses (null author
  numbers, etc.). See `docs/PHASE0.md` for why this is subtle.
- `align.ts` — inner-join AF (moving, P) and experimental (reference, Q) on
  `uniprotNum` → parallel interleaved-xyz `Float64Array`s + pLDDT.
- `compare.ts` — Kabsch superposition (SVD via `ml-matrix`, reflection-guarded),
  RMSD, TM-score, GDT-TS, per-residue deviation, Spearman(pLDDT, deviation).
- `ligands.ts` — maintained ignore-list of crystallization junk for apo/holo
  detection (SPEC §8).

Key convention: **P = AlphaFold (moving), Q = experimental (reference)**; AlphaFold
is superposed onto the experimental structure. pLDDT lives in the AlphaFold
B-factor column.

## Conventions

- TypeScript strict. No raw `fetch` outside `src/api/`. Engine stays pure.
- Coordinates are interleaved-xyz `Float64Array`s (length `3n`).
- Every metric must be produced by the native TS engine on its own; `tmalign-wasm`
  (Phase 3) is validation + an optional backend, never a dependency.

## Commands

```bash
npm install
npm run dev         # Vite dev server (UI is a placeholder until Phase 2)
npm test            # vitest — the engine test suite (48 tests)
npm run typecheck   # tsc --noEmit
npx vite-node scripts/validate-local.ts   # real-data engine validation (needs files in /tmp/val)
```

## Status

Phase 0 (CORS de-risk) and the engine core are complete and tested. See
`BUILD_PLAN.md` for what's next.
