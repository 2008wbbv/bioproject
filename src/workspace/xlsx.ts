/**
 * Minimal, dependency-free real .xlsx writer (SPEC §10 export → Excel).
 *
 * An .xlsx is a ZIP of OOXML parts. Rather than pull in SheetJS (security
 * advisories) or a zip lib, we emit a store-only (uncompressed) ZIP — which Excel
 * reads fine — and the minimal set of OOXML parts for a multi-sheet workbook with
 * inline strings and numbers. Pure byte work: testable, no DOM, no deps.
 */

import { zipStore, type ZipEntry } from "../zip.ts";

export type Cell = string | number;
export interface Sheet {
  name: string;
  rows: Cell[][];
}

// ---- OOXML ---------------------------------------------------------------

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // strip control chars that are illegal in XML 1.0
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

/** 0-based column index → A, B, …, Z, AA, … */
export function colLetter(index: number): string {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/** Excel sheet names: ≤31 chars, none of : \ / ? * [ ]. */
export function sanitizeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, " ").slice(0, 31) || "Sheet";
}

function cellXml(ref: string, value: Cell): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

function sheetXml(rows: Cell[][]): string {
  const body = rows
    .map((row, r) => {
      const cells = row.map((v, c) => cellXml(`${colLetter(c)}${r + 1}`, v)).join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${body}</sheetData></worksheet>`
  );
}

function contentTypesXml(n: number): string {
  const overrides = Array.from({ length: n }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    overrides +
    `</Types>`
  );
}

const ROOT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`;

const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="1"><fill><patternFill patternType="none"/></fill></fills>` +
  `<borders count="1"><border/></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>` +
  `</styleSheet>`;

function workbookXml(sheets: Sheet[]): string {
  const els = sheets
    .map((s, i) => `<sheet name="${escapeXml(sanitizeSheetName(s.name))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>${els}</sheets></workbook>`
  );
}

function workbookRelsXml(n: number): string {
  const sheetRels = Array.from({ length: n }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  ).join("");
  const stylesRel = `<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheetRels +
    stylesRel +
    `</Relationships>`
  );
}

// ---- Package the OOXML parts into a ZIP (store / no compression) ----------

/** Build a complete .xlsx file as bytes from a list of sheets. */
export function buildXlsx(sheets: Sheet[]): Uint8Array {
  const enc = new TextEncoder();
  const files: ZipEntry[] = [
    { name: "[Content_Types].xml", data: enc.encode(contentTypesXml(sheets.length)) },
    { name: "_rels/.rels", data: enc.encode(ROOT_RELS) },
    { name: "xl/workbook.xml", data: enc.encode(workbookXml(sheets)) },
    { name: "xl/_rels/workbook.xml.rels", data: enc.encode(workbookRelsXml(sheets.length)) },
    { name: "xl/styles.xml", data: enc.encode(STYLES_XML) },
    ...sheets.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: enc.encode(sheetXml(s.rows)),
    })),
  ];
  return zipStore(files);
}
