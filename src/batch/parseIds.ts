/**
 * Parse a free-form list of protein IDs/names (SPEC §10 batch input). Accepts
 * newline-, comma-, semicolon-, tab-, or space-separated tokens, trims, drops
 * blanks and comment lines (#), and de-duplicates case-insensitively while keeping
 * the first-seen spelling.
 */
export function parseIdList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    // Strip an inline/whole-line comment (everything from the first '#').
    const line = rawLine.split("#")[0];
    for (const rawToken of line.split(/[\s,;]+/)) {
      const token = rawToken.trim();
      if (!token) continue;
      const key = token.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(token);
    }
  }
  return out;
}
