import { describe, it, expect } from "vitest";
import { rankStructures, type RankedStructure } from "./pdbe.ts";

function hit(p: Partial<RankedStructure>): RankedStructure {
  return {
    pdb_id: "xxxx",
    chain_id: "A",
    unp_start: 1,
    unp_end: 100,
    start: 1,
    end: 100,
    coverage: 0.5,
    resolution: 2.0,
    experimental_method: "X-ray diffraction",
    ...p,
  };
}

describe("rankStructures", () => {
  it("prefers X-ray over electron microscopy", () => {
    const ranked = rankStructures([
      hit({ pdb_id: "em", experimental_method: "Electron Microscopy", coverage: 0.9, resolution: 3.0 }),
      hit({ pdb_id: "xray", experimental_method: "X-ray diffraction", coverage: 0.9, resolution: 2.5 }),
    ]);
    expect(ranked[0].pdb_id).toBe("xray");
  });

  it("prefers meaningfully higher coverage among same method", () => {
    const ranked = rankStructures([
      hit({ pdb_id: "low", coverage: 0.5, resolution: 1.5 }),
      hit({ pdb_id: "high", coverage: 0.9, resolution: 2.5 }),
    ]);
    expect(ranked[0].pdb_id).toBe("high");
  });

  it("breaks near-equal coverage ties by better (lower) resolution", () => {
    const ranked = rankStructures([
      hit({ pdb_id: "blurry", coverage: 0.90, resolution: 2.8 }),
      hit({ pdb_id: "sharp", coverage: 0.92, resolution: 1.4 }),
    ]);
    expect(ranked[0].pdb_id).toBe("sharp");
  });
});
