/**
 * Notion-style left sidebar: brand, a primary nav, and live sections for Favorites,
 * Recent comparisons, and Tags. Collapsible. The persistent spine of the app.
 */
import type { WorkspaceEntry } from "../workspace/types.ts";
import { allTags } from "../workspace/stats.ts";
import { Icon, type IconName } from "./Icon.tsx";

export type View = "dashboard" | "compare" | "batch" | "compare2" | "fold" | "learn" | "inspect" | "dataset";

export function Sidebar({
  view,
  entries,
  recentEntries,
  collapsed,
  width,
  onResizeStart,
  onNavigate,
  onNewComparison,
  onOpenEntry,
  onSelectTag,
  onSelectProject,
  onShowShortcuts,
}: {
  view: View;
  entries: WorkspaceEntry[];
  /** Recently *viewed* entries (most-recent first); falls back to updatedAt. */
  recentEntries: WorkspaceEntry[];
  collapsed: boolean;
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  onNavigate: (v: View) => void;
  onNewComparison: () => void;
  onOpenEntry: (e: WorkspaceEntry) => void;
  onSelectTag: (tag: string) => void;
  onSelectProject: (project: string) => void;
  onShowShortcuts: () => void;
}) {
  const projects = [...new Set(entries.map((e) => e.project).filter((p): p is string => !!p))].sort();
  const favorites = entries.filter((e) => e.favorite).slice(0, 8);
  const recent = (recentEntries.length ? recentEntries : [...entries].sort((a, b) => b.updatedAt - a.updatedAt)).slice(0, 6);
  const tags = allTags(entries).slice(0, 12);

  if (collapsed) return null;

  return (
    <aside className="sidebar" style={{ width }}>
      <div className="sidebar-resize" onMouseDown={onResizeStart} title="Drag to resize" />
      <div className="sidebar-brand"><Icon name="flask" size={18} /> OpenFoldUI</div>

      <button className="sidebar-new" onClick={onNewComparison}><Icon name="plus" size={15} /> New comparison</button>

      <nav className="sidebar-nav">
        <NavItem icon="grid" label="Dashboard" active={view === "dashboard"} onClick={() => onNavigate("dashboard")} />
        <NavItem icon="layers" label="Compare" active={view === "compare"} onClick={() => onNavigate("compare")} />
        <NavItem icon="grid" label="Inspect model" active={view === "inspect"} onClick={() => onNavigate("inspect")} />
        <NavItem icon="list" label="Dataset" active={view === "dataset"} onClick={() => onNavigate("dataset")} />
        <NavItem icon="list" label="Batch" active={view === "batch"} onClick={() => onNavigate("batch")} />
        <NavItem icon="beaker" label="Fold sequence" active={view === "fold"} onClick={() => onNavigate("fold")} />
        <NavItem icon="book" label="Learn" active={view === "learn"} onClick={() => onNavigate("learn")} />
      </nav>

      {favorites.length > 0 && (
        <Section title="Favorites">
          {favorites.map((e) => (
            <button key={e.id} className="sidebar-link" onClick={() => onOpenEntry(e)} title={e.proteinName}>
              <span className="sidebar-star"><Icon name="star" size={13} filled /></span>
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

      {projects.length > 0 && (
        <Section title="Projects">
          {projects.map((p) => (
            <button key={p} className="sidebar-link" onClick={() => onSelectProject(p)} title={p}>
              <Icon name="grid" size={13} />
              <span className="sidebar-link-text">{p}</span>
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

function NavItem({ icon, label, active, onClick }: { icon: IconName; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`sidebar-navitem ${active ? "on" : ""}`} onClick={onClick}>
      <Icon name={icon} size={16} className="sidebar-navicon" /> {label}
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
