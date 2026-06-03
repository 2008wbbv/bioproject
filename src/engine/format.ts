/**
 * Detect a structure file's format and parse it accordingly. Lets the same engine
 * handle fetched files and user uploads (.pdb/.ent or .cif/.mmcif), by extension
 * with a content-sniffing fallback.
 */
import { parsePdb } from "./parse.ts";
import { parseCif } from "./parseCif.ts";
import type { ParsedStructure } from "./types.ts";

export type StructFormat = "pdb" | "cif";

export function detectFormat(filename: string, text: string): StructFormat {
  const name = filename.toLowerCase();
  if (name.endsWith(".cif") || name.endsWith(".mmcif") || name.endsWith(".bcif")) return "cif";
  if (name.endsWith(".pdb") || name.endsWith(".ent")) return "pdb";
  // Sniff: mmCIF has a data_ block and _atom_site loop; PDB has ATOM/HETATM records.
  const head = text.slice(0, 4000);
  if (/^\s*data_/m.test(head) || head.includes("_atom_site.")) return "cif";
  return "pdb";
}

export function parseByFormat(
  text: string,
  format: StructFormat,
  opts: { uniprotAcc?: string } = {},
): ParsedStructure {
  return format === "cif" ? parseCif(text, opts) : parsePdb(text);
}
