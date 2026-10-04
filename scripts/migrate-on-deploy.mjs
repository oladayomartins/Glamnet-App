/**
 * The first half of `npm run build`: apply pending migrations, but only where
 * the build is about to go live.
 *
 * Vercel sets VERCEL_ENV on every build. A preview build is an unmerged branch,
 * so it must never apply that branch's migrations to a shared database — and
 * Preview has no DIRECT_URL, so trying fails the build outright. Builds outside
 * Vercel (no VERCEL_ENV) still migrate, as before.
 */
import { spawnSync } from "node:child_process";

const env = process.env.VERCEL_ENV;
if (env && env !== "production") {
  console.log(`Skipping prisma migrate deploy on a ${env} build.`);
  process.exit(0);
}

const result = spawnSync("prisma", ["migrate", "deploy"], { stdio: "inherit", shell: true });
process.exit(result.status ?? 1);
