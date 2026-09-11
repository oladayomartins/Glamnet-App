import { afterEach, describe, expect, it } from "vitest";
import {
  HERO_IMAGE_PATH,
  brandImageUrl,
  categoryImageUrl,
  isImageKitConfigured,
  isTrustedImageUrl,
} from "@/lib/imagekit";

const ENDPOINT = "https://ik.imagekit.io/glamnetapp";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
  delete process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
});

describe("brandImageUrl", () => {
  it("builds a URL the renderer will trust", () => {
    process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = ENDPOINT;
    const url = brandImageUrl(HERO_IMAGE_PATH);

    // The whole point: GlamImage silently falls back to the metal gradient for
    // any URL it does not trust, so a hero that fails this check would vanish
    // without an error anywhere.
    expect(url).toBe(`${ENDPOINT}${HERO_IMAGE_PATH}`);
    expect(isTrustedImageUrl(url!)).toBe(true);
  });

  it("tolerates a trailing slash on the endpoint", () => {
    process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = `${ENDPOINT}/`;
    expect(brandImageUrl(HERO_IMAGE_PATH)).toBe(`${ENDPOINT}${HERO_IMAGE_PATH}`);
  });

  it("returns null when nothing is configured, so the slot falls back", () => {
    expect(brandImageUrl(HERO_IMAGE_PATH)).toBeNull();
    expect(isImageKitConfigured()).toBe(false);
  });
});

describe("isTrustedImageUrl", () => {
  it("refuses a host that is not our delivery endpoint", () => {
    process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = ENDPOINT;
    // A customer-supplied reference image pointing anywhere else is exactly
    // the tracking-pixel case this check exists for.
    expect(isTrustedImageUrl("https://evil.example/pixel.png")).toBe(false);
    expect(isTrustedImageUrl("not a url")).toBe(false);
    expect(isTrustedImageUrl("")).toBe(false);
  });
});

describe("categoryImageUrl", () => {
  it("prefers a real uploaded image over the shipped artwork", () => {
    process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = ENDPOINT;
    const uploaded = `${ENDPOINT}/glamnet/services/braids.png`;

    // Adding photography through the admin must not require a code change
    // here, so anything uploaded wins.
    expect(categoryImageUrl("Hair", uploaded)).toBe(uploaded);
  });

  it("falls back to the shipped artwork for the seeded categories", () => {
    process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = ENDPOINT;

    for (const category of ["Hair", "Nails", "Makeup"]) {
      const url = categoryImageUrl(category);
      expect(url).not.toBeNull();
      // Same silent-fallback trap as the hero: an untrusted URL would leave
      // the tile showing metal with nothing to explain why.
      expect(isTrustedImageUrl(url!)).toBe(true);
    }
  });

  it("returns null for a category with no artwork, so the tile falls back", () => {
    process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = ENDPOINT;
    expect(categoryImageUrl("Massage")).toBeNull();
  });
});
