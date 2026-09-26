"use client";

import { ArrowRight, Camera, CurrencyGbp, IdentificationCard, LockKey, MapPin, Scissors, Sparkle } from "@phosphor-icons/react";

const PERKS = [
  { icon: CurrencyGbp, title: "0% commission on your clients", body: "Anyone who books through your own link pays you everything, minus a 2% card fee." },
  { icon: LockKey, title: "Paid by PIN, never chased", body: "The client's card is held when they book. Their 4-digit PIN releases it to your bank." },
  { icon: MapPin, title: "Found by clients near you", body: "Your storefront shows up for people searching nearby, anywhere in the UK." },
] as const;

const NEEDS = [
  { icon: Camera, text: "A profile photo and three photos of your work" },
  { icon: Scissors, text: "The services you offer, with your prices" },
  { icon: IdentificationCard, text: "Your insurance certificate or licence" },
] as const;

/**
 * The first thing a brand-new pro sees: what GLAMNET does for them, what the
 * set-up asks for, and one button to start. Shown once, before step one.
 */
export function WelcomeIntro({ name, onStart }: { name: string; onStart: () => void }) {
  const firstName = name.trim().split(/\s+/)[0] || "there";
  return (
    <div data-page-width="wide" className="mx-auto max-w-3xl pb-10">
      <section className="rise-in overflow-hidden rounded-glam-lg border border-accent-500/40 bg-[radial-gradient(90%_120%_at_0%_0%,color-mix(in_oklab,var(--glam-gold)_22%,transparent),transparent_70%)] bg-surface p-6 sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent-100/60 px-3 py-1 text-xs font-semibold text-accent-700">
          <Sparkle size={14} weight="fill" aria-hidden /> Welcome to GLAMNET
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-[-0.025em] text-ink sm:text-[2.6rem]">
          Hi {firstName}, let&rsquo;s get your storefront live.
        </h1>
        <p className="mt-3 max-w-xl text-[15px] text-ink-muted">
          It takes about five minutes. Everything saves as you go, so you can stop and come back whenever you like.
        </p>
        <button
          type="button"
          onClick={onStart}
          className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-metal px-7 text-sm font-bold text-metal-ink shadow-card transition duration-[180ms] ease-glam hover:brightness-105 active:scale-[0.98]"
        >
          Let&rsquo;s build my storefront <ArrowRight size={16} weight="bold" aria-hidden />
        </button>
      </section>

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        {PERKS.map(({ icon: Icon, title, body }, at) => (
          <div
            key={title}
            style={{ animationDelay: `${120 + at * 80}ms` }}
            className="rise-in rounded-glam border border-line bg-surface p-5"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-metal text-metal-ink">
              <Icon size={20} weight="bold" aria-hidden />
            </span>
            <p className="mt-3 font-display font-semibold text-ink">{title}</p>
            <p className="mt-1 text-sm text-ink-muted">{body}</p>
          </div>
        ))}
      </section>

      <section className="rise-in mt-8 rounded-glam border border-line bg-surface p-5 sm:p-6" style={{ animationDelay: "380ms" }}>
        <p className="font-display font-semibold text-ink">Have these handy</p>
        <ul className="mt-3 space-y-2.5">
          {NEEDS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-ink">
              <Icon size={18} className="shrink-0 text-accent-700" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-ink-muted">
          Don&rsquo;t have everything yet? Start anyway — you can add photos and documents later.
        </p>
      </section>
    </div>
  );
}
