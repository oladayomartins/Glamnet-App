import { describe, expect, it } from "vitest";
import {
  aboutPrompts,
  aboutSections,
  hasAbout,
  type AboutInput,
} from "@/lib/domain/about-sections";

const empty: AboutInput = {
  bio: "",
  specialisesIn: "",
  whatToExpect: "",
  howToFindMe: "",
};

describe("aboutPrompts", () => {
  it("asks the three questions a client actually has, in that order", () => {
    expect(aboutPrompts().map((p) => p.key)).toEqual([
      "specialisesIn",
      "whatToExpect",
      "howToFindMe",
    ]);
  });

  it("gives every prompt a worked example to write against", () => {
    for (const prompt of aboutPrompts()) {
      expect(prompt.example.length).toBeGreaterThan(10);
      expect(prompt.heading.length).toBeGreaterThan(0);
    }
  });
});

describe("aboutSections", () => {
  it("renders only what was answered, so there is no heading over a hole", () => {
    const sections = aboutSections({
      ...empty,
      specialisesIn: "Knotless braids.",
      howToFindMe: "Two minutes from Dagenham East.",
    });
    expect(sections.map((s) => s.heading)).toEqual([
      "What I specialise in",
      "How to find me",
    ]);
  });

  it("treats whitespace as blank", () => {
    // A space bar pressed to get past a form must not put an empty heading on
    // a live page.
    expect(aboutSections({ ...empty, whatToExpect: "   \n  " })).toEqual([]);
  });

  it("keeps the prompt order regardless of which are filled", () => {
    const sections = aboutSections({
      ...empty,
      howToFindMe: "Side door.",
      specialisesIn: "Locs.",
      whatToExpect: "Three hours.",
    });
    expect(sections.map((s) => s.key)).toEqual([
      "specialisesIn",
      "whatToExpect",
      "howToFindMe",
    ]);
  });

  it("returns nothing for an untouched profile", () => {
    expect(aboutSections(empty)).toEqual([]);
  });
});

describe("hasAbout", () => {
  it("counts a free-text bio written before this form existed", () => {
    // Such a vendor has a perfectly good About and must not be told otherwise.
    expect(hasAbout({ ...empty, bio: "Braids specialist in Leeds." })).toBe(true);
  });

  it("counts a single answered prompt", () => {
    expect(hasAbout({ ...empty, whatToExpect: "Allow three hours." })).toBe(true);
  });

  it("is false only when everything is blank", () => {
    expect(hasAbout(empty)).toBe(false);
    expect(hasAbout({ ...empty, bio: "   " })).toBe(false);
  });
});
