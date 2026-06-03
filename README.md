# AlphaFold vs Experimental

A **client-only** web tool that compares an AlphaFold prediction against the best
experimental structure of the same protein and quantifies the agreement: RMSD,
TM-score, GDT-TS, per-residue deviation, and — the scientific payload — the
**Spearman correlation between AlphaFold pLDDT and actual per-residue error**.

The story it tells: where AlphaFold was *confidently wrong* — high pLDDT (the model
was sure) but high deviation (it was off anyway).

> **Status:** the engine, the API layer + pipeline, and the single-protein UI
> (metrics, Observable Plot charts, lazy-loaded Mol* 3D overlay) are built and
> tested. Batch mode and caching are next — see [`BUILD_PLAN.md`](BUILD_PLAN.md).
> [`SPEC.md`](SPEC.md) is the full source of truth; [`CLAUDE.md`](CLAUDE.md) is the summary.

## Quick start

```bash
npm install
```

### Easiest way to run the app

```bash
npm run dev        # http://localhost:5173
```

Type a protein name or UniProt accession (e.g. `p53` or `P04637`), or click an
example. You get the metrics, the pLDDT-vs-deviation scatter (with a "confidently
wrong" quadrant), a per-residue deviation track, and a 3D overlay you can toggle
between deviation and pLDDT coloring. Everything runs in the browser.

### See the engine work headlessly (no browser)

This fetches AlphaFold + the experimental structure for a UniProt accession and runs
the full pipeline (parse → map UniProt numbers → align → compare), printing every
metric. No browser, no setup beyond `npm install`.

```bash
npx vite-node scripts/validate.ts                # default: p53 (P04637) vs 2OCJ
npx vite-node scripts/validate.ts P24941 6q4g    # any UNIPROT [PDB_ID]
```

Example output (p53 DNA-binding domain):

```
Protein:              P04637 vs 2OCJ
Matched CA pairs:     194
RMSD:                 0.506 A
TM-score:             0.9909
GDT-TS:               0.9884
pLDDT-error Spearman: -0.5622   (confident residues deviate less)
```

### Run the test suite (no network)

48 unit tests covering every metric with known-answer cases:

```bash
npm test
```

## All commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Vite dev server — the full app |
| `npx vite-node scripts/validate.ts [UNIPROT] [PDB]` | Headless real-data engine validation |
| `npm test` | Vitest engine + api + viewer-prep suite (71 tests, network-free) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Production build to `dist/` (Mol* is a lazy chunk) |

## How it works

```
UniProt ID
  → AlphaFold model (.pdb, numbered by UniProt)        parse.ts
  → experimental structure (PDBe updated .cif,         parseCif.ts
    every atom carries its UniProt number via SIFTS)
  → inner-join both on UniProt residue number          align.ts
  → Kabsch superposition + RMSD / TM / GDT / Spearman  compare.ts
```

Everything runs in the browser. The only optional server-side piece is Foldseek
search (SPEC §11), isolated in `src/search/` and never a core dependency.

See [`docs/PHASE0.md`](docs/PHASE0.md) for the CORS/endpoint verification and the
real-data validation results.
