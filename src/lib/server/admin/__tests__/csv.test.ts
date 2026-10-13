import { describe, expect, it } from "vitest";
import { csvCell, pounds, toCsv } from "../csv";

describe("admin CSV", () => {
  it("defuses values a spreadsheet would run as formulas", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell("+44 7700")).toBe("'+44 7700");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@sum")).toBe("'@sum");
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell('Smith, "Jo"')).toBe('"Smith, ""Jo"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
  });

  it("writes empty cells for missing values and keeps numbers and booleans", () => {
    expect(toCsv(["a", "b", "c", "d"], [[null, undefined, 3, false]])).toBe("a,b,c,d\n,,3,false");
  });

  it("formats pence as pounds", () => {
    expect(pounds(13050)).toBe("130.50");
    expect(pounds(null)).toBe("0.00");
  });
});
