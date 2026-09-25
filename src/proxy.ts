import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on each request.
 *
 * Session refresh only — deliberately not the authorisation layer. Next's own
 * guidance is that proxy should not be used for authorisation, and it would be
 * the wrong place regardless: a redirect here is cosmetic, and anything that
 * matters must be re-checked where the data is read. Every protected page
 * calls requireRole() and every mutating route calls requireApiRole(), so
 * removing this file would cost users a re-login, not a security boundary.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Auth not configured yet: pass through rather than 500 the whole site.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Touching getUser() is what performs the refresh and rewrites the cookie.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Skip static assets and image optimisation: refreshing a session for a
  // font or an icon is wasted work on every page load. Stripe's webhooks
  // carry no session either.
  matcher: [
    "/((?!_next/static|_next/image|api/webhooks|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
