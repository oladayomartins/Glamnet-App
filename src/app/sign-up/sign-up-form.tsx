"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, EnvelopeSimple, Eye, EyeSlash, Scissors, ShoppingBag } from "@phosphor-icons/react";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { Button } from "@/components/ui";
import { callbackUrl, FormError, GoogleButton, inputClass } from "@/components/auth-controls";
import { PostcodeField, type ResolvedPlace } from "@/components/postcode-field";
import { track } from "@/lib/analytics";

type Intent = "CUSTOMER" | "PROVIDER";

export function SignUpForm({
  initialIntent = "CUSTOMER",
}: {
  /** Preselected when arriving from the vendor landing page. */
  initialIntent?: Intent;
}) {
  const router = useRouter();
  const [intent, setIntent] = useState<Intent>(initialIntent);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // A pro's base postcode: any in the UK. It places them in the directory;
  // only the area (e.g. "S10") is ever shown publicly.
  const [postcode, setPostcode] = useState("");
  const [place, setPlace] = useState<ResolvedPlace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const isVendor = intent === "PROVIDER";
  const destination = isVendor ? "/provider/onboarding" : "/account";
  const longEnough = password.length >= 8;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!longEnough) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (isVendor && !place?.postcode) {
      setError("Enter the postcode you work from, so clients near you can find you.");
      return;
    }

    setBusy(true);
    setError(null);

    const { data, error: signUpError } = await createSupabaseBrowserClient().auth.signUp({
      email: email.trim(),
      password,
      options: {
        // A request, not a grant. The server only honours CUSTOMER or
        // PROVIDER from here, and a new vendor starts PENDING.
        data: { role: intent, name: name.trim(), ...(isVendor && place?.postcode ? { postcode: place.postcode } : {}) },
        emailRedirectTo: callbackUrl(destination),
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setBusy(false);
      return;
    }

    // Counted when the account is created, confirmed email or not: the two
    // sides of the marketplace are told apart by user_type.
    track("sign_up", { method: "email", user_type: isVendor ? "vendor" : "customer" });

    // No session means the project requires email confirmation first.
    if (!data.session) {
      setCheckEmail(true);
      setBusy(false);
      return;
    }

    router.replace(destination);
    router.refresh();
  };

  if (checkEmail) {
    return (
      <div className="rounded-glam border border-line bg-surface p-5 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <EnvelopeSimple size={22} weight="fill" aria-hidden />
        </span>
        <h2 className="mt-3 font-display text-lg font-semibold text-ink">Confirm your email</h2>
        <p className="mt-1.5 text-sm text-ink-muted">
          We sent a link to <strong className="text-ink">{email}</strong>. Open it to{" "}
          {isVendor ? "start building your storefront" : "finish setting up your account"}.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Which side of GLAMNET. Two big targets rather than a radio list. */}
      <div role="radiogroup" aria-label="I want to" className="mb-6 grid grid-cols-2 gap-2 rounded-full bg-sunken p-1 ring-1 ring-line">
        {(
          [
            ["CUSTOMER", "Book beauty", <ShoppingBag key="c" size={16} aria-hidden />],
            ["PROVIDER", "I'm a pro", <Scissors key="p" size={16} aria-hidden />],
          ] as const
        ).map(([value, label, icon]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={intent === value}
            onClick={() => setIntent(value)}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold transition duration-[180ms] ease-glam ${
              intent === value ? "bg-metal text-metal-ink shadow-card" : "text-ink-muted hover:text-ink"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* A Google account cannot carry the vendor role through sign-up, so
          pros register with email and go straight into the storefront wizard. */}
      {!isVendor ? <GoogleButton next={destination} label="Sign up with Google" /> : null}

      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="sr-only">{isVendor ? "Your name or business name" : "Your name"}</span>
          <input
            required
            autoComplete="name"
            placeholder={isVendor ? "Your name or business name" : "Your name"}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
          />
        </label>

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

        <div>
          <label className="relative block">
            <span className="sr-only">Password</span>
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Create a password"
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
          <p className={`mt-1.5 flex items-center gap-1.5 text-xs ${longEnough ? "text-normal-ink" : "text-ink-muted"}`}>
            <Check size={12} weight="bold" aria-hidden className={longEnough ? "" : "opacity-40"} />
            At least 8 characters
          </p>
        </div>

        {isVendor ? (
          <PostcodeField
            label="The postcode you work from"
            value={postcode}
            onChange={setPostcode}
            onResolved={setPlace}
            hint="Anywhere in the UK. Clients only ever see your area, like S10 — never your address."
          />
        ) : null}

        <FormError>{error}</FormError>

        <Button type="submit" disabled={busy} className="w-full min-h-12">
          {busy ? "Creating account…" : isVendor ? "Create my storefront" : "Create account"}
        </Button>

        <p className="text-center text-xs text-ink-muted">
          {isVendor
            ? "Next: your link, menu and documents. Your storefront goes live once we have checked your insurance or licence."
            : "Free to join. You only pay when you book, and your card is held until you're happy."}
        </p>

        {/* Applies to the Google button above too: either way, an account is made. */}
        <p className="text-center text-xs text-ink-muted">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="font-semibold text-ink underline-offset-4 hover:underline">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-semibold text-ink underline-offset-4 hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
