import { createBrowserClient } from "@supabase/ssr";

/** Supabase client for Client Components — sign-in, sign-up, sign-out. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
