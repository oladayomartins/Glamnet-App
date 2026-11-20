"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle, Lightbulb, Warning } from "@phosphor-icons/react";
import { Button } from "@/components/ui";
import { Spinner } from "@/components/page-loader";
import { HELP_ARTICLES } from "@/lib/domain/help-articles";
import {
  ENQUIRER_ROLES,
  categoriesFor,
  categoryByValue,
  type EnquirerRole,
} from "@/lib/domain/support-enquiry";

const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";

const fieldClass =
  "mt-1.5 min-h-12 w-full rounded-glam-input border border-line bg-surface px-3.5 text-[15px] text-ink outline-none transition duration-[180ms] ease-glam placeholder:text-ink-muted/70 focus:border-accent-500 focus:ring-4 focus:ring-accent-500/15";

interface Initial {
  role: EnquirerRole;
  category: string;
  bookingRef: string;
  name: string;
  email: string;
}

/**
 * The support contact form.
 *
 * Three dropdowns narrow it down — who you are, what it's about, the topic —
 * each list depending on the one before. Picking a category suggests the
 * help articles that usually answer it, before anyone has to wait for a reply.
 *
 * On send it's saved by GLAMNET first (reference, confirmation email, admin
 * inbox); with a Web3Forms key it's then forwarded from the browser to
 * Web3Forms, whose free plan only accepts browser submissions.
 */
export function ContactForm({ initial, signedIn, web3FormsKey }: { initial: Initial; signedIn: boolean; web3FormsKey: string }) {
  const [role, setRole] = useState<EnquirerRole>(initial.role);
  const [category, setCategory] = useState(() =>
    categoriesFor(initial.role).some((entry) => entry.value === initial.category) ? initial.category : "",
  );
  const [topic, setTopic] = useState("");
  const [bookingRef, setBookingRef] = useState(initial.bookingRef);
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const categories = categoriesFor(role);
  const chosen = categoryByValue(category);
  const suggestions = chosen?.helpTopic
    ? HELP_ARTICLES.filter((article) => article.topic === chosen.helpTopic).slice(0, 3)
    : [];

  const changeRole = (next: EnquirerRole) => {
    setRole(next);
    // A category the new role can't pick would submit as invalid.
    if (!categoriesFor(next).some((entry) => entry.value === category)) {
      setCategory("");
      setTopic("");
    }
  };

  const submit = async () => {
    setError(null);
    if (!chosen || !topic) return setError("Choose what your message is about and a topic.");
    setBusy(true);
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, category, topic, bookingRef, name, email, message, website }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const issue = payload.error?.issues?.[0]?.message;
        throw new Error(issue ?? payload.error?.message ?? "We couldn't send that. Please try again.");
      }
      const reference: string = payload.reference;

      if (web3FormsKey) {
        // Saved already, so a Web3Forms hiccup costs nothing: it's in the
        // admin inbox either way.
        await fetch(WEB3FORMS_ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            access_key: web3FormsKey,
            subject: `${chosen.urgent ? "[URGENT] " : ""}${reference} · ${chosen.label}: ${topic}`,
            from_name: "GLAMNET support form",
            replyto: email,
            name,
            email,
            reference,
            who: ENQUIRER_ROLES.find((entry) => entry.value === role)?.label ?? role,
            category: chosen.label,
            topic,
            booking: chosen.askBooking ? bookingRef || "—" : "—",
            message,
            botcheck: website,
          }),
        }).catch(() => undefined);
      }
      setSent(reference);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't send that. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div role="status" className="rise-in rounded-glam border border-normal/50 bg-normal-soft p-6">
        <CheckCircle size={32} weight="fill" className="text-normal" aria-hidden />
        <h2 className="mt-3 font-display text-xl font-bold text-ink">Thanks — we&rsquo;ve got your message</h2>
        <p className="mt-2 text-[15px] text-ink">
          Your reference is <strong className="font-mono">{sent}</strong>. We&rsquo;ve emailed you a copy, and
          we&rsquo;ll reply to <strong>{email}</strong>, usually within one working day.
        </p>
        <Link href="/support" className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent-700">
          Back to the help centre <ArrowRight size={13} weight="bold" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="space-y-5 rounded-glam border border-line bg-surface p-5 sm:p-6"
    >
      <Field label="Who are you?">
        <select value={role} onChange={(event) => changeRole(event.target.value as EnquirerRole)} className={fieldClass}>
          {ENQUIRER_ROLES.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="What's it about?">
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setTopic("");
            }}
            className={fieldClass}
            required
          >
            <option value="" disabled>
              Choose one
            </option>
            {categories.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Topic">
          <select
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            className={fieldClass}
            disabled={!chosen}
            required
          >
            <option value="" disabled>
              {chosen ? "Choose one" : "Pick what it's about first"}
            </option>
            {chosen?.topics.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {chosen?.urgent ? (
        <p role="note" className="flex gap-2 rounded-glam border-l-4 border-emergency bg-sunken p-3 text-sm text-ink">
          <Warning size={18} weight="fill" className="mt-0.5 shrink-0 text-emergency" aria-hidden />
          If you&rsquo;re in danger right now, call 999. Safety reports go to the top of our queue.
        </p>
      ) : null}

      {suggestions.length > 0 ? (
        <div className="rounded-glam bg-sunken p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Lightbulb size={16} weight="fill" className="text-accent-500" aria-hidden />
            These usually answer it
          </p>
          <ul className="mt-2 space-y-1.5">
            {suggestions.map((article) => (
              <li key={article.slug}>
                <Link href={`/support/${article.slug}`} target="_blank" className="text-sm text-accent-700 hover:underline">
                  {article.title}
                </Link>
                <span className="text-sm text-ink-muted"> — {article.summary}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {chosen?.askBooking ? (
        <Field label="Booking reference (optional)" hint="From your booking page or confirmation email — it helps us find it fast.">
          <input value={bookingRef} onChange={(event) => setBookingRef(event.target.value)} maxLength={60} className={fieldClass} />
        </Field>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name">
          <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required maxLength={120} className={fieldClass} />
        </Field>
        <Field label="Email" hint={signedIn ? "We'll reply here." : undefined}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            maxLength={200}
            className={fieldClass}
          />
        </Field>
      </div>

      <Field label="Your message">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={6}
          required
          maxLength={5000}
          placeholder="What happened, and what would you like us to do?"
          className={`${fieldClass} py-3`}
        />
      </Field>

      {/* Hidden from people; bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
        </label>
      </div>

      {error ? (
        <p role="alert" className="rounded-glam border-l-4 border-warning bg-sunken p-3 text-sm text-ink">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={busy} className="w-full sm:w-auto">
        {busy ? <Spinner size={16} className="mr-2" /> : null}
        {busy ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-muted">{hint}</span> : null}
    </label>
  );
}
