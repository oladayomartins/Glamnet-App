import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

/**
 * Never prerender this route. It reads the database, and a build-time attempt
 * would fail wherever one is not configured — the same trap that took the root
 * layout down.
 */
export const dynamic = "force-dynamic";

/**
 * Describe the datasource without ever revealing the credential.
 *
 * Only the host, port, username and query-parameter names are reported. Those
 * are not secrets — the project ref appears in every Supabase URL, and the
 * pooler is shared infrastructure — but they are exactly what a malformed
 * connection string gets wrong, so surfacing them turns "unreachable" from a
 * guessing game into a single readable answer. The password is never touched.
 */
function describeDatasource(url: string | undefined) {
  if (!url) return null;

  if (!/^postgres(ql)?:\/\//.test(url)) {
    return {
      parsed: false,
      problem: "Does not start with postgresql:// or postgres://",
    };
  }

  try {
    const parsed = new URL(url);
    const host = decodeURIComponent(parsed.hostname);
    return {
      parsed: true,
      host,
      port: parsed.port || "(default)",
      username: decodeURIComponent(parsed.username),
      database: parsed.pathname.replace(/^\//, ""),
      params: [...parsed.searchParams.keys()],
      // A placeholder left in the value is the most common paste mistake, and
      // it surfaces here as an unresolvable host rather than a vague timeout.
      looksLikePlaceholder: /[<>\[\]{}\s]/.test(host) || host.toUpperCase() === host && /[A-Z_]/.test(host),
    };
  } catch {
    return {
      parsed: false,
      problem: "Not a parseable URL — check for stray quotes, spaces or angle brackets",
    };
  }
}

/**
 * GET /api/health — deployment diagnostics.
 *
 * Reports whether the datasource is configured and reachable, and whether the
 * schema is actually populated. Deliberately reports booleans, counts and an
 * error *code* only: connection strings carry the database password, so
 * nothing derived from them is ever echoed, and the Prisma message is dropped
 * because P1001 embeds the host and port.
 *
 * 200 when the database answers, 503 when it does not, so uptime checks can
 * use the status alone.
 */
export async function GET() {
  const databaseUrlConfigured = Boolean(process.env.DATABASE_URL);
  const directUrlConfigured = Boolean(process.env.DIRECT_URL);

  const base = {
    databaseUrlConfigured,
    directUrlConfigured,
    datasource: describeDatasource(process.env.DATABASE_URL),
    checkedAt: new Date().toISOString(),
  };

  if (!databaseUrlConfigured) {
    return NextResponse.json(
      {
        ...base,
        status: "misconfigured",
        canQuery: false,
        hint: "DATABASE_URL is not set on this deployment. Environment variables are applied at deploy time, so add it and redeploy.",
      },
      { status: 503 },
    );
  }

  try {
    const [hubs, services, providers, bookings, pricingConfigs] =
      await Promise.all([
        prisma.hub.count(),
        prisma.service.count(),
        prisma.provider.count(),
        prisma.booking.count(),
        prisma.emergencyPricingConfig.count(),
      ]);

    const seeded = hubs > 0 && services > 0 && providers > 0;

    return NextResponse.json({
      ...base,
      status: seeded ? "ok" : "empty",
      canQuery: true,
      counts: { hubs, services, providers, bookings, pricingConfigs },
      ...(seeded
        ? {}
        : { hint: "Connected, but the schema has no seed data." }),
    });
  } catch (error) {
    // Report the code only — the message embeds host and port.
    const code =
      typeof error === "object" && error !== null && "errorCode" in error
        ? String((error as { errorCode?: unknown }).errorCode ?? "")
        : "";
    const name = error instanceof Error ? error.name : "UnknownError";

    return NextResponse.json(
      {
        ...base,
        status: "unreachable",
        canQuery: false,
        error: { name, code: code || null },
        hint: "DATABASE_URL is set but the database did not answer. Check the host, port and password, and that the pooler hostname matches the one in the Supabase Connect panel.",
      },
      { status: 503 },
    );
  }
}
