import { describe, expect, it } from "vitest";
import { campaignEmail } from "../templates";
import { maskEmail } from "@/lib/server/unsubscribe";

const links = {
  unsubscribeUrl: "https://www.glamnetapp.com/unsubscribe?t=abc",
  oneClickUrl: "https://www.glamnetapp.com/api/unsubscribe?t=abc",
};

describe("campaign emails", () => {
  const email = campaignEmail({ title: "Autumn offers", message: "Book now.\n\nSee you soon.", ...links });

  it("carry a visible unsubscribe link in the HTML and the text", () => {
    expect(email.html).toContain(`href="${links.unsubscribeUrl}"`);
    expect(email.html).toContain(">Unsubscribe</a>");
    expect(email.text).toContain(links.unsubscribeUrl);
  });

  it("carry one-click unsubscribe headers for mail apps", () => {
    expect(email.headers).toEqual({
      "List-Unsubscribe": `<${links.oneClickUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("escape the link", () => {
    const tricky = campaignEmail({ title: "x", message: "y", ...links, unsubscribeUrl: 'https://a.test/?t="><b>' });
    expect(tricky.html).not.toContain('"><b>');
  });
});

describe("maskEmail", () => {
  it("shows enough to recognise the address, not the whole of it", () => {
    expect(maskEmail("jane.doe@gmail.com")).toBe("j•••@gmail.com");
    expect(maskEmail("nonsense")).toBe("your account");
  });
});
