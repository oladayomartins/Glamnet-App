"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Theme switching by `data-theme` on <html>, matching the token layer in
 * globals.css.
 *
 * One variable set, two values — never two stylesheets (brand guide §12).
 * `next-themes` writes the attribute in a blocking script before first paint,
 * so the correct mode is applied with no flash on load.
 *
 * Light is the default and the OS preference is not followed. The marketplace
 * is the first thing most visitors see and it is designed light — photography
 * on cream, obsidian kept for the footer and the emergency states — so a
 * visitor whose laptop happens to be in dark mode should not meet a different
 * product than the one the brand was designed as. Dark remains a deliberate
 * choice, one tap away in the header, and is remembered once made.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      themes={["light", "dark"]}
      enableSystem={false}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
