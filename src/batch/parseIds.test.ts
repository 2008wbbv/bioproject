import { describe, it, expect } from "vitest";
import { parseIdList } from "./parseIds.ts";

describe("parseIdList", () => {
  it("splits on newlines, commas, semicolons, tabs and spaces", () => {
    expect(parseIdList("P04637, P24941\nP00698;Q29537\tBRCA1 p53")).toEqual([
      "P04637",
      "P24941",
      "P00698",
      "Q29537",
      "BRCA1",
      "p53",
    ]);
  });

  it("trims, drops blanks and # comment tokens", () => {
    expect(parseIdList("  P04637  \n\n  # a comment\n  P24941 ")).toEqual(["P04637", "P24941"]);
  });

  it("de-duplicates case-insensitively, keeping first spelling", () => {
    expect(parseIdList("P04637\np04637\nP04637")).toEqual(["P04637"]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseIdList("   \n  ")).toEqual([]);
  });
});
