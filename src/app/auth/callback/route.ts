import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { safeNext } from "@/lib/auth/safe-next";

export const dynamic = "force-dynamic";

/**
 * Where Supabase returns after an email confirmation, a sign-in link or
 * Google sign-in.
 *
 * Exchanges the one-time code for a session cookie, then forwards to wherever
 * the user was heading.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // Only same-site paths: `next` is attacker-writable, and "//evil.example"
  // would otherwise turn a real sign-in link into a redirect off-site.
  const next = safeNext(url.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  return NextResponse.redirect(
    new URL("/sign-in?error=link-expired", url.origin),
  );
}
