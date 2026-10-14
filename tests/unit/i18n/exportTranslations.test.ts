import { describe, expect, it } from "vitest";
import { csvCell, flatten, toCsv } from "../../../scripts/lib/translations.mjs";

describe("export-translations helpers", () => {
  it("flattens nested keys with dot paths and array indices", () => {
    expect(flatten({ a: { b: "x", list: ["p", { q: "r" }] } })).toEqual({
      "a.b": "x",
      "a.list.0": "p",
      "a.list.1.q": "r",
    });
  });

  it("quotes cells with commas, quotes and newlines", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("leaves a key missing from a locale as an empty cell", () => {
    const csv = toCsv({ es: { a: "uno", b: "dos" }, eu: { a: "bat" }, en: { a: "one", b: "two" } });
    expect(csv).toBe("key,es,eu,en\na,uno,bat,one\nb,dos,,two\n");
  });
});
