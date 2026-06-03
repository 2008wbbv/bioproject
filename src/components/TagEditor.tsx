/**
 * Inline tag editor for a comparison: chips with remove, plus an input to add.
 * Tags organize comparisons into studies and drive the dashboard tag filter.
 */
import { useState } from "react";

export function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");

  function add() {
    const t = draft.trim();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setDraft("");
  }

  return (
    <div className="tag-editor">
      <span className="tag-label muted">Tags:</span>
      {tags.map((t) => (
        <span key={t} className="tag">
          {t}
          <button className="tag-x" title="Remove tag" onClick={() => onChange(tags.filter((x) => x !== t))}>
            ×
          </button>
        </span>
      ))}
      <input
        className="tag-input"
        value={draft}
        placeholder="add tag…"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
    </div>
  );
}
