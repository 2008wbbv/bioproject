/**
 * Parse a delimited (CSV/TSV) file into columns so the user can pick which one holds
 * the protein IDs (SPEC §10 batch input). Pure + testable.
 */
export interface DelimitedTable {
  delimiter: string;
  headers: string[];
  rows: string[][];
  /** True if the first row looks like a header (no obvious accessions/IDs). */
  hasHeader: boolean;
}

function splitLine(line: string, delim: string): string[] {
  // Minimal CSV: handle simple double-quote quoting.
  if (delim === ",") {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ",") {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  }
  return line.split(delim).map((s) => s.trim());
}

const ACCESSION = /^[OPQ][0-9][A-Z0-9]{3}[0-9]$|^[A-NR-Z][0-9][A-Z0-9]{3}[0-9]$/i;

export function parseDelimited(text: string): DelimitedTable {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { delimiter: ",", headers: [], rows: [], hasHeader: false };

  // Pick the delimiter that yields the most columns on the first line.
  const candidates = ["\t", ",", ";"];
  let delimiter = ",";
  let best = 1;
  for (const d of candidates) {
    const n = splitLine(lines[0], d).length;
    if (n > best) {
      best = n;
      delimiter = d;
    }
  }

  const rows = lines.map((l) => splitLine(l, delimiter));
  const first = rows[0];
  // Header if the first row has no accession-looking / numeric tokens.
  const hasHeader = first.every((c) => !ACCESSION.test(c) && Number.isNaN(Number(c)) && c.length > 0);
  const headers = hasHeader ? first : first.map((_, i) => `Column ${i + 1}`);
  const body = hasHeader ? rows.slice(1) : rows;
  return { delimiter, headers, rows: body, hasHeader };
}

/** Extract one column's non-empty values. */
export function extractColumn(table: DelimitedTable, columnIndex: number): string[] {
  return table.rows.map((r) => r[columnIndex] ?? "").map((s) => s.trim()).filter(Boolean);
}

/** Guess the column most likely to hold IDs (most accession-looking values). */
export function guessIdColumn(table: DelimitedTable): number {
  let bestCol = 0;
  let bestScore = -1;
  const ncol = table.headers.length;
  for (let c = 0; c < ncol; c++) {
    let score = 0;
    for (const r of table.rows) if (r[c] && ACCESSION.test(r[c].trim())) score++;
    if (score > bestScore) {
      bestScore = score;
      bestCol = c;
    }
  }
  return bestCol;
}
