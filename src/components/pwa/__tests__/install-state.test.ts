import { afterEach, describe, expect, it, vi } from "vitest";
import { detectPlatform } from "../install-state";

function asDevice(userAgent: string, platform = "", maxTouchPoints = 0) {
  vi.stubGlobal("navigator", { userAgent, platform, maxTouchPoints });
}

describe("detectPlatform", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("tells iPhone from iPad, including iPads that claim to be Macs", () => {
    asDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile Safari/604.1");
    expect(detectPlatform()).toBe("ios");
    asDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15", "MacIntel", 5);
    expect(detectPlatform()).toBe("ipad");
  });

  it("knows Samsung Internet apart from Chrome on Android", () => {
    asDevice("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 SamsungBrowser/24.0 Chrome/117.0 Mobile Safari/537.36");
    expect(detectPlatform()).toBe("samsung");
    asDevice("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36");
    expect(detectPlatform()).toBe("android");
  });

  it("sorts computers by whether they can install", () => {
    asDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36 Edg/124.0", "Win32");
    expect(detectPlatform()).toBe("desktop-chromium");
    asDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15", "MacIntel", 0);
    expect(detectPlatform()).toBe("desktop-safari");
    asDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0", "Win32");
    expect(detectPlatform()).toBe("firefox");
  });
});
