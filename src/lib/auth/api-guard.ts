import { NextResponse } from "next/server";
import { getSessionUser, type Role, type SessionUser } from "./session";

/**
 * Route-handler authorisation.
 *
 * Pages redirect; API routes must answer with a status code, so this returns
 * either the user or a response to send back. Every mutating endpoint is
 * expected to call it — an unauthenticated caller should never reach the
 * booking engine.
 */
export async function requireApiRole(
  roles: Role[],
): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const user = await getSessionUser();

  if (!user) {
    return {
      response: NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } },
        { status: 401 },
      ),
    };
  }

  if (!roles.includes(user.role)) {
    return {
      response: NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Your account does not have access to this.",
          },
        },
        { status: 403 },
      ),
    };
  }

  return { user };
}
