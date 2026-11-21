import { describe, expect, it } from "vitest";
import { AD_SLOTS, adBoxStyle, adImageSrc, deviceClass, runDays, runEnd, sizeDimensions, slideshows } from "../ad-layout";

describe("ad layout", () => {
  it("uses a preset's dimensions and ignores typed ones", () => {
    expect(sizeDimensions("LEADERBOARD", { width: 300, height: 300 })).toEqual({ width: 1400, height: 200 });
  });

  it("uses typed dimensions for a custom size", () => {
    expect(sizeDimensions("CUSTOM", { width: 970, height: 250 })).toEqual({ width: 970, height: 250 });
  });

  it("caps the box at the ad's width and keeps its proportions", () => {
    expect(adBoxStyle({ width: 970, height: 250, align: "CENTER" })).toMatchObject({
      maxWidth: "970px",
      aspectRatio: "970 / 250",
      marginLeft: "auto",
      marginRight: "auto",
    });
  });

  it("aligns left and right by its margins", () => {
    expect(adBoxStyle({ width: 600, height: 600, align: "LEFT" })).toMatchObject({ marginLeft: 0, marginRight: "auto" });
    expect(adBoxStyle({ width: 600, height: 600, align: "RIGHT" })).toMatchObject({ marginLeft: "auto", marginRight: 0 });
  });

  it("clamps out-of-range dimensions instead of drawing a broken box", () => {
    expect(adBoxStyle({ width: 99999, height: 1, align: "CENTER" })).toMatchObject({ maxWidth: "2000px", aspectRatio: "2000 / 80" });
  });

  it("asks ImageKit for the ad's size, cropping only when filling", () => {
    expect(adImageSrc("https://ik.example/a.jpg", { width: 640, height: 480, imageFit: "COVER" })).toBe(
      "https://ik.example/a.jpg?tr=w-640,h-480,fo-auto,dpr-2",
    );
    expect(adImageSrc("https://ik.example/a.jpg", { width: 640, height: 480, imageFit: "CONTAIN" })).toContain("c-at_max");
  });

  it("hides device-only ads on the other kind of screen", () => {
    expect(deviceClass("ALL")).toBe("");
    expect(deviceClass("MOBILE")).toBe("lg:hidden");
    expect(deviceClass("DESKTOP")).toBe("hidden lg:block");
  });

  it("keeps the slots that were already in use", () => {
    expect(Object.keys(AD_SLOTS)).toEqual(expect.arrayContaining(["HOME_BANNER", "DIRECTORY_TOP", "STOREFRONT_FOOTER"]));
  });
});

describe("slideshows", () => {
  const ad = (id: string, device: "ALL" | "MOBILE" | "DESKTOP") => ({ id, device });

  it("is one slideshow for every device when phones and computers get the same ads", () => {
    expect(slideshows([ad("a", "ALL"), ad("b", "ALL")])).toEqual([{ device: "ALL", ads: [ad("a", "ALL"), ad("b", "ALL")] }]);
  });

  it("splits phones and computers when an ad targets only one", () => {
    const shows = slideshows([ad("a", "ALL"), ad("m", "MOBILE"), ad("d", "DESKTOP")]);
    expect(shows.map((show) => [show.device, show.ads.map((item) => item.id)])).toEqual([
      ["MOBILE", ["a", "m"]],
      ["DESKTOP", ["a", "d"]],
    ]);
  });

  it("keeps a one-device spot hidden on the other device", () => {
    expect(slideshows([ad("d", "DESKTOP")])).toEqual([{ device: "DESKTOP", ads: [ad("d", "DESKTOP")] }]);
  });

  it("is nothing for no ads", () => {
    expect(slideshows([])).toEqual([]);
  });
});

describe("run length", () => {
  it("ends an ad the chosen number of days after it starts", () => {
    const start = new Date("2026-11-21T09:00:00Z");
    expect(runEnd(start, 7).toISOString()).toBe("2026-11-28T09:00:00.000Z");
    expect(runDays(start, runEnd(start, 7))).toBe(7);
  });

  it("is not a whole number of days for an odd end time or no end", () => {
    const start = new Date("2026-11-21T09:00:00Z");
    expect(runDays(start, new Date("2026-11-22T10:30:00Z"))).toBeNull();
    expect(runDays(start, null)).toBeNull();
  });
});
