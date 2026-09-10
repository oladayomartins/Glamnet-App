/**
 * The token tables that back the handoff export in the brand guide.
 *
 * These mirror `app/tokens.css` deliberately: the CSS file is what ships to the
 * browser, this module is what generates the tokens.css / tailwind.config.js /
 * tokens.json artefacts devs copy into other repos. Keep them in step.
 */

export type TokenPair = readonly [name: string, value: string];

export const darkTokens: readonly TokenPair[] = [
  ["bg", "oklch(0.165 0.008 285)"],
  ["surface-1", "oklch(0.195 0.008 285)"],
  ["surface-2", "oklch(0.215 0.008 285)"],
  ["surface-3", "oklch(0.255 0.008 285)"],
  ["line", "oklch(0.30 0.010 285)"],
  ["text-1", "oklch(0.96 0.008 80)"],
  ["text-2", "oklch(0.74 0.010 80)"],
  ["rose", "oklch(0.80 0.075 34)"],
  ["champagne", "oklch(0.88 0.060 88)"],
  ["emergency", "oklch(0.62 0.21 22)"],
  ["live", "oklch(0.72 0.12 165)"],
] as const;

export const lightTokens: readonly TokenPair[] = [
  ["bg", "oklch(0.985 0.004 90)"],
  ["surface-1", "oklch(1 0 0)"],
  ["surface-2", "oklch(1 0 0)"],
  ["surface-3", "oklch(0.968 0.005 85)"],
  ["line", "oklch(0.905 0.006 85)"],
  ["text-1", "oklch(0.21 0.012 285)"],
  ["text-2", "oklch(0.45 0.010 285)"],
  ["rose", "oklch(0.55 0.100 28)"],
  ["champagne", "oklch(0.86 0.065 88)"],
  ["emergency", "oklch(0.545 0.205 25)"],
  ["live", "oklch(0.525 0.130 162)"],
] as const;

export const sharedTokens: readonly TokenPair[] = [
  [
    "metal",
    "linear-gradient(135deg, oklch(0.92 0.05 95) 0%, oklch(0.86 0.065 88) 34%, oklch(0.76 0.085 32) 100%)",
  ],
  ["radius-input", "6px"],
  ["radius-card", "18px"],
  ["gutter", "16px"],
  ["tap-min", "44px"],
  ["ease", "cubic-bezier(.22,.61,.36,1)"],
] as const;

export const TOKEN_FORMATS = ["css", "tailwind", "json"] as const;
export type TokenFormat = (typeof TOKEN_FORMATS)[number];

export const tokenFileName: Record<TokenFormat, string> = {
  css: "tokens.css",
  tailwind: "tailwind.config.js",
  json: "tokens.json",
};

/** Renders the token tables in the format a consuming repo needs. */
export function renderTokens(format: TokenFormat): string {
  if (format === "tailwind") {
    return (
      "theme: { extend: { colors: {\n" +
      darkTokens.map(([k]) => `  '${k}': 'var(--gn-${k})',`).join("\n") +
      "\n} } }\n\n// values per mode in tokens.css"
    );
  }

  if (format === "json") {
    const block = (pairs: readonly TokenPair[]) =>
      pairs.map(([k, v]) => `    "${k}": "${v}"`).join(",\n");
    return (
      "{\n" +
      `  "dark": {\n${block(darkTokens)}\n  },\n` +
      `  "light": {\n${block(lightTokens)}\n  },\n` +
      `  "shared": {\n${block(sharedTokens)}\n  }\n` +
      "}"
    );
  }

  const decls = (pairs: readonly TokenPair[]) =>
    pairs.map(([k, v]) => `  --gn-${k}: ${v};`).join("\n");
  return (
    `:root, [data-theme="dark"] {\n${decls(darkTokens)}\n${decls(sharedTokens)}\n}\n\n` +
    `[data-theme="light"] {\n${decls(lightTokens)}\n}`
  );
}
