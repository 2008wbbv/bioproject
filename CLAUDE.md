# CLAUDE.md

Summary for working in this repo. `SPEC.md` is the full source of truth;
`BUILD_PLAN.md` is the ordered task list and current status.

The product is named **OpenFoldUI**.

## What this is

A **client-only** web tool (**OpenFoldUI**) that compares a predicted structure —
AlphaFold-DB *or your own uploaded model* — against the best experimental structure
of the same protein and quantifies the agreement: RMSD, TM-score, GDT-TS,
per-residue deviation, and — the scientific payload — the **Spearman correlation
between pLDDT and actual per-residue error**. The story it tells: where the model was
*confidently wrong* (high pLDDT, high deviation).

Lab-facing surface: upload your own files, a persistent workspace (history,
favorites, notes), batch mode, Foldseek search, an in-app data sheet, Excel/CSV
export, workspace JSON backup/import, superposed-PDB download, and per-comparison
**replication logs** (provenance + methods).

Everything runs in the browser. No backend, except the optional self-hosted Foldseek
search (SPEC §11), which is isolated in `src/search/` and never a core dependency.

## Architecture (one-liners)

- `src/api/` — one typed module per data source (UniProt, PDBe, RCSB, AlphaFold) +
  `pipeline.ts` (id → `ComparisonResult`). No raw `fetch` in components. **Built.**
- `src/engine/` — **pure, headless, fully unit-tested** comparison engine. No DOM,
  no Mol*, no network. Runs identically in Node, a Web Worker, or the main thread.
  **This is built and tested.**
- `src/viewer/` — Mol* React wrapper (lazy-loaded, error-boundaried),
  deviation/pLDDT color modes via B-factor encoding. **Built.**
- `src/charts/` — Observable Plot: pLDDT-vs-deviation scatter, per-residue deviation
  track. **Built** (batch distributions come with Phase 4).
- `src/workspace/` — IndexedDB (`idb`) persistence: saved comparisons + favorites +
  notes, dashboard, and dependency-free .xlsx/.csv export. **Built.** (Covers SPEC §9.)
- `src/batch/` — bounded-concurrency pool over many IDs → live table + distributions;
  results land in the workspace. **Built.**
- `src/engine/backends/` — `tmalign-wasm` validation backend (lazy WASM). **Built.**
- `src/search/` — Foldseek remote search, best-effort, degrades gracefully. **Built.**
- `src/ui/` — app shell: Notion-style `Sidebar`, `TopBar`, ⌘K `CommandPalette`
  (+ `fuzzy.ts`), `toast` notifications, `ShortcutsHelp`. **Built.**

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
- `pdbTransform.ts` — pure PDB coordinate/B-factor rewriting for the viewer
  (pre-superpose AF; encode deviation or 100−pLDDT into the B-factor column so Mol*'s
  built-in B-factor color theme renders the heatmap; blue=good, red=bad).

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
npm run dev         # Vite dev server — full app: enter a protein, see metrics/charts/3D
npm test            # vitest — engine + api + workspace + batch + search (109 tests)
npm run typecheck   # tsc --noEmit
npm run build       # tsc -b && vite build (Mol* is a lazy chunk)
npx vite-node scripts/validate.ts [UNIPROT] [PDB]   # real-data engine validation
```

## Status

All spec phases are built and tested (Phase 0–5): engine, API + pipeline, Mol*
viewer + charts, workspace (history/favorites/notes/export), batch mode, Foldseek
search, and the tmalign-wasm validation backend (verified to agree with the native
engine to ~0.001 TM-score on p53). Caveat: the Mol* 3D render and the in-browser
WASM execution path haven't been eyeballed in a real browser (headless build env);
both are isolated/error-guarded. See `BUILD_PLAN.md`.
