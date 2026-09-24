import type { MetadataRoute } from "next";

/** PWA manifest — GLAMNET is delivered as an installable web app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GLAMNET",
    short_name: "GLAMNET",
    description:
      "Find and book verified independent beauty pros — home salons, private rooms and chairs — or get one to you at short notice.",
    start_url: "/",
    id: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Sourced from the design tokens in globals.css: Obsidian Black
    // (--glam-canvas, dark) for the splash screen and status bar — update
    // them together with the tokens.
    background_color: "#121212",
    theme_color: "#121212",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
