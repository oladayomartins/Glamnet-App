import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * PREVIEW-DEPLOY SHIM — see src/lib/server/database-url.ts.
   *
   * The seeded SQLite file is data, not an import, so file tracing has no way
   * to discover it and would otherwise leave it out of the serverless bundle.
   * Every route needs it, because the root layout reads the pricing config.
   */
  outputFileTracingIncludes: {
    "/**": ["./prisma/demo.db"],
  },
};

export default nextConfig;
