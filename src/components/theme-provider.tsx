"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Theme switching by `data-theme` on <html>, matching the token layer in
 * globals.css.
 *
 * One variable set, two values — never two stylesheets (brand guide §12).
 * `next-themes` writes the attribute in a blocking script before first paint,
 * so the correct mode is applied with no flash on load. `enableSystem` means a
 * viewer who has never chosen gets their OS preference, and the attribute is
 * always present for the CSS to key on.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      themes={["light", "dark"]}
      enableSystem
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
