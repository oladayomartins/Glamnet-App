import { NextResponse } from "next/server";
import { getSessionUser, isSessionSuspended, type Role, type SessionUser } from "./session";

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

  if (!user && (await isSessionSuspended())) {
    return {
      response: NextResponse.json(
        { error: { code: "ACCOUNT_SUSPENDED", message: "This account has been suspended." } },
        { status: 403 },
      ),
    };
  }

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

/**
 * A signed-in vendor, approved or not — for the Pro Portal, where a pending
 * applicant has to be able to build their storefront before review.
 */
export async function requireApiVendor(): Promise<
  { providerId: string; user: SessionUser } | { response: NextResponse }
> {
  const auth = await requireApiRole(["PROVIDER"]);
  if ("response" in auth) return auth;
  if (!auth.user.providerId) {
    return {
      response: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No vendor profile on this account." } },
        { status: 403 },
      ),
    };
  }
  return { providerId: auth.user.providerId, user: auth.user };
}
