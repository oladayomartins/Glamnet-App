import type { MetadataRoute } from "next";

/** PWA manifest — GLAMNET is delivered as an installable web app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GLAMNET",
    short_name: "GLAMNET",
    description:
      "Book vetted beauty professionals at your door. Emergency bookings within 12 hours.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Sourced from the design tokens in globals.css. The manifest spec takes
    // plain hex, so these are sRGB equivalents of --glam-canvas (light) and
    // --glam-rose-700 (light) — update them together with the tokens.
    background_color: "#fbfaf7",
    theme_color: "#7a3b32",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
