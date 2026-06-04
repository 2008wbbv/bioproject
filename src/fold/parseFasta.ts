/**
 * Parse FASTA or raw protein sequences into named jobs for the folding queue.
 * Accepts multi-record FASTA (>header lines) or a single bare sequence. Pure +
 * testable.
 */
export interface SeqRecord {
  name: string;
  seq: string;
}

const AA = /[ACDEFGHIKLMNPQRSTVWYBXZUO]/i;

/** Keep only valid amino-acid letters, uppercase. */
function cleanSeq(raw: string): string {
  return raw
    .split("")
    .filter((c) => AA.test(c))
    .join("")
    .toUpperCase();
}

export function parseFasta(text: string): SeqRecord[] {
  const records: SeqRecord[] = [];
  const lines = text.split(/\r?\n/);
  let name: string | null = null;
  let buf: string[] = [];
  let untitled = 0;

  const flush = () => {
    const seq = cleanSeq(buf.join(""));
    if (seq.length > 0) records.push({ name: name ?? `sequence ${++untitled}`, seq });
    buf = [];
  };

  for (const line of lines) {
    if (line.startsWith(">")) {
      flush();
      name = line.slice(1).trim() || null;
    } else {
      buf.push(line);
    }
  }
  flush();
  return records;
}

/** Sequences over this length are rejected by the public ESMFold endpoint. */
export const MAX_FOLD_LENGTH = 400;
