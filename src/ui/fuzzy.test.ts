import { describe, it, expect } from "vitest";
import { fuzzyScore, fuzzyRank } from "./fuzzy.ts";

describe("fuzzyScore", () => {
  it("returns null when not a subsequence", () => {
    expect(fuzzyScore("xyz", "p53")).toBeNull();
  });

  it("scores an exact/prefix match higher than a scattered one", () => {
    const exact = fuzzyScore("p53", "p53")!;
    const scattered = fuzzyScore("p53", "phosphatase 5 subunit 3")!;
    expect(exact).toBeGreaterThan(scattered);
  });

  it("rewards word-start matches", () => {
    const wordStart = fuzzyScore("cdk", "cyclin dependent kinase")!;
    expect(wordStart).not.toBeNull();
    expect(wordStart).toBeGreaterThan(0);
  });

  it("empty query scores 0 (matches everything)", () => {
    expect(fuzzyScore("", "anything")).toBe(0);
  });
});

describe("fuzzyRank", () => {
  const items = ["p53", "CDK2", "hemoglobin", "lysozyme"];
  it("ranks the best match first", () => {
    expect(fuzzyRank("cdk", items, (s) => s)[0]).toBe("CDK2");
  });
  it("drops non-matches", () => {
    expect(fuzzyRank("zzzz", items, (s) => s)).toEqual([]);
  });
  it("returns all (capped) for an empty query", () => {
    expect(fuzzyRank("", items, (s) => s)).toEqual(items);
  });
});
