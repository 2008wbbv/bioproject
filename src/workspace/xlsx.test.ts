import { describe, it, expect } from "vitest";
import { buildXlsx, colLetter, sanitizeSheetName } from "./xlsx.ts";

describe("colLetter", () => {
  it("maps 0-based indices to spreadsheet columns", () => {
    expect(colLetter(0)).toBe("A");
    expect(colLetter(25)).toBe("Z");
    expect(colLetter(26)).toBe("AA");
    expect(colLetter(27)).toBe("AB");
    expect(colLetter(51)).toBe("AZ");
    expect(colLetter(52)).toBe("BA");
  });
});

describe("sanitizeSheetName", () => {
  it("strips illegal characters and caps length at 31", () => {
    expect(sanitizeSheetName("a/b:c?d*[e]")).toBe("a b c d  e ");
    expect(sanitizeSheetName("x".repeat(40)).length).toBe(31);
    expect(sanitizeSheetName("")).toBe("Sheet");
  });
});

describe("buildXlsx", () => {
  const bytes = buildXlsx([
    { name: "Summary", rows: [["Field", "Value"], ["RMSD", 0.506]] },
    { name: "Per-residue", rows: [["res", "dev"], [96, 0.337]] },
  ]);
  // store-only zip => XML parts are present verbatim in the bytes
  const text = new TextDecoder("utf-8").decode(bytes);

  it("emits a valid ZIP (PK local-header signature + EOCD at the end)", () => {
    expect(bytes[0]).toBe(0x50); // 'P'
    expect(bytes[1]).toBe(0x4b); // 'K'
    // End of central directory signature 0x06054b50 (little-endian) sits at the tail.
    const tail = bytes.slice(bytes.length - 22);
    expect([tail[0], tail[1], tail[2], tail[3]]).toEqual([0x50, 0x4b, 0x05, 0x06]);
  });

  it("includes the required OOXML parts", () => {
    expect(text).toContain("[Content_Types].xml");
    expect(text).toContain("xl/workbook.xml");
    expect(text).toContain("xl/worksheets/sheet1.xml");
    expect(text).toContain("xl/worksheets/sheet2.xml");
    expect(text).toContain("xl/styles.xml");
  });

  it("writes numbers as <v> and strings as inline strings", () => {
    expect(text).toContain("<v>0.506</v>");
    expect(text).toContain("<t xml:space=\"preserve\">RMSD</t>");
    expect(text).toContain('name="Per-residue"');
  });

  it("escapes XML-special characters in cell text", () => {
    const t = new TextDecoder().decode(buildXlsx([{ name: "S", rows: [["a<b>&\"c"]] }]));
    expect(t).toContain("a&lt;b&gt;&amp;&quot;c");
  });
});
