import { NextResponse } from "next/server";
import type { SessionUser } from "./session";

/**
 * A vendor may only act on themselves; an admin may act on anyone.
 *
 * Shared because every vendor-scoped endpoint needs it and each one that
 * forgets is the same hole: the id in the path would otherwise be enough to
 * edit a competitor's calendar or take them out of the broadcast pool.
 *
 * Returns a response to send back, or null when the caller is allowed.
 */
export function requireOwnProvider(
  user: SessionUser,
  providerId: string,
): NextResponse | null {
  if (user.role === "ADMIN") return null;
  if (user.providerId === providerId) return null;

  return NextResponse.json(
    {
      error: {
        code: "FORBIDDEN",
        message: "You can only change your own details.",
      },
    },
    { status: 403 },
  );
}
