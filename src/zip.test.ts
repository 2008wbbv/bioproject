import { describe, it, expect } from "vitest";
import { zipStore, zipText } from "./zip.ts";

describe("zipStore", () => {
  it("produces a valid ZIP (PK signature + EOCD) containing the file names and data", () => {
    const bytes = zipText([
      { name: "a.txt", text: "hello" },
      { name: "dir/b.json", text: '{"x":1}' },
    ]);
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]); // PK
    const tail = bytes.slice(bytes.length - 22);
    expect([tail[0], tail[1], tail[2], tail[3]]).toEqual([0x50, 0x4b, 0x05, 0x06]); // EOCD
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("a.txt");
    expect(text).toContain("dir/b.json");
    expect(text).toContain("hello"); // stored (uncompressed) so content is verbatim
  });

  it("encodes the entry count in the EOCD", () => {
    const bytes = zipStore([{ name: "x", data: new Uint8Array([1, 2, 3]) }]);
    const tail = bytes.slice(bytes.length - 22);
    const dv = new DataView(tail.buffer, tail.byteOffset);
    expect(dv.getUint16(10, true)).toBe(1); // total central dir records
  });
});
