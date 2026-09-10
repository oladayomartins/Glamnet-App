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

  // Characters that break a connection string and are easy to paste by
  // accident. Reported as codepoints because several are invisible: a
  // non-breaking space copied from a rendered web page looks identical to a
  // normal one and is the classic cause of "invalid domain character".
  const suspicious = [...new Set(Array.from(url))]
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return (
        code < 0x20 || // control characters, including newline and tab
        code === 0x7f ||
        code > 0x7e || // anything non-ASCII, e.g. NBSP or a smart quote
        "<>[]{}\"'`\\ ".includes(ch)
      );
    })
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      const name =
        code === 0x20 ? "SPACE"
        : code === 0x0a ? "NEWLINE"
        : code === 0x0d ? "CARRIAGE RETURN"
        : code === 0x09 ? "TAB"
        : code === 0xa0 ? "NON-BREAKING SPACE"
        : code > 0x7e ? "NON-ASCII"
        : `'${ch}'`;
      return `U+${code.toString(16).toUpperCase().padStart(4, "0")} ${name}`;
    });

  // Everything after the final "@" is host, port, database and parameters —
  // no credential — so it is safe to echo, and it is exactly where an
  // unreplaced placeholder shows up.
  const at = url.lastIndexOf("@");
  const afterCredentials = at === -1 ? null : url.slice(at + 1);

  const shape = {
    length: url.length,
    afterCredentials,
    suspiciousCharacters: suspicious.length ? suspicious : null,
  };

  if (!/^postgres(ql)?:\/\//.test(url)) {
    return {
      ...shape,
      parsed: false,
      problem: "Does not start with postgresql:// or postgres://",
    };
  }

  try {
    const parsed = new URL(url);
    const host = decodeURIComponent(parsed.hostname);
    return {
      ...shape,
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
      ...shape,
      parsed: false,
      problem:
        "Starts with postgresql:// but is not a parseable URL. Check afterCredentials and suspiciousCharacters below.",
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
    vercelEnv: process.env.VERCEL_ENV ?? null,
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
    const name = error instanceof Error ? error.name : "UnknownError";
    const raw = error instanceof Error ? error.message : "";

    // Classify rather than echo. Prisma distinguishes "cannot reach the host"
    // from "the credentials were rejected", and that is exactly the fork
    // between a wrong pooler hostname and a wrong password — but the raw text
    // is long and quotes the connection target, so it is reduced to a verdict.
    const reason =
      /can'?t reach|could not connect|timed out|ECONNREFUSED|ENOTFOUND/i.test(raw)
        ? "HOST_UNREACHABLE"
        : /authentication failed|password authentication|role .* does not exist/i.test(raw)
          ? "AUTH_FAILED"
          : /database .* does not exist/i.test(raw)
            ? "DATABASE_NOT_FOUND"
            : /Tenant or user not found/i.test(raw)
              ? "POOLER_REJECTED_USER"
              : "UNKNOWN";

    const guidance = {
      HOST_UNREACHABLE:
        "The hostname does not answer on that port. Try the other pooler prefix (aws-0 <-> aws-1), or copy the host from the Supabase Connect panel.",
      AUTH_FAILED:
        "The host answered and rejected the credentials. The password is wrong, or the username is missing the project ref (it must be postgres.<ref> on the pooler).",
      DATABASE_NOT_FOUND:
        "Connected, but that database name does not exist. It should be 'postgres'.",
      POOLER_REJECTED_USER:
        "The pooler did not recognise the user. This is usually the wrong pooler hostname for this project, or a username without the project ref.",
      UNKNOWN: "Unrecognised connection failure.",
    }[reason];

    const code =
      typeof error === "object" && error !== null && "errorCode" in error
        ? String((error as { errorCode?: unknown }).errorCode ?? "")
        : "";

    return NextResponse.json(
      {
        ...base,
        status: "unreachable",
        canQuery: false,
        error: { name, code: code || null, reason },
        hint: guidance,
      },
      { status: 503 },
    );
  }
}
