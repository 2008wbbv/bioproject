/**
 * Upload-your-own-structures panel (OpenFoldUI). A lab provides a predicted model
 * (pLDDT in the B-factor column) and a reference/experimental structure as .pdb or
 * .cif files; the same engine computes every metric. Both are assumed to be the
 * same protein with shared residue numbering.
 */
import { useState } from "react";
import { detectFormat } from "../engine/format.ts";
import type { AlignBy, UploadedFile } from "../api/pipeline.ts";

const ACCEPT = ".pdb,.ent,.cif,.mmcif,.bcif";

async function readFile(file: File): Promise<UploadedFile> {
  const text = await file.text();
  return { name: file.name, text, format: detectFormat(file.name, text) };
}

function FileDrop({
  label,
  hint,
  file,
  onFile,
}: {
  label: string;
  hint: string;
  file: UploadedFile | null;
  onFile: (f: UploadedFile | null) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <label
      className={`filedrop ${over ? "over" : ""} ${file ? "has-file" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f) void readFile(f).then(onFile);
      }}
    >
      <input
        type="file"
        accept={ACCEPT}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void readFile(f).then(onFile);
        }}
      />
      <strong>{label}</strong>
      {file ? (
        <span className="filename">
          {file.name} <span className="muted">({file.format.toUpperCase()})</span>
        </span>
      ) : (
        <span className="muted small">{hint}</span>
      )}
    </label>
  );
}

export function UploadPanel({
  onCompare,
  busy,
}: {
  onCompare: (model: UploadedFile, ref: UploadedFile, uniprot: string | undefined, alignBy: AlignBy) => void;
  busy: boolean;
}) {
  const [model, setModel] = useState<UploadedFile | null>(null);
  const [ref, setRef] = useState<UploadedFile | null>(null);
  const [uniprot, setUniprot] = useState("");
  const [alignBy, setAlignBy] = useState<AlignBy>("auto");

  return (
    <div className="upload-panel">
      <div className="upload-drops">
        <FileDrop
          label="Predicted model"
          hint="Drop or choose a .pdb/.cif — pLDDT in the B-factor column (AlphaFold/ColabFold)"
          file={model}
          onFile={setModel}
        />
        <FileDrop
          label="Reference structure"
          hint="Drop or choose the experimental .pdb/.cif to compare against"
          file={ref}
          onFile={setRef}
        />
      </div>
      <div className="upload-controls">
        <input
          type="text"
          placeholder="UniProt accession (optional, for labelling)"
          value={uniprot}
          onChange={(e) => setUniprot(e.target.value)}
        />
        <label className="align-by">
          Match residues by
          <select value={alignBy} onChange={(e) => setAlignBy(e.target.value as AlignBy)}>
            <option value="auto">Auto (shared numbering)</option>
            <option value="author">Author numbering</option>
            <option value="sequence">Sequence alignment</option>
          </select>
        </label>
        <button
          className="primary"
          disabled={!model || !ref || busy}
          onClick={() => model && ref && onCompare(model, ref, uniprot.trim() || undefined, alignBy)}
        >
          {busy ? "Comparing…" : "Compare uploaded files"}
        </button>
      </div>
      <p className="muted small">
        Files stay in your browser — nothing is uploaded to a server. Use <strong>Sequence alignment</strong> if
        the two files don't share residue numbering.
      </p>
    </div>
  );
}
