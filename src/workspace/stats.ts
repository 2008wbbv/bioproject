/**
 * Aggregate statistics across all saved comparisons, for the dashboard overview.
 * Pure + testable.
 */
import type { WorkspaceEntry } from "./types.ts";

export interface WorkspaceStats {
  count: number;
  favorites: number;
  uploads: number;
  meanTm: number;
  medianTm: number;
  meanRmsd: number;
  meanSpearman: number; // over entries with a defined ρ
  /** Fraction with TM-score ≥ 0.5 (same-fold threshold). */
  fractionGoodFold: number;
  best: WorkspaceEntry | null; // highest TM-score
  worst: WorkspaceEntry | null; // lowest TM-score
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function workspaceStats(entries: WorkspaceEntry[]): WorkspaceStats {
  const tms = entries.map((e) => e.tmScore);
  const rmsds = entries.map((e) => e.rmsd);
  const rhos = entries.map((e) => e.plddtErrorSpearman).filter((v) => Number.isFinite(v));

  let best: WorkspaceEntry | null = null;
  let worst: WorkspaceEntry | null = null;
  for (const e of entries) {
    if (!best || e.tmScore > best.tmScore) best = e;
    if (!worst || e.tmScore < worst.tmScore) worst = e;
  }

  return {
    count: entries.length,
    favorites: entries.filter((e) => e.favorite).length,
    uploads: entries.filter((e) => e.source === "upload").length,
    meanTm: mean(tms),
    medianTm: median(tms),
    meanRmsd: mean(rmsds),
    meanSpearman: mean(rhos),
    fractionGoodFold: entries.length ? entries.filter((e) => e.tmScore >= 0.5).length / entries.length : 0,
    best,
    worst,
  };
}

/** All distinct tags used across the workspace, sorted, with counts. */
export function allTags(entries: WorkspaceEntry[]): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const e of entries) for (const t of e.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag));
}
