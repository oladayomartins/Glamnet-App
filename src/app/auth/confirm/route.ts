import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { safeNext } from "@/lib/auth/safe-next";

export const dynamic = "force-dynamic";

const TYPES: EmailOtpType[] = ["signup", "email", "magiclink", "recovery", "invite", "email_change"];

/**
 * GET /auth/confirm?token_hash=…&type=signup&next=/account
 *
 * The cross-device way to confirm an email or sign in by link. Unlike the
 * code exchange in /auth/callback it needs nothing stored in the browser, so
 * it works when the email is opened on another phone or in a mail app. Used
 * when the Supabase email templates link here (see docs/auth-emails.md).
 */
/**
 * The template's {{ .RedirectTo }} is the full callback URL the app asked for
 * ("https://…/auth/callback?next=/account"). Only a same-site URL is
 * unwrapped; anything else falls back to a safe default.
 */
function destination(raw: string | null, origin: string): string {
  if (raw && /^https?:\/\//i.test(raw)) {
    try {
      const target = new URL(raw);
      if (target.origin !== origin) return safeNext(null);
      return safeNext(target.searchParams.get("next") ?? target.pathname);
    } catch {
      return safeNext(null);
    }
  }
  return safeNext(raw);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = destination(url.searchParams.get("next"), url.origin);

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.warn("[auth] token verification failed", { code: error.code, message: error.message });
  }

  return NextResponse.redirect(
    new URL(`/sign-in?error=link-expired&next=${encodeURIComponent(next)}`, url.origin),
  );
}
