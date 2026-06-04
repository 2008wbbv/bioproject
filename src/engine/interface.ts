/**
 * Multi-chain / complex analysis. For oligomers we (a) compare the model against
 * each experimental chain and (b) detect interface residues — residues of one chain
 * whose Cα is close to another chain. AlphaFold-DB models are monomers, so this is
 * most useful for homo-oligomers and for understanding where the assembly contacts
 * are. Pure + testable.
 */
import type { ResidueRecord } from "./types.ts";

/** Distinct chains that have at least `minResidues` UniProt-mapped CA residues. */
export function mappedChains(residues: ResidueRecord[], minResidues = 5): string[] {
  const counts = new Map<string, number>();
  for (const r of residues) {
    if (r.uniprotNum !== null && r.caXyz) counts.set(r.chain, (counts.get(r.chain) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n >= minResidues).map(([c]) => c).sort();
}

/**
 * UniProt numbers of `chain` residues whose Cα is within `cutoff` Å of a Cα in any
 * OTHER chain — i.e. the residues that form the assembly interface.
 */
export function interfaceResidues(residues: ResidueRecord[], chain: string, cutoff = 8): Set<number> {
  const c2 = cutoff * cutoff;
  const self = residues.filter((r) => r.chain === chain && r.caXyz && r.uniprotNum !== null);
  const others = residues.filter((r) => r.chain !== chain && r.caXyz);
  const out = new Set<number>();
  for (const r of self) {
    const [x, y, z] = r.caXyz!;
    for (const o of others) {
      const [ox, oy, oz] = o.caXyz!;
      const dx = x - ox;
      const dy = y - oy;
      const dz = z - oz;
      if (dx * dx + dy * dy + dz * dz <= c2) {
        out.add(r.uniprotNum!);
        break;
      }
    }
  }
  return out;
}
