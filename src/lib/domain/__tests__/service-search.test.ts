import { describe, expect, it } from "vitest";
import {
  matchServices,
  tokenise,
  unmatchedAliasTargets,
} from "../service-search";

/**
 * The seeded catalogue, which is also the one the examples in the brief were
 * written against. Matching is pure, so the real rows can be handed to it in
 * a test the same way the API hands it rows from the database.
 */
const CATALOGUE = [
  { id: "1", name: "Knotless Box Braids", category: "Hair" },
  { id: "2", name: "Luxury Blow Dry", category: "Hair" },
  { id: "3", name: "Prom Updo", category: "Hair" },
  { id: "4", name: "Glam Makeup", category: "Makeup" },
  { id: "5", name: "Bridal Makeup", category: "Makeup" },
  { id: "6", name: "Gel Manicure", category: "Nails" },
];

const names = (query: string, limit = 5) =>
  matchServices(query, CATALOGUE, limit).map((match) => match.service.name);

describe("tokenise", () => {
  it("reduces punctuation and case to plain words", () => {
    expect(tokenise("Knotless  Box-Braids!")).toEqual([
      "knotless",
      "box",
      "braids",
    ]);
  });
});

describe("matchServices", () => {
  it("finds hair work from a sentence with no catalogue words in it", () => {
    // The brief's own example: "make my hair" must reach the Hair services.
    const found = names("make my hair");
    expect(found.length).toBeGreaterThan(0);
    expect(found).toContain("Knotless Box Braids");
    expect(found).not.toContain("Gel Manicure");
  });

  it("ranks the named service above the rest of its category", () => {
    expect(names("box braids")[0]).toBe("Knotless Box Braids");
  });

  it("treats a style nobody stocks as its family", () => {
    // "cornrows" is not in the catalogue; braided work is what was meant.
    expect(names("cornrows")).toContain("Knotless Box Braids");
  });

  it("returns every makeup service for the bare word", () => {
    const found = names("makeup");
    expect(found).toContain("Glam Makeup");
    expect(found).toContain("Bridal Makeup");
  });

  it("reads an occasion as the work it implies", () => {
    expect(names("wedding")).toContain("Bridal Makeup");
    expect(names("my birthday")).toContain("Glam Makeup");
  });

  it("understands the words a customer uses for nails", () => {
    expect(names("gel")).toContain("Gel Manicure");
    expect(names("mani")).toContain("Gel Manicure");
  });

  it("matches an adjacent phrase but not the same words apart", () => {
    // "make up" is makeup; "make my hair" is emphatically not.
    expect(names("make up")).toContain("Glam Makeup");
    expect(names("make my hair")).not.toContain("Glam Makeup");
  });

  it("returns nothing for a request that is not a service", () => {
    // The whole point of the taxonomy gate: this must find no service rather
    // than become one.
    expect(names("can you make me look like Beyoncé for my birthday")).not
      .toContain("Gel Manicure");
    expect(names("xyzzy")).toEqual([]);
    expect(names("")).toEqual([]);
    expect(names("please")).toEqual([]);
  });

  it("completes the word still being typed", () => {
    expect(names("brai")[0]).toMatch(/Braids/);
    expect(names("knot")[0]).toMatch(/Braids/);
    expect(names("plai")[0]).toMatch(/Braids/);
    expect(names("manic")).toContain("Gel Manicure");
    // Two letters is too little to guess from, and a finished word means itself.
    expect(names("br")).toEqual([]);
    expect(names("brai ")).toEqual([]);
  });

  it("never returns more than the caller asked for", () => {
    expect(names("hair makeup nails", 2)).toHaveLength(2);
  });

  it("says why each match was offered", () => {
    const [first] = matchServices("box braids", CATALOGUE);
    expect(first.reason).toBe("name");
    const [implied] = matchServices("cornrows", CATALOGUE);
    expect(implied.reason).toBe("phrase");
  });
});

describe("unmatchedAliasTargets", () => {
  it("reports vocabulary the catalogue cannot answer", () => {
    // Not an assertion that the list is empty — this catalogue genuinely has
    // no wig, lash or BIAB service — but that the check can see the gap. It is
    // what stops an alias quietly pointing at nothing after a catalogue edit.
    const missing = unmatchedAliasTargets(CATALOGUE);
    expect(missing).toContain("wig");
    expect(missing).not.toContain("braids");
    expect(missing).not.toContain("makeup");
  });
});
