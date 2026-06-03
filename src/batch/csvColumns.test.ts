import { describe, it, expect } from "vitest";
import { parseDelimited, extractColumn, guessIdColumn } from "./csvColumns.ts";

describe("parseDelimited", () => {
  it("detects a header and comma delimiter", () => {
    const t = parseDelimited("name,uniprot,note\np53,P04637,tumor\nCDK2,P24941,kinase");
    expect(t.delimiter).toBe(",");
    expect(t.hasHeader).toBe(true);
    expect(t.headers).toEqual(["name", "uniprot", "note"]);
    expect(t.rows).toHaveLength(2);
  });

  it("detects tab delimiter and synthesises headers when headerless", () => {
    const t = parseDelimited("P04637\tx\nP24941\ty");
    expect(t.delimiter).toBe("\t");
    expect(t.hasHeader).toBe(false);
    expect(t.headers).toEqual(["Column 1", "Column 2"]);
    expect(t.rows).toHaveLength(2);
  });

  it("handles quoted CSV fields with commas", () => {
    const t = parseDelimited('name,uniprot\n"p53, cellular",P04637');
    expect(t.rows[0]).toEqual(["p53, cellular", "P04637"]);
  });
});

describe("extractColumn / guessIdColumn", () => {
  const table = parseDelimited("name,uniprot\np53,P04637\nCDK2,P24941");
  it("extracts a column's values", () => {
    expect(extractColumn(table, 1)).toEqual(["P04637", "P24941"]);
  });
  it("guesses the column with the most accession-like values", () => {
    expect(guessIdColumn(table)).toBe(1);
  });
});
