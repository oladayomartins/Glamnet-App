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
    // Sourced from the design tokens in globals.css.
    background_color: "#fdfbf9",
    theme_color: "#542a50",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
