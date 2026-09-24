"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

/**
 * Pieces shared by the sign-in and sign-up forms.
 *
 * Google sign-in only appears when NEXT_PUBLIC_GOOGLE_AUTH=true, because it
 * needs the Google provider switched on in the Supabase dashboard first — a
 * button that always shows but fails with "provider is not enabled" would be
 * worse than no button.
 */
export const googleAuthEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH === "true";

export const inputClass =
  "mt-1 min-h-12 w-full rounded-glam-input border border-line bg-surface px-3.5 text-[15px] text-ink outline-none transition duration-[180ms] placeholder:text-ink-muted/70 focus:border-accent-500";

/** Where Supabase should send the browser back to after an email link or OAuth. */
export function callbackUrl(next: string): string {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export function GoogleButton({ next, label = "Continue with Google" }: { next: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!googleAuthEnabled) return null;

  const start = async () => {
    setBusy(true);
    setError(null);
    const { error: oauthError } = await createSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl(next) },
    });
    if (oauthError) {
      setError("Google sign-in is not available right now. Use your email instead.");
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-line bg-surface text-[15px] font-semibold text-ink transition duration-[180ms] ease-glam hover:border-accent-500 disabled:opacity-60"
      >
        <GoogleMark />
        {busy ? "Opening Google…" : label}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-warning">
          {error}
        </p>
      ) : null}
      <Divider>or continue with email</Divider>
    </>
  );
}

export function Divider({ children }: { children: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-ink-muted">
      <span className="h-px flex-1 bg-line" />
      {children}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function FormError({ children }: { children: string | null }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-glam border-l-4 border-warning bg-sunken p-3 text-sm text-ink">
      {children}
    </p>
  );
}

/** Google's "G", drawn inline so there is no third-party request. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
