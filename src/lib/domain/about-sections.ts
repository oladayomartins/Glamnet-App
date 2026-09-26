/**
 * The vendor's About, as a few short answers rather than one blank box.
 *
 * A single "Bio" textarea asks a vendor to be a copywriter, and the result is
 * predictable: a sentence fragment, or nothing, or a typo nobody proofreads
 * because there is no structure to proofread against. Splitting it into the
 * three questions clients actually have — what you specialise in, what to
 * expect, how to find you — turns writing a profile into answering a form.
 *
 * Each answer is stored in its own column and rendered under its own heading,
 * so a vendor who answers two of three gets a page with two headings rather
 * than a paragraph with a hole in it.
 */

export interface AboutInput {
  bio: string;
  specialisesIn: string;
  whatToExpect: string;
  howToFindMe: string;
}

export interface AboutSection {
  key: keyof Omit<AboutInput, "bio">;
  heading: string;
  prompt: string;
  /** Shown under the field while the vendor writes. */
  example: string;
  body: string;
}

const PROMPTS: Omit<AboutSection, "body">[] = [
  {
    key: "specialisesIn",
    heading: "What I specialise in",
    prompt: "What are you known for?",
    example: "Knotless braids and protective styling for 4C hair.",
  },
  {
    key: "whatToExpect",
    heading: "What to expect",
    prompt: "What happens at an appointment?",
    example:
      "Come with hair washed and blow-dried. Allow three hours; tea and a film are on me.",
  },
  {
    key: "howToFindMe",
    heading: "How to find me",
    prompt: "Parking, transport, which door?",
    example:
      "Two minutes from Dagenham East. Free parking on the road outside; side door, not the front.",
  },
];

/** The empty form — what a vendor who has written nothing yet is shown. */
export function aboutPrompts(): Omit<AboutSection, "body">[] {
  return PROMPTS;
}

/**
 * The sections a storefront should render, in order, skipping the blanks.
 *
 * Whitespace-only answers count as blank: a space bar pressed to get past a
 * form should not produce an empty heading on a live page.
 */
export function aboutSections(input: AboutInput): AboutSection[] {
  return PROMPTS.map((prompt) => ({
    ...prompt,
    body: input[prompt.key]?.trim() ?? "",
  })).filter((section) => section.body.length > 0);
}

/**
 * Whether the About is worth showing at all.
 *
 * The free-text bio counts here: a vendor who wrote one before this form
 * existed has a perfectly good About and must not be told it is empty.
 */
export function hasAbout(input: AboutInput): boolean {
  return input.bio.trim().length > 0 || aboutSections(input).length > 0;
}
