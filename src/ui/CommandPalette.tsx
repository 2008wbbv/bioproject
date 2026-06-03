/**
 * ⌘K / Ctrl-K command palette — jump to any saved comparison or run an action.
 * The hallmark "real webapp" affordance: keyboard-first navigation over the whole
 * workspace. Comparisons and commands are merged into one fuzzy-ranked list.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceEntry } from "../workspace/types.ts";
import { fuzzyRank } from "./fuzzy.ts";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

type Item =
  | { kind: "command"; command: Command }
  | { kind: "entry"; entry: WorkspaceEntry };

function itemKey(it: Item): string {
  return it.kind === "command"
    ? `${it.command.label} ${it.command.hint ?? ""}`
    : `${it.entry.proteinName} ${it.entry.uniprot} ${it.entry.pdbId} ${(it.entry.tags ?? []).join(" ")}`;
}

export function CommandPalette({
  open,
  onClose,
  commands,
  entries,
  onOpenEntry,
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
  entries: WorkspaceEntry[];
  onOpenEntry: (e: WorkspaceEntry) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items: Item[] = useMemo(() => {
    const all: Item[] = [
      ...commands.map((command) => ({ kind: "command" as const, command })),
      ...entries.map((entry) => ({ kind: "entry" as const, entry })),
    ];
    return fuzzyRank(query, all, itemKey, 30);
  }, [query, commands, entries]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // focus after mount
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  if (!open) return null;

  function choose(it: Item) {
    onClose();
    if (it.kind === "command") it.command.run();
    else onOpenEntry(it.entry);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[active]) choose(items[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div className="cmdk-overlay" onClick={onClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder="Search comparisons and actions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="cmdk-list">
          {items.length === 0 && <div className="cmdk-empty muted">No matches</div>}
          {items.map((it, i) => (
            <button
              key={it.kind === "command" ? `c:${it.command.id}` : `e:${it.entry.id}`}
              className={`cmdk-item ${i === active ? "active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(it)}
            >
              {it.kind === "command" ? (
                <>
                  <span className="cmdk-icon">⚡</span>
                  <span className="cmdk-label">{it.command.label}</span>
                  {it.command.hint && <span className="cmdk-hint muted">{it.command.hint}</span>}
                </>
              ) : (
                <>
                  <span className="cmdk-icon">{it.entry.favorite ? "★" : "🧬"}</span>
                  <span className="cmdk-label">{it.entry.proteinName}</span>
                  <span className="cmdk-hint muted">
                    {it.entry.uniprot} · {it.entry.pdbId} · TM {it.entry.tmScore.toFixed(2)}
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
        <div className="cmdk-footer muted">↑↓ navigate · ↵ open · esc close</div>
      </div>
    </div>
  );
}
