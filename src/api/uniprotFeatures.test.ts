import { describe, it, expect } from "vitest";
import { parseFeatures } from "./uniprotFeatures.ts";

describe("parseFeatures", () => {
  it("categorizes and extracts start/end/description", () => {
    const json = {
      features: [
        { type: "Domain", description: "DNA-binding", location: { start: { value: 94 }, end: { value: 312 } } },
        { type: "Active site", description: "Nucleophile", location: { start: { value: 200 }, end: { value: 200 } } },
        { type: "Modified residue", description: "Phospho", location: { start: { value: 15 }, end: { value: 15 } } },
        { type: "Mutagenesis", description: "R→A", location: { start: { value: 175 }, end: { value: 175 } } },
      ],
    };
    const feats = parseFeatures(json);
    expect(feats).toHaveLength(4);
    expect(feats[0]).toMatchObject({ category: "domain", start: 94, end: 312 });
    expect(feats[1]).toMatchObject({ category: "site", start: 200, end: 200 });
    expect(feats[2].category).toBe("modification");
    expect(feats[3].category).toBe("variant");
  });

  it("defaults end to start for point features", () => {
    const feats = parseFeatures({ features: [{ type: "Site", location: { start: { value: 50 } } }] });
    expect(feats[0]).toMatchObject({ start: 50, end: 50 });
  });

  it("drops uncategorized or malformed features", () => {
    const feats = parseFeatures({
      features: [
        { type: "Chain", location: { start: { value: 1 }, end: { value: 100 } } }, // not in map
        { type: "Domain", location: {} }, // no coords
      ],
    });
    expect(feats).toEqual([]);
  });
});
