/**
 * Pin residues with a note (annotations). They show as markers on the deviation
 * track and travel with the comparison (saved + in backups).
 */
import { useState } from "react";
import { Icon } from "../ui/Icon.tsx";

export interface Annotation {
  residue: number;
  text: string;
}

export function AnnotationEditor({ annotations, onChange }: { annotations: Annotation[]; onChange: (a: Annotation[]) => void }) {
  const [residue, setResidue] = useState("");
  const [text, setText] = useState("");

  function add() {
    const r = Number.parseInt(residue, 10);
    if (!Number.isFinite(r) || !text.trim()) return;
    onChange([...annotations.filter((a) => a.residue !== r), { residue: r, text: text.trim() }].sort((a, b) => a.residue - b.residue));
    setResidue("");
    setText("");
  }

  return (
    <div className="annotations">
      <div className="notes-head"><label>Pinned residues</label></div>
      {annotations.length > 0 && (
        <ul className="annotation-list">
          {annotations.map((a) => (
            <li key={a.residue}>
              <span className="annotation-res">{a.residue}</span>
              <span className="annotation-text">{a.text}</span>
              <button className="icon-btn" title="Remove" onClick={() => onChange(annotations.filter((x) => x.residue !== a.residue))}>
                <Icon name="close" size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="annotation-add">
        <input className="annotation-res-input" type="number" placeholder="residue" value={residue} onChange={(e) => setResidue(e.target.value)} />
        <input className="annotation-text-input" placeholder="note…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <button onClick={add}>Pin</button>
      </div>
    </div>
  );
}
