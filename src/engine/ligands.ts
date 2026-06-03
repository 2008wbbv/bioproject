/**
 * Maintained ignore-list of heteroatom groups that are crystallization/solvent
 * junk rather than biologically meaningful ligands. SPEC.md §8 (apo/holo).
 *
 * Anything NOT in this set that appears as a HETATM group is flagged as a likely
 * real ligand, which drives the apo/holo warning and (later) the batch column.
 * Keep this list conservative: it is better to over-flag a ligand than to hide a
 * real one. Add entries as false positives show up in practice.
 */

/** Waters — always excluded, also used to skip solvent during parsing. */
export const WATER_NAMES: ReadonlySet<string> = new Set(["HOH", "WAT", "DOD", "H2O"]);

/** Common cryo/crystallization additives and buffer components. */
const CRYO_ADDITIVES = [
  "GOL", // glycerol
  "EDO", // ethylene glycol
  "PEG", "PG4", "PGE", "1PE", "2PE", "P6G", "12P", "15P", // PEGs
  "MPD", // 2-methyl-2,4-pentanediol
  "DMS", // dimethyl sulfoxide
  "TRS", // tris buffer
  "EPE", // HEPES
  "MES", // MES buffer
  "BTB", // bis-tris
  "ACT", "ACY", // acetate / acetic acid
  "FMT", // formate
  "IMD", // imidazole
  "BME", // beta-mercaptoethanol
  "DTT", // dithiothreitol
  "MLI", // malonate
  "TLA", "TAR", // tartrate
  "CIT", "FLC", // citrate
  "SCN", // thiocyanate
];

/** Common ions and small inorganic species. */
const IONS_AND_SMALL = [
  "SO4", "PO4", "PI", "2HP", // sulfate / phosphate
  "NO3", "AZI", "CO3", "BO3",
  "CL", "BR", "IOD", "FLO", "F",
  "NA", "K", "MG", "CA", "ZN", "MN", "FE", "FE2", "NI", "CO", "CU", "CU1",
  "CD", "HG", "CS", "RB", "SR", "BA", "LI", "AL",
  "OXY", "PER", "OH", "O",
];

/** The full ignore-list: union of waters, additives, and ions. */
export const HET_IGNORE_LIST: ReadonlySet<string> = new Set<string>([
  ...WATER_NAMES,
  ...CRYO_ADDITIVES,
  ...IONS_AND_SMALL,
]);

/** True if a heteroatom component is crystallization junk (not a real ligand). */
export function isIgnoredHet(resName: string): boolean {
  return HET_IGNORE_LIST.has(resName.trim().toUpperCase());
}
