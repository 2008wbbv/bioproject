/** Clean SVG sort indicator (replaces the ▲/▼ glyphs). Shows nothing when inactive. */
import { Icon } from "./Icon.tsx";

export function SortCaret({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return null;
  return <Icon name="chevron" size={12} className={asc ? "caret-up" : "caret-down"} />;
}
