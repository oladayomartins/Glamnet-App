import { describe, expect, it } from "vitest";
import {
  DEFAULT_GA_MEASUREMENT_ID,
  daysAhead,
  parseConsent,
  resolveMeasurementId,
  sanitizeLocation,
  sanitizeReferrer,
  serviceItem,
  toMajor,
  track,
} from "@/lib/analytics";

describe("resolveMeasurementId", () => {
  it("reports to the live property only in production by default", () => {
    expect(resolveMeasurementId(undefined, true)).toBe(DEFAULT_GA_MEASUREMENT_ID);
    expect(resolveMeasurementId(undefined, false)).toBeNull();
    expect(resolveMeasurementId("  ", false)).toBeNull();
  });

  it("lets an explicit id override, e.g. a test property on a preview", () => {
    expect(resolveMeasurementId("G-TEST123", false)).toBe("G-TEST123");
  });

  it("refuses anything that is not a GA4 id", () => {
    expect(resolveMeasurementId("UA-1234-1", true)).toBeNull();
    expect(resolveMeasurementId("G-abc\"></script>", true)).toBeNull();
  });
});

describe("sanitizeLocation", () => {
  it("drops one-time tokens and anything else not allowlisted", () => {
    expect(sanitizeLocation("https://glamnet.co/unsubscribe?token=secret&utm_source=email")).toBe(
      "https://glamnet.co/unsubscribe?utm_source=email",
    );
    expect(sanitizeLocation("https://glamnet.co/auth/confirm?token_hash=abc&type=email&next=/account")).toBe(
      "https://glamnet.co/auth/confirm",
    );
    expect(sanitizeLocation("https://glamnet.co/sign-in?email=a%40b.com")).toBe("https://glamnet.co/sign-in");
  });

  it("keeps campaign and search parameters", () => {
    expect(sanitizeLocation("https://glamnet.co/search?q=braids&location=Leeds&gclid=x#top")).toBe(
      "https://glamnet.co/search?q=braids&location=Leeds&gclid=x",
    );
    expect(sanitizeLocation("https://glamnet.co/pro/ada?via=directory")).toBe("https://glamnet.co/pro/ada?via=directory");
  });

  it("returns an empty string for garbage", () => {
    expect(sanitizeLocation("not a url")).toBe("");
  });
});

describe("sanitizeReferrer", () => {
  it("keeps only origin and path", () => {
    expect(sanitizeReferrer("https://www.google.com/search?q=private")).toBe("https://www.google.com/search");
    expect(sanitizeReferrer("")).toBe("");
  });
});

describe("parseConsent", () => {
  it("reads a current-version choice", () => {
    expect(parseConsent(JSON.stringify({ v: 1, choice: "granted" }))).toBe("granted");
    expect(parseConsent(JSON.stringify({ v: 1, choice: "denied" }))).toBe("denied");
  });

  it("treats missing, stale or malformed values as unanswered", () => {
    expect(parseConsent(null)).toBeNull();
    expect(parseConsent("granted")).toBeNull();
    expect(parseConsent(JSON.stringify({ v: 0, choice: "granted" }))).toBeNull();
    expect(parseConsent(JSON.stringify({ v: 1, choice: "maybe" }))).toBeNull();
  });
});

describe("items and money", () => {
  it("converts minor units to pounds", () => {
    expect(toMajor(4550)).toBe(45.5);
    expect(toMajor(0)).toBe(0);
  });

  it("maps a service to a GA4 item with the vendor as affiliation", () => {
    expect(
      serviceItem({ id: "s1", name: "Knotless braids", priceMinor: 12000, category: "Braids", vendor: "Ada", city: "Leeds", kind: "SERVICE" }),
    ).toEqual({
      item_id: "s1",
      item_name: "Knotless braids",
      affiliation: "Ada",
      item_category: "Braids",
      item_category2: "Leeds",
      item_variant: "service",
      price: 120,
      quantity: 1,
    });
  });

  it("counts whole days ahead, never negative", () => {
    const now = Date.parse("2026-09-26T10:00:00Z");
    expect(daysAhead("2026-09-28T09:00:00Z", now)).toBe(1);
    expect(daysAhead("2026-09-25T09:00:00Z", now)).toBe(0);
  });
});

describe("track", () => {
  it("is a no-op on the server and before consent", () => {
    expect(() => track("login", { method: "password" })).not.toThrow();
  });
});
