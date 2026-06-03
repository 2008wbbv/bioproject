/**
 * Notion-style left sidebar: brand, a primary nav, and live sections for Favorites,
 * Recent comparisons, and Tags. Collapsible. The persistent spine of the app.
 */
import type { WorkspaceEntry } from "../workspace/types.ts";
import { allTags } from "../workspace/stats.ts";

export type View = "dashboard" | "compare" | "batch" | "compare2";

export function Sidebar({
  view,
  entries,
  collapsed,
  onNavigate,
  onNewComparison,
  onOpenEntry,
  onSelectTag,
  onShowShortcuts,
}: {
  view: View;
  entries: WorkspaceEntry[];
  collapsed: boolean;
  onNavigate: (v: View) => void;
  onNewComparison: () => void;
  onOpenEntry: (e: WorkspaceEntry) => void;
  onSelectTag: (tag: string) => void;
  onShowShortcuts: () => void;
}) {
  const favorites = entries.filter((e) => e.favorite).slice(0, 8);
  const recent = [...entries].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
  const tags = allTags(entries).slice(0, 12);

  if (collapsed) return null;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">🧬 OpenFoldUI</div>

      <button className="sidebar-new" onClick={onNewComparison}>＋ New comparison</button>

      <nav className="sidebar-nav">
        <NavItem icon="▦" label="Dashboard" active={view === "dashboard"} onClick={() => onNavigate("dashboard")} />
        <NavItem icon="⊕" label="Compare" active={view === "compare"} onClick={() => onNavigate("compare")} />
        <NavItem icon="≣" label="Batch" active={view === "batch"} onClick={() => onNavigate("batch")} />
      </nav>

      {favorites.length > 0 && (
        <Section title="Favorites">
          {favorites.map((e) => (
            <button key={e.id} className="sidebar-link" onClick={() => onOpenEntry(e)} title={e.proteinName}>
              <span className="sidebar-star">★</span>
              <span className="sidebar-link-text">{e.proteinName}</span>
            </button>
          ))}
        </Section>
      )}

      {recent.length > 0 && (
        <Section title="Recent">
          {recent.map((e) => (
            <button key={e.id} className="sidebar-link" onClick={() => onOpenEntry(e)} title={e.proteinName}>
              <span className="sidebar-link-text">{e.proteinName}</span>
              <span className="muted sidebar-link-meta">{e.tmScore.toFixed(2)}</span>
            </button>
          ))}
        </Section>
      )}

      {tags.length > 0 && (
        <Section title="Tags">
          <div className="sidebar-tags">
            {tags.map((t) => (
              <button key={t.tag} className="chip" onClick={() => onSelectTag(t.tag)}>
                {t.tag} <span className="muted">{t.count}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      <div className="sidebar-footer">
        <span className="muted">{entries.length} saved · local only</span>
        <button className="link" onClick={onShowShortcuts}>shortcuts (?)</button>
      </div>
    </aside>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`sidebar-navitem ${active ? "on" : ""}`} onClick={onClick}>
      <span className="sidebar-navicon">{icon}</span> {label}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sidebar-section">
      <div className="sidebar-section-title">{title}</div>
      {children}
    </div>
  );
}
