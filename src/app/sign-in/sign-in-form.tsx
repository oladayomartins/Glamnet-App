"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EnvelopeSimple, Eye, EyeSlash } from "@phosphor-icons/react";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { Button } from "@/components/ui";
import { callbackUrl, FormError, GoogleButton, inputClass } from "@/components/auth-controls";

/**
 * Email-first sign-in.
 *
 * The default is a one-tap sign-in link by email, because a forgotten
 * password is the commonest reason a returning customer never comes back.
 * "Use a password instead" is one tap away for people who prefer it, and
 * Google sits above both when it is switched on.
 *
 * Neither path says whether an email is registered: the link step always
 * reports "check your inbox", and a failed password is "those details did
 * not match". Anything more specific lets anyone list who has an account.
 */
export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"link" | "password">("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const sendLink = async () => {
    const { error: otpError } = await createSupabaseBrowserClient().auth.signInWithOtp({
      email: email.trim(),
      // Sign-in never creates an account; that is what sign-up is for.
      options: { shouldCreateUser: false, emailRedirectTo: callbackUrl(next) },
    });
    // A rate limit is worth reporting; "no such user" is deliberately not.
    if (otpError && otpError.status === 429) {
      setError("Too many links requested. Wait a minute and try again.");
      return;
    }
    setSentTo(email.trim());
  };

  const signInWithPassword = async () => {
    const { error: signInError } = await createSupabaseBrowserClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError("Those details did not match an account.");
      return;
    }
    router.replace(next);
    router.refresh();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await (mode === "link" ? sendLink() : signInWithPassword());
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <div className="rounded-glam border border-line bg-surface p-5 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <EnvelopeSimple size={22} weight="fill" aria-hidden />
        </span>
        <h2 className="mt-3 font-display text-lg font-semibold text-ink">Check your inbox</h2>
        <p className="mt-1.5 text-sm text-ink-muted">
          If there is a GLAMNET account for <strong className="text-ink">{sentTo}</strong>, a sign-in
          link is on its way. It works once and expires in an hour.
        </p>
        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="tap-44 mt-3 text-sm font-semibold text-accent-700 hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div>
      <GoogleButton next={next} />

      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="sr-only">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </label>

        {mode === "password" ? (
          <label className="relative block">
            <span className="sr-only">Password</span>
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={`${inputClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-[calc(50%-2px)] items-center justify-center text-ink-muted hover:text-ink"
            >
              {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
            </button>
          </label>
        ) : null}

        <FormError>{error}</FormError>

        <Button type="submit" disabled={busy} className="w-full min-h-12">
          {busy
            ? mode === "link"
              ? "Sending…"
              : "Signing in…"
            : mode === "link"
              ? "Email me a sign-in link"
              : "Sign in"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode((current) => (current === "link" ? "password" : "link"));
          setError(null);
        }}
        className="tap-44 mt-3 w-full text-center text-sm text-ink-muted hover:text-ink"
      >
        {mode === "link" ? "Use a password instead" : "Email me a link instead"}
      </button>
    </div>
  );
}
