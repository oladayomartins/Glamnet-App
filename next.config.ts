import type { NextConfig } from "next";

/**
 * The ImageKit delivery host is the only permitted remote image source.
 *
 * Deliberately not a wildcard: customers supply reference images, and a
 * permissive pattern would let a booking render an arbitrary remote URL —
 * a tracking pixel that fires for every provider and admin who opens it.
 */
function imageKitHostname(): string | null {
  const endpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
  if (!endpoint) return null;
  try {
    return new URL(endpoint).hostname;
  } catch {
    return null;
  }
}

const hostname = imageKitHostname();

const nextConfig: NextConfig = {
  // The service worker must never be cached, or a fix to it could take days
  // to reach phones.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: hostname
      ? [{ protocol: "https", hostname, pathname: "/**" }]
      : [],
  },
};

export default nextConfig;
