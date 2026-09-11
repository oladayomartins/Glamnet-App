import { describe, expect, it } from "vitest";
import {
  customerBookingConfirmedEmail,
  escapeHtml,
  providerApprovalEmail,
  providerBroadcastEmail,
  type BookingEmailFacts,
} from "@/lib/email/templates";

/** The colour the brand guide reserves for EMERGENCY, and nothing else. */
const EMERGENCY_RED = "#D0342C";

const normal: BookingEmailFacts = {
  isEmergency: false,
  serviceNames: ["Silk press", "Makeup"],
  appointmentLabel: "Fri 12 Sep, 14:00",
  amountLabel: "£125.50",
  sector: "SE1",
  url: "https://glamnetapp.com/provider",
};

const emergency: BookingEmailFacts = { ...normal, isEmergency: true };

describe("providerBroadcastEmail", () => {
  it("tags an emergency in the subject, where it is visible before opening", () => {
    expect(providerBroadcastEmail("Amara", emergency).subject).toContain(
      "EMERGENCY BOOKING REQUEST",
    );
  });

  it("never calls a normal booking an emergency", () => {
    const email = providerBroadcastEmail("Amara", normal);
    expect(email.subject).not.toContain("EMERGENCY");
    expect(email.html).not.toContain("EMERGENCY");
    expect(email.text).not.toContain("EMERGENCY");
  });

  it("reserves red for the emergency tag", () => {
    expect(providerBroadcastEmail("Amara", normal).html).not.toContain(
      EMERGENCY_RED,
    );
    expect(providerBroadcastEmail("Amara", emergency).html).toContain(
      EMERGENCY_RED,
    );
  });

  it("shows the provider what they earn, not what the customer pays", () => {
    const email = providerBroadcastEmail("Amara", normal);
    expect(email.html).toContain("You earn");
    expect(email.text).toContain("£125.50");
  });

  it("always carries a plain-text alternative", () => {
    for (const facts of [normal, emergency]) {
      const email = providerBroadcastEmail("Amara", facts);
      expect(email.text.trim().length).toBeGreaterThan(0);
      expect(email.text).not.toContain("<");
    }
  });
});

describe("customerBookingConfirmedEmail", () => {
  it("names the provider who accepted", () => {
    const email = customerBookingConfirmedEmail("Joy", "Amara", normal);
    expect(email.html).toContain("Amara");
    expect(email.subject).toContain("Your booking is confirmed");
  });

  it("keeps the emergency tag consistent with the broadcast", () => {
    expect(
      customerBookingConfirmedEmail("Joy", "Amara", emergency).subject,
    ).toContain("EMERGENCY BOOKING confirmed");
  });
});

describe("providerApprovalEmail", () => {
  it("does not dress a rejection in the emergency colour", () => {
    const email = providerApprovalEmail("Amara", "REJECTED", "", "https://x.test");
    expect(email.html).not.toContain(EMERGENCY_RED);
  });

  it("includes the admin's note when there is one", () => {
    const withNote = providerApprovalEmail(
      "Amara",
      "REJECTED",
      "Missing insurance documents",
      "https://x.test",
    );
    expect(withNote.html).toContain("Missing insurance documents");
    expect(withNote.text).toContain("Missing insurance documents");

    const without = providerApprovalEmail("Amara", "APPROVED", "", "https://x.test");
    expect(without.html).not.toContain("Note from the team");
  });
});

describe("escapeHtml", () => {
  it("neutralises markup in names, which come from user input", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("is applied to every interpolated value in a rendered email", () => {
    const email = providerBroadcastEmail("<b>Amara</b>", {
      ...normal,
      serviceNames: ["<img src=x>"],
    });
    expect(email.html).not.toContain("<b>Amara</b>");
    expect(email.html).not.toContain("<img src=x>");
    expect(email.html).toContain("&lt;b&gt;Amara&lt;/b&gt;");
  });
});
