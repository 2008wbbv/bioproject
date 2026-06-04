import { describe, it, expect } from "vitest";
import { parseFasta } from "./parseFasta.ts";

describe("parseFasta", () => {
  it("parses multi-record FASTA", () => {
    const recs = parseFasta(">a\nMKTA\nYIAK\n>b\nGGGG");
    expect(recs).toEqual([
      { name: "a", seq: "MKTAYIAK" },
      { name: "b", seq: "GGGG" },
    ]);
  });

  it("accepts a bare sequence with a synthesized name", () => {
    expect(parseFasta("MKTAYIAK")).toEqual([{ name: "sequence 1", seq: "MKTAYIAK" }]);
  });

  it("strips invalid characters, whitespace, and lowercases to upper", () => {
    expect(parseFasta(">x\nmkt a-y 123 iak")[0].seq).toBe("MKTAYIAK");
  });

  it("drops empty records", () => {
    expect(parseFasta(">empty\n\n>b\nGGGG")).toEqual([{ name: "b", seq: "GGGG" }]);
  });
});
