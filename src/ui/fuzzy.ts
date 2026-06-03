/**
 * Tiny fuzzy subsequence matcher for the command palette. Returns a score (higher =
 * better) or null when `query` is not a subsequence of `text`. Bonuses for matches
 * at word starts and for consecutive runs, so "p53" ranks "p53" above "phosph…5…3".
 * Pure + testable.
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.trim().toLowerCase();
  const t = text.toLowerCase();
  if (q === "") return 0;

  let score = 0;
  let ti = 0;
  let prevMatch = -2;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    const found = t.indexOf(c, ti);
    if (found === -1) return null;
    score += 1;
    if (found === prevMatch + 1) score += 3; // consecutive
    if (found === 0 || /[\s\-_:./]/.test(t[found - 1] ?? "")) score += 2; // word start
    prevMatch = found;
    ti = found + 1;
  }
  // Prefer shorter targets (tighter match).
  score += Math.max(0, 10 - (t.length - q.length) / 8);
  return score;
}

export interface Ranked<T> {
  item: T;
  score: number;
}

/** Rank items by the best fuzzy score over their searchable keys. */
export function fuzzyRank<T>(query: string, items: T[], keyOf: (item: T) => string, limit = 20): T[] {
  if (query.trim() === "") return items.slice(0, limit);
  const ranked: Ranked<T>[] = [];
  for (const item of items) {
    const s = fuzzyScore(query, keyOf(item));
    if (s !== null) ranked.push({ item, score: s });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit).map((r) => r.item);
}
