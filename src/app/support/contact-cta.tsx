import Link from "next/link";
import { ArrowRight, ChatCircleText } from "@phosphor-icons/react/dist/ssr";

/** "Still need help?" — the way from an answer to a person. */
export function ContactCta() {
  return (
    <section className="flex flex-col items-start gap-4 rounded-glam-lg border border-accent-500/40 bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <ChatCircleText size={22} weight="light" aria-hidden />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Still need help?</h2>
          <p className="text-sm text-ink-muted">Send us a message and we&rsquo;ll reply by email, usually within one working day.</p>
        </div>
      </div>
      <Link
        href="/support/contact"
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-metal px-6 text-sm font-bold text-metal-ink transition duration-[180ms] ease-glam hover:brightness-105"
      >
        Contact us <ArrowRight size={14} weight="bold" aria-hidden />
      </Link>
    </section>
  );
}
