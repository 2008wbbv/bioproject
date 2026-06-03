import { describe, it, expect } from "vitest";
import { encodeCompareHash, parseCompareHash } from "./permalink.ts";

describe("permalink encode/decode", () => {
  it("round-trips a query", () => {
    expect(parseCompareHash(encodeCompareHash({ query: "P04637" }))).toEqual({ query: "P04637", pdbId: undefined });
  });

  it("round-trips a query with a pdb override", () => {
    const h = encodeCompareHash({ query: "p53", pdbId: "2OCJ" });
    expect(parseCompareHash(h)).toEqual({ query: "p53", pdbId: "2OCJ" });
  });

  it("encodes names with spaces safely", () => {
    const h = encodeCompareHash({ query: "human hemoglobin" });
    expect(h).not.toContain(" ");
    expect(parseCompareHash(h)?.query).toBe("human hemoglobin");
  });

  it("returns null for an empty or unrelated hash", () => {
    expect(parseCompareHash("")).toBeNull();
    expect(parseCompareHash("#foo=bar")).toBeNull();
  });
});
