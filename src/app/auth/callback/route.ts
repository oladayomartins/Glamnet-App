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
 *
 * The exchange (PKCE) only works in the browser that asked for the email: it
 * holds a secret cookie the code is checked against. Opening the email on a
 * phone, or inside the Gmail app's browser, lands here without that cookie.
 * By then Supabase has already confirmed the address, so that person is told
 * so and asked to sign in — never that a perfectly good link "expired".
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // Only same-site paths: `next` is attacker-writable, and "//evil.example"
  // would otherwise turn a real sign-in link into a redirect off-site.
  const next = safeNext(url.searchParams.get("next"));

  const toSignIn = (flag: "error=link-expired" | "notice=confirmed") =>
    NextResponse.redirect(
      new URL(`/sign-in?${flag}&next=${encodeURIComponent(next)}`, url.origin),
    );

  // Supabase itself refused the link (expired, already used, or opened by a
  // mail scanner first) and says so in the query string.
  if (url.searchParams.get("error") || url.searchParams.get("error_code")) {
    console.warn("[auth] link refused by Supabase", {
      error: url.searchParams.get("error_code") ?? url.searchParams.get("error"),
    });
    return toSignIn("error=link-expired");
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth
      .exchangeCodeForSession(code)
      .catch((cause: { code?: string; message?: string }) => ({ error: cause }));
    if (!error) return NextResponse.redirect(new URL(next, url.origin));

    console.warn("[auth] code exchange failed", { code: error.code, message: error.message });
    const otherBrowser =
      error.code === "pkce_code_verifier_not_found" ||
      error.code === "bad_code_verifier" ||
      /code[_ ]verifier/i.test(error.message ?? "");
    return toSignIn(otherBrowser ? "notice=confirmed" : "error=link-expired");
  }

  return toSignIn("error=link-expired");
}
