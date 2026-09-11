import type { Metadata } from "next";
import Link from "next/link";
import { MagnifyingGlass, CalendarCheck, House, Star } from "@phosphor-icons/react/dist/ssr";
import { getPricingContext } from "@/lib/server/emergency-config";
import { Card } from "@/components/ui";
import { describeSurcharge } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Search for the service you need, see who is genuinely free, and book them to your door. Here is what happens at each step.",
  alternates: { canonical: "/how-it-works" },
};

const STEPS = [
  {
    icon: <MagnifyingGlass size={22} weight="bold" />,
    title: "Search",
    body: "Tell us what you need and where you are. You only see services a vetted professional can actually deliver in your area — nothing that leads to a dead end.",
  },
  {
    icon: <CalendarCheck size={22} weight="bold" />,
    title: "Pick a time",
    body: "We check every nearby professional's real calendar, including travel and the gap between jobs, and show only times someone can genuinely make. You see the full price, itemised, before you authorise anything.",
  },
  {
    icon: <House size={22} weight="bold" />,
    title: "They come to you",
    body: "Your request goes to the five best-matched professionals at once. The first to accept takes the job, and the time is locked into their calendar so nobody double-books you.",
  },
  {
    icon: <Star size={22} weight="bold" />,
    title: "Rate and release",
    body: "Payment is held until the appointment is done. You rate the work, and the professional is paid.",
  },
];

export default async function HowItWorksPage() {
  const { config, thresholdMinutes } = await getPricingContext();
  const thresholdHours = Math.round(thresholdMinutes / 60);

  return (
    <div className="space-y-10 pb-4">
      <section className="pt-4">
        <h1 className="max-w-2xl font-display text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
          How GLAMNET works
        </h1>
        <p className="mt-3 max-w-xl text-base text-ink-muted">
          Four steps from &ldquo;I need my hair done&rdquo; to someone
          professional standing at your door.
        </p>
      </section>

      <ol className="grid gap-3 sm:grid-cols-2">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <Card className="h-full p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  {step.icon}
                </span>
                <span className="font-mono text-xs text-ink-muted">
                  Step {index + 1}
                </span>
              </div>
              <h2 className="mt-3 font-display text-lg font-semibold text-ink">
                {step.title}
              </h2>
              <p className="mt-1.5 text-sm text-ink-muted">{step.body}</p>
            </Card>
          </li>
        ))}
      </ol>

      <section>
        <Card className="border-l-4 border-l-emergency p-5">
          <h2 className="font-display text-xl font-semibold text-ink">
            What counts as an emergency booking?
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Any appointment starting within {thresholdHours} hours of when you
            book it. Short notice is harder to staff, so it carries
            {config
              ? ` a ${describeSurcharge(config.surchargeType, config.surchargeValue)} rate`
              : " a higher rate"}
            . You will see it named on screen, as its own line in the price,
            before you authorise payment — never afterwards.
          </p>
        </Card>
      </section>

      <section>
        <Card className="p-5">
          <h2 className="font-display text-xl font-semibold text-ink">
            For professionals
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Set your services, your area and your working hours. Requests come
            to you with the time, duration, location and exactly what you will
            earn — including any short-notice uplift — so you can decide before
            accepting. Accepting reserves the slot plus a 15-minute gap, so you
            are never sent a job that overlaps one you already have.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/sign-up"
              className="rounded-glam-sm bg-brand-700 px-4 py-2.5 text-sm font-semibold text-on-brand"
            >
              Apply to join
            </Link>
            <Link
              href="/search"
              className="rounded-glam-sm bg-surface px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-line"
            >
              Find a service
            </Link>
          </div>
        </Card>
      </section>
    </div>
  );
}
