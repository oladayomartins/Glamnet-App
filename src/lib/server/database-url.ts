import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Resolves the datasource URL for the Prisma client.
 *
 * ---------------------------------------------------------------------------
 * PREVIEW-DEPLOY SHIM — not for production.
 * ---------------------------------------------------------------------------
 * The app uses SQLite so it runs with no external services. That works locally,
 * but a serverless filesystem is read-only apart from `/tmp`, so the seeded
 * database shipped with the build cannot be written in place.
 *
 * On Vercel, and only when the configured datasource is a SQLite file, the
 * bundled database is copied to `/tmp` on cold start and the client points at
 * the copy. Writes therefore live as long as the instance and are lost when it
 * recycles — which is fine for clicking through the UI, and is why this is a
 * preview shim rather than a deployment strategy.
 *
 * A real deployment sets `DATABASE_URL` to a Postgres connection string. The
 * schema was written to port by changing the datasource alone, and any URL that
 * is not `file:` passes straight through here untouched.
 */
export function resolveDatabaseUrl(): string | undefined {
  const configured = process.env.DATABASE_URL;

  // Not a serverless preview, or a real database is configured: change nothing.
  const isSqlite = !configured || configured.startsWith("file:");
  if (process.env.VERCEL !== "1" || !isSqlite) return configured;

  const bundled = path.join(process.cwd(), "prisma", "demo.db");
  const writable = "/tmp/glamnet-demo.db";

  if (!existsSync(writable)) {
    if (!existsSync(bundled)) {
      throw new Error(
        `Preview database missing at ${bundled}. The build should run ` +
          `\`prisma migrate deploy\` and \`prisma db seed\` before \`next build\`.`,
      );
    }
    copyFileSync(bundled, writable);
  }

  return `file:${writable}`;
}
