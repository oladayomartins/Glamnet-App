import type { MetadataRoute } from "next";

/** PWA manifest — GLAMNET is delivered as an installable web app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GLAMNET",
    short_name: "GLAMNET",
    description:
      "The UK's marketplace for the Black and Asian beauty community — find and book verified pros at their home salon, private room or chair, or get one to you at short notice.",
    start_url: "/",
    id: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "en-GB",
    dir: "ltr",
    categories: ["lifestyle", "beauty", "shopping"],
    prefer_related_applications: false,
    // Tapping the icon or a notification brings the open app to the front
    // rather than starting a second copy (Chrome and Edge; others ignore it).
    launch_handler: { client_mode: ["navigate-existing", "auto"] },
    // Sourced from the design tokens in globals.css: Obsidian Black
    // (--glam-canvas, dark) for the splash screen and status bar — update
    // them together with the tokens.
    background_color: "#121212",
    theme_color: "#121212",
    // The "GN" tile, cut from the brand favicon (see public/brand/): installing
    // (and so push on iPhone)
    // needs raster icons, and "maskable" lets Android crop to its own shape.
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the app icon (Android, Windows, macOS) for these.
    shortcuts: [
      { name: "Find a pro", short_name: "Find a pro", url: "/salons", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Book a service", short_name: "Book", url: "/search", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "My bookings", short_name: "Bookings", url: "/account", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Vendor dashboard", short_name: "Dashboard", url: "/provider", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
