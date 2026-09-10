"use client";

import {
  Lightning,
  MapPin,
  ShieldCheck,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import { GlamNetPin, Wordmark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/guide/theme-toggle";
import { ProximityMap } from "@/components/map/proximity-map";
import { useTicker } from "@/lib/use-ticker";

const navLinks = [
  { href: "#foundations", label: "Foundations" },
  { href: "#components", label: "Components" },
  { href: "#emergency", label: "Emergency" },
  { href: "#motion", label: "Motion" },
  { href: "#stack", label: "Stack" },
];

export function GuideHeader() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3.5 pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <GlamNetPin
          size={32}
          className="shadow-[0_6px_18px_oklch(0.76_0.085_32_/_0.3)]"
        />
        <Wordmark size={19} />
        <div className="rounded-pill border border-line px-[9px] py-1 font-mono text-[10px] tracking-[0.08em] uppercase text-text-2">
          Brand &amp; UI guide v1.2
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <nav className="flex flex-wrap gap-4 text-[13px]">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="tap-44 text-text-2"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}

export function Hero() {
  const { clock } = useTicker();

  return (
    <>
      <section className="pt-[52px] pb-2">
        <div className="flex items-center gap-2.5 font-mono text-[11px] tracking-[0.1em] uppercase text-rose">
          <span className="size-1.5 animate-breathe rounded-full bg-live" />
          Beauty, at your door — on demand
        </div>
        <h1 className="mt-4 mb-0 max-w-[17ch] text-[clamp(34px,6.2vw,74px)] leading-none font-bold tracking-[-0.04em] text-balance">
          The design system for booking beauty in minutes.
        </h1>
        <p className="mt-5 max-w-[56ch] text-[clamp(15px,1.5vw,19px)] leading-[1.55] text-pretty text-text-2">
          GlamNet matches customers with vetted mobile beauty providers in their
          sector, prices the job in real time, and locks the provider&rsquo;s
          calendar the moment they accept. This guide is the single source of
          truth for the tokens, components and states our devs build against.
        </p>
        <div className="mt-[26px] flex flex-wrap gap-2.5">
          {/* Hero CTAs sit above the 48px control scale — they are page
              furniture, not form controls. */}
          <a
            href="#components"
            className="flex items-center gap-2 rounded-pill bg-metal px-[22px] py-[13px] text-sm font-bold text-metal-ink transition-[filter] duration-[180ms] ease-gn hover:brightness-105"
          >
            <Sparkle size={17} /> Book a service
          </a>
          <a
            href="#foundations"
            className="flex items-center gap-2 rounded-pill border border-line-strong px-[22px] py-[13px] text-sm font-semibold text-text-1 transition-colors duration-[180ms] ease-gn hover:border-rose hover:text-rose"
          >
            <MapPin size={17} /> Providers near me
          </a>
        </div>
      </section>

      <section className="mt-10 grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr))]">
        <ProximityMap clock={clock} />

        {/* Hero photo slot. The stripe fill is a placeholder, not a pattern in
            the system — replace the whole block with the real 4:5 image. */}
        <div className="relative flex min-h-[400px] items-end overflow-hidden rounded-[22px] border border-line bg-[repeating-linear-gradient(135deg,var(--gn-rose-tint)_0_11px,var(--gn-surface-1)_11px_22px)] p-5">
          <div className="absolute inset-0 flex items-center justify-center p-5">
            <div className="max-w-[250px] rounded-tile border border-dashed border-rose bg-bg px-[18px] py-3.5 text-center font-mono text-[11px] leading-[1.6] tracking-[0.06em] text-rose-ink">
              HERO IMAGE
              <br />
              drop 4:5 photo — provider doing
              <br />
              makeup in a customer&rsquo;s home,
              <br />
              warm low light, real hands
            </div>
          </div>
          <div className="relative flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 rounded-pill border border-line bg-surface-2 px-[13px] py-[7px] text-xs font-semibold">
              <ShieldCheck size={15} /> Vetted providers
            </div>
            <div className="flex items-center gap-1.5 rounded-pill border border-line bg-surface-2 px-[13px] py-[7px] text-xs font-semibold">
              <Lightning size={15} /> 12h emergency cover
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
