import { describe, expect, it } from "vitest";
import { applySuggestion, splitNumber, toSuggestion, uniqueSuggestions } from "../address";

describe("toSuggestion", () => {
  it("turns a numbered house into a first line", () => {
    expect(toSuggestion({ type: "house", housenumber: "21", street: "Dover Road" })).toEqual({
      line: "21 Dover Road",
      kind: "house",
    });
  });

  it("names a building that has no number", () => {
    expect(toSuggestion({ type: "house", name: "York Villas", street: "Bristol Road" })?.line).toBe(
      "York Villas, Bristol Road",
    );
  });

  it("offers a street on its own", () => {
    expect(toSuggestion({ type: "street", name: "Wigfull Road" })).toEqual({ line: "Wigfull Road", kind: "street" });
  });

  it("skips anything that is not an address", () => {
    expect(toSuggestion({ type: "house", housenumber: "4" })).toBeNull();
    expect(toSuggestion({ type: "city", name: "Sheffield" })).toBeNull();
  });
});

describe("uniqueSuggestions", () => {
  it("drops repeats and nulls", () => {
    const street = { line: "Brocco Bank", kind: "street" as const };
    expect(uniqueSuggestions([street, null, { ...street, line: "brocco bank" }])).toEqual([street]);
  });
});

describe("applySuggestion", () => {
  it("uses a whole house line as it is", () => {
    expect(applySuggestion("21 dov", { line: "21 Dover Road", kind: "house" })).toBe("21 Dover Road");
  });

  it("keeps the typed number in front of a street", () => {
    expect(applySuggestion("14 dov", { line: "Dover Road", kind: "street" })).toBe("14 Dover Road");
    expect(applySuggestion("Flat 2, 14a dov", { line: "Dover Road", kind: "street" })).toBe("Flat 2, 14a Dover Road");
  });

  it("gives just the street when no number was typed", () => {
    expect(applySuggestion("dov", { line: "Dover Road", kind: "street" })).toBe("Dover Road");
  });
});

describe("splitNumber", () => {
  it("separates the number from the street being typed", () => {
    expect(splitNumber("21 dov")).toEqual({ number: "21", street: "dov" });
    expect(splitNumber("Flat 2, 14a dov")).toEqual({ number: "Flat 2, 14a", street: "dov" });
    expect(splitNumber("dover")).toEqual({ number: "", street: "dover" });
  });
});
