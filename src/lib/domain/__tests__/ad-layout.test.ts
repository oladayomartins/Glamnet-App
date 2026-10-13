import { describe, expect, it } from "vitest";
import { AD_SLOTS, adBoxStyle, adImageSrc, deviceClass, sizeDimensions } from "../ad-layout";

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
