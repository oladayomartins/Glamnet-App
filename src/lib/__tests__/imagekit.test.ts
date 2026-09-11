import { afterEach, describe, expect, it } from "vitest";
import {
  CATEGORY_IMAGE_PATHS,
  HERO_IMAGE_PATH,
  brandMediaOrigin,
  categoryImagePath,
  isImageKitConfigured,
  isTrustedImageUrl,
} from "@/lib/imagekit";

const ENDPOINT = "https://ik.imagekit.io/glamnetapp";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
  delete process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
});

describe("brandMediaOrigin", () => {
  it("resolves with nothing configured at all", () => {
    // The whole point of the change: an unset endpoint used to replace every
    // photograph on the marketing pages with a gradient, silently.
    expect(isImageKitConfigured()).toBe(false);
    expect(brandMediaOrigin()).toBe(ENDPOINT);
  });

  it("prefers a configured endpoint, so a moved library needs one change", () => {
    process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/other";
    expect(brandMediaOrigin()).toBe("https://ik.imagekit.io/other");
  });

  it("tolerates a trailing slash on the endpoint", () => {
    process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = `${ENDPOINT}/`;
    expect(brandMediaOrigin()).toBe(ENDPOINT);
  });
});

describe("brand artwork paths", () => {
  it("gives every path a leading slash and no double slash when joined", () => {
    const paths = [HERO_IMAGE_PATH, ...Object.values(CATEGORY_IMAGE_PATHS)];

    for (const path of paths) {
      expect(path.startsWith("/")).toBe(true);
      expect(`${brandMediaOrigin()}${path}`).not.toMatch(/[^:]\/\//);
    }
  });

  it("encodes to a URL whose path survives the spaces in the filenames", () => {
    // Two of these carry spaces and one carries two of them in a row, which is
    // exactly the kind of thing that silently 404s.
    for (const path of Object.values(CATEGORY_IMAGE_PATHS)) {
      const url = new URL(`${brandMediaOrigin()}${encodeURI(path)}`);

      // The pathname carries the account segment too, so the filename is
      // checked at the end of it rather than as the whole thing.
      expect(decodeURIComponent(url.pathname).endsWith(path)).toBe(true);
      // Spaces must be escaped in the URL itself, or the request is malformed.
      expect(url.pathname).not.toContain(" ");
    }
  });

  it("knows the seeded categories and nothing it has not been given", () => {
    for (const category of ["Hair", "Nails", "Makeup"]) {
      expect(categoryImagePath(category)).not.toBeNull();
    }
    expect(categoryImagePath("Massage")).toBeNull();
  });
});

describe("isTrustedImageUrl", () => {
  it("still refuses a host that is not our delivery endpoint", () => {
    process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = ENDPOINT;
    // Customer-supplied reference images keep the guard: this is the
    // tracking-pixel case, and nothing above relaxes it.
    expect(isTrustedImageUrl("https://evil.example/pixel.png")).toBe(false);
    expect(isTrustedImageUrl("not a url")).toBe(false);
    expect(isTrustedImageUrl("")).toBe(false);
  });

  it("refuses everything when no endpoint is configured", () => {
    expect(isTrustedImageUrl(`${ENDPOINT}/anything.png`)).toBe(false);
  });
});
