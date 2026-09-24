"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { Button, Card } from "@/components/ui";

interface Hub {
  id: string;
  name: string;
  sector: string;
  city: string;
}

type Intent = "CUSTOMER" | "PROVIDER";

export function SignUpForm({
  hubs,
  initialIntent = "CUSTOMER",
}: {
  hubs: Hub[];
  /** Preselected when arriving from the vendor landing page. */
  initialIntent?: Intent;
}) {
  const router = useRouter();
  const [intent, setIntent] = useState<Intent>(initialIntent);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hubId, setHubId] = useState(hubs[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }

    setBusy(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // A request, not a grant. The server only honours CUSTOMER or
        // PROVIDER from here, and a new vendor starts PENDING.
        data: { role: intent, name: name.trim(), hubId },
        // Vendors go straight into the storefront wizard.
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${
          intent === "PROVIDER" ? "/provider/onboarding" : "/account"
        }`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setBusy(false);
      return;
    }

    // No session means the project requires email confirmation first.
    if (!data.session) {
      setCheckEmail(true);
      setBusy(false);
      return;
    }

    router.replace(intent === "PROVIDER" ? "/provider/onboarding" : "/account");
    router.refresh();
  };

  if (checkEmail) {
    return (
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">
          Check your email
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          We have sent a confirmation link to <strong>{email}</strong>. Open it
          to finish setting up your account.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset>
        <legend className="text-sm font-medium text-ink">I want to</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(
            [
              ["CUSTOMER", "Book services", "Find a vendor near me"],
              ["PROVIDER", "Work as a vendor", "Take bookings on your hours"],
            ] as const
          ).map(([value, label, hint]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-glam border p-3 transition ${
                intent === value
                  ? "border-brand-700 bg-brand-50"
                  : "border-line bg-surface hover:border-brand-200"
              }`}
            >
              <input
                type="radio"
                name="intent"
                className="sr-only"
                checked={intent === value}
                onChange={() => setIntent(value)}
              />
              <span className="block text-sm font-semibold text-ink">{label}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">{hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-medium text-ink">Your name</span>
        <input
          required
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 min-h-11 w-full rounded-glam-input border border-line bg-surface px-3 py-2 text-[15px] outline-none transition duration-[180ms] focus:border-brand-400"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 min-h-11 w-full rounded-glam-input border border-line bg-surface px-3 py-2 text-[15px] outline-none transition duration-[180ms] focus:border-brand-400"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">Password</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 min-h-11 w-full rounded-glam-input border border-line bg-surface px-3 py-2 text-[15px] outline-none transition duration-[180ms] focus:border-brand-400"
        />
        <span className="mt-1 block text-xs text-ink-muted">
          At least 8 characters.
        </span>
      </label>

      {intent === "PROVIDER" ? (
        <>
          <label className="block">
            <span className="text-sm font-medium text-ink">
              Which Beauty Hub do you cover?
            </span>
            <select
              value={hubId}
              onChange={(event) => setHubId(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-glam-input border border-line bg-surface px-3 py-2 text-[15px] outline-none transition duration-[180ms] focus:border-brand-400"
            >
              {hubs.map((hub) => (
                <option key={hub.id} value={hub.id}>
                  {hub.name} ({hub.sector}) · {hub.city}
                </option>
              ))}
            </select>
          </label>

          <Card className="border-l-4 border-l-warning p-3">
            <p className="text-sm text-ink">
              Professional accounts are reviewed before going live. You will be
              able to set your services and working hours straight away, and
              will start receiving booking requests once approved.
            </p>
          </Card>
        </>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-glam border-l-4 border-warning bg-sunken p-3 text-sm text-ink"
        >
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
