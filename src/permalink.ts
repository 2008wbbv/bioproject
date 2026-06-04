/**
 * Shareable permalinks: encode a database comparison's inputs in the URL hash so a
 * colleague can reproduce it with one click. Stays client-only (no server). Uploads
 * can't be linked (the files aren't on a server). Pure encode/decode + testable.
 */
export interface CompareLink {
  query: string;
  pdbId?: string;
}

export function encodeCompareHash(link: CompareLink): string {
  const params = new URLSearchParams();
  params.set("compare", link.query);
  if (link.pdbId) params.set("pdb", link.pdbId);
  return `#${params.toString()}`;
}

export function parseCompareHash(hash: string): CompareLink | null {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!h) return null;
  const params = new URLSearchParams(h);
  const query = params.get("compare");
  if (!query) return null;
  const pdbId = params.get("pdb") ?? undefined;
  return { query, pdbId };
}

/** Absolute URL for a comparison, for the "copy link" button. */
export function compareUrl(link: CompareLink): string {
  const base = typeof location !== "undefined" ? location.href.split("#")[0] : "";
  return base + encodeCompareHash(link);
}

/** Parse a saved-entry route (#entry=<id>). */
export function parseEntryHash(hash: string): string | null {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  const id = new URLSearchParams(h).get("entry");
  return id || null;
}

export function encodeEntryHash(id: string): string {
  const p = new URLSearchParams();
  p.set("entry", id);
  return `#${p.toString()}`;
}
