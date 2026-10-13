/**
 * Where an ad can go and how it is laid out — shared by the admin editor, its
 * live preview and the slot that renders the ad, so all three agree.
 *
 * Dimensions are the ad's design size in CSS pixels. On the site the ad is
 * drawn at that width (or the width of the column, if narrower) and keeps its
 * proportions as it scales down, so a phone sees the same shape smaller.
 */

import type { CSSProperties } from "react";

export const AD_SLOTS = {
  HOME_BANNER: { label: "Home — under the search", hint: "Straight under the home page hero, beside any announcement banner", page: "Home" },
  HOME_MIDDLE: { label: "Home — mid page", hint: "Between the featured vendors and the cities", page: "Home" },
  HOME_BOTTOM: { label: "Home — above the sign-off", hint: "Just above the closing call to action at the foot of the home page", page: "Home" },
  DIRECTORY_TOP: { label: "Directory — top", hint: "Above the vendor list on /salons and /[city]/salons", page: "Directory" },
  DIRECTORY_INLINE: { label: "Directory — in the list", hint: "Between vendor cards, after the position you choose", page: "Directory" },
  STOREFRONT_TOP: { label: "Storefront — under the profile", hint: "Under a vendor's name and photos on every /pro page", page: "Storefront" },
  STOREFRONT_FOOTER: { label: "Storefront — footer", hint: "Under the reviews and opening hours on every /pro page", page: "Storefront" },
} as const;
export type AdSlot = keyof typeof AD_SLOTS;
export const AD_SLOT_KEYS = Object.keys(AD_SLOTS) as [AdSlot, ...AdSlot[]];

/** Size presets. CUSTOM takes whatever width and height the admin types. */
export const AD_SIZES = {
  BANNER: { label: "Wide banner", width: 1400, height: 400 },
  LEADERBOARD: { label: "Slim strip", width: 1400, height: 200 },
  FEATURE: { label: "Tall feature", width: 1400, height: 600 },
  CARD: { label: "Card (matches a vendor card)", width: 640, height: 480 },
  SQUARE: { label: "Square", width: 600, height: 600 },
  CUSTOM: { label: "Custom size", width: 0, height: 0 },
} as const;
export type AdSize = keyof typeof AD_SIZES;
export const AD_SIZE_KEYS = Object.keys(AD_SIZES) as [AdSize, ...AdSize[]];

export const AD_WIDTH = { min: 200, max: 2000 } as const;
export const AD_HEIGHT = { min: 80, max: 1200 } as const;

/** Where the ad sits across the column when it is narrower than it. */
export const AD_ALIGNS = { LEFT: "Left", CENTER: "Centre", RIGHT: "Right" } as const;
export type AdAlign = keyof typeof AD_ALIGNS;
export const AD_ALIGN_KEYS = Object.keys(AD_ALIGNS) as [AdAlign, ...AdAlign[]];

/** Where the headline sits on the ad. HIDDEN is for artwork with its own words. */
export const AD_TEXT_POSITIONS = {
  BOTTOM_LEFT: "Bottom left",
  BOTTOM_CENTER: "Bottom centre",
  CENTER: "Middle",
  TOP_LEFT: "Top left",
  HIDDEN: "Hidden (image has its own text)",
} as const;
export type AdTextPosition = keyof typeof AD_TEXT_POSITIONS;
export const AD_TEXT_POSITION_KEYS = Object.keys(AD_TEXT_POSITIONS) as [AdTextPosition, ...AdTextPosition[]];

/** COVER fills the box and may crop; CONTAIN shows the whole image. */
export const AD_FITS = { COVER: "Fill the box (may crop edges)", CONTAIN: "Show the whole image" } as const;
export type AdFit = keyof typeof AD_FITS;
export const AD_FIT_KEYS = Object.keys(AD_FITS) as [AdFit, ...AdFit[]];

export const AD_DEVICES = { ALL: "Phones and computers", MOBILE: "Phones and tablets only", DESKTOP: "Computers only" } as const;
export type AdDevice = keyof typeof AD_DEVICES;
export const AD_DEVICE_KEYS = Object.keys(AD_DEVICES) as [AdDevice, ...AdDevice[]];

/** In-list slots: shown after this many vendor cards. */
export const AD_LIST_POSITION = { min: 1, max: 50 } as const;

export interface AdLayout {
  width: number;
  height: number;
  align: AdAlign;
  textPosition: AdTextPosition;
  imageFit: AdFit;
}

/** The dimensions a size stands for: the preset's, or the custom ones. */
export function sizeDimensions(size: AdSize, custom: { width: number; height: number }) {
  const preset = AD_SIZES[size];
  return size === "CUSTOM" || preset.width === 0 ? custom : { width: preset.width, height: preset.height };
}

const clamp = (value: number, range: { min: number; max: number }) =>
  Math.round(Math.min(range.max, Math.max(range.min, Number.isFinite(value) ? value : range.min)));

/** The box an ad is drawn in: its width cap, its proportions and its alignment. */
export function adBoxStyle(layout: Pick<AdLayout, "width" | "height" | "align">): CSSProperties {
  const width = clamp(layout.width, AD_WIDTH);
  const height = clamp(layout.height, AD_HEIGHT);
  return {
    width: "100%",
    maxWidth: `${width}px`,
    aspectRatio: `${width} / ${height}`,
    marginLeft: layout.align === "LEFT" ? 0 : "auto",
    marginRight: layout.align === "RIGHT" ? 0 : "auto",
  };
}

/** The ImageKit transform for an ad image at its size, sharp on high-density screens. */
export function adImageSrc(imageUrl: string, layout: Pick<AdLayout, "width" | "height" | "imageFit">): string {
  const width = clamp(layout.width, AD_WIDTH);
  const height = clamp(layout.height, AD_HEIGHT);
  const crop = layout.imageFit === "CONTAIN" ? ",c-at_max" : ",fo-auto";
  return `${imageUrl}?tr=w-${width},h-${height}${crop},dpr-2`;
}

/** Tailwind classes that show an ad only on the devices it targets. */
export function deviceClass(device: AdDevice): string {
  return device === "MOBILE" ? "lg:hidden" : device === "DESKTOP" ? "hidden lg:block" : "";
}
