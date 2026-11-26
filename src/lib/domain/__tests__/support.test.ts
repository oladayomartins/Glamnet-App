import { describe, expect, it } from "vitest";
import { HELP_ARTICLES, articleBySlug, searchArticles } from "../help-articles";
import { ENQUIRY_CATEGORIES, categoriesFor, enquiryReference } from "../support-enquiry";

describe("help articles", () => {
  it("have unique slugs", () => {
    const slugs = HELP_ARTICLES.map((article) => article.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("find answers by everyday words, plurals included", () => {
    expect(searchArticles("refunds").map((article) => article.slug)).toContain("refunds");
    expect(searchArticles("pin").map((article) => article.slug)).toContain("checkout-pin");
    expect(searchArticles("held payout").map((article) => article.slug)).toContain("held-earnings");
    expect(searchArticles("zzz")).toEqual([]);
    expect(searchArticles(" ")).toEqual([]);
  });

  it("rank title matches first", () => {
    expect(searchArticles("cancel")[0].slug).toBe("cancel-a-booking");
  });

  it("only link to pages that exist on the site", () => {
    const known = /^\/(support(\/[a-z-]+)?|how-it-works|cancellations|privacy|install|sign-in|provider\/onboarding)(\?.*)?$/;
    for (const article of HELP_ARTICLES) {
      for (const block of article.body) {
        if (block.kind === "link") expect(block.href, article.slug).toMatch(known);
      }
    }
    expect(articleBySlug("how-booking-works")?.title).toBe("How booking works");
  });
});

describe("support enquiry options", () => {
  it("give every role a category, and every category a topic", () => {
    for (const role of ["CUSTOMER", "VENDOR", "MEMBER", "OTHER"] as const) {
      expect(categoriesFor(role).length).toBeGreaterThan(0);
    }
    for (const category of ENQUIRY_CATEGORIES) expect(category.topics.length).toBeGreaterThan(0);
  });

  it("keep vendor-only topics away from customers", () => {
    expect(categoriesFor("CUSTOMER").map((category) => category.value)).not.toContain("PAYOUTS");
    expect(categoriesFor("VENDOR").map((category) => category.value)).toContain("PAYOUTS");
  });

  it("show customers-or-vendors both sets of topics", () => {
    const member = categoriesFor("MEMBER").map((category) => category.value);
    expect(member).toContain("PAYOUTS");
    expect(member).toContain("PAYMENT");
  });

  it("make references easy to read out", () => {
    expect(enquiryReference()).toMatch(/^GN-[2-9A-HJ-NP-Z]{6}$/);
    expect(enquiryReference(() => 0)).toBe("GN-222222");
  });
});
