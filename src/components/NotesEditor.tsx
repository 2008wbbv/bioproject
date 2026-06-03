/**
 * Per-comparison notes (the workspace "notes"). Debounced autosave so typing isn't
 * a write per keystroke; also flushes on blur.
 */
import { useEffect, useRef, useState } from "react";

export function NotesEditor({ value, onSave }: { value: string; onSave: (notes: string) => void }) {
  const [text, setText] = useState(value);
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-sync when switching to a different comparison.
  useEffect(() => {
    setText(value);
    setSaved(true);
  }, [value]);

  function change(next: string) {
    setText(next);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onSave(next);
      setSaved(true);
    }, 600);
  }

  function flush() {
    if (timer.current) clearTimeout(timer.current);
    if (!saved) {
      onSave(text);
      setSaved(true);
    }
  }

  return (
    <div className="notes">
      <div className="notes-head">
        <label htmlFor="notes">Notes</label>
        <span className="muted">{saved ? "saved" : "saving…"}</span>
      </div>
      <textarea
        id="notes"
        value={text}
        placeholder="Observations, follow-ups, why this structure… (saved automatically)"
        onChange={(e) => change(e.target.value)}
        onBlur={flush}
        rows={4}
      />
    </div>
  );
}
