import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components, route handlers and server actions.
 *
 * Used for identity only. Application data is never read through PostgREST —
 * it goes through Prisma on the server, so the publishable key grants no
 * data access even if it is extracted from the browser bundle.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies. Safe to ignore: the
            // proxy refreshes the session on every request instead.
          }
        },
      },
    },
  );
}
