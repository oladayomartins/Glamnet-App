import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

export const dynamic = "force-dynamic";

/**
 * Where Supabase returns after an email confirmation or magic link.
 *
 * Exchanges the one-time code for a session cookie, then forwards to wherever
 * the user was heading.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/account";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  return NextResponse.redirect(
    new URL("/sign-in?error=link-expired", url.origin),
  );
}
