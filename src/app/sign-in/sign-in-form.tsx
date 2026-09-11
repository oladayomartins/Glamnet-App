"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { Button } from "@/components/ui";

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      // Deliberately not "no account with that email": that would let anyone
      // enumerate which addresses are registered.
      setError("Those details did not match an account.");
      setBusy(false);
      return;
    }

    // Full reload so server components pick up the new session cookie.
    router.replace(next);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-ink">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded-glam-sm border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">Password</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-glam-sm border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400"
        />
      </label>

      {error ? (
        <p
          role="alert"
          className="rounded-glam border-l-4 border-warning bg-sunken p-3 text-sm text-ink"
        >
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
