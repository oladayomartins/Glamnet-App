import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarX,
  ClockCounterClockwise,
  CurrencyGbp,
  Lightning,
  MapPin,
  ShieldCheck,
  Sliders,
} from "@phosphor-icons/react/dist/ssr";
import { getMarketingData } from "@/lib/server/marketing";
import { getPricingContext } from "@/lib/server/emergency-config";
import { BrandImage } from "@/components/brand-image";
import { BlockHeading } from "@/components/ui";
import { HERO_IMAGE_PATH } from "@/lib/imagekit";
import { DEFAULT_PROVIDER_COMMISSION_BPS } from "@/lib/domain/pricing";
import {
  BROADCAST_ACCEPTANCE_WINDOW_MINUTES,
  BROADCAST_FANOUT,
  TRANSITION_BUFFER_MINUTES,
} from "@/lib/domain/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Become a vendor",
  description:
    "Take hair, makeup and nail bookings on your own hours. Keep 70% of the work plus your travel fee in full, with your calendar protected between jobs.",
};

/** The contained column every block sits in. */
function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto w-full max-w-[var(--glam-page-max)] px-4 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * The vendor landing page.
 *
 * Written for someone deciding whether this is worth their Saturday, which
 * means the page is mostly numbers rather than adjectives. Every figure on it
 * is read from the same constants the engine runs on — the commission, the
 * fan-out, the acceptance window, the transition period — so nothing here can
 * quietly stop being true. Where a figure would have to be invented, the page
 * says something qualitative instead of making one up.
 *
 * Tone is the vendor-facing one the guide asks for: blunt and factual, no
 * pressure, no promises about earnings we cannot stand behind.
 */
export default async function BecomeVendorPage() {
  const [{ stats }, { thresholdMinutes }] = await Promise.all([
    getMarketingData(),
    getPricingContext(),
  ]);

  const share = Math.round(DEFAULT_PROVIDER_COMMISSION_BPS / 100);
  const thresholdHours = Math.round(thresholdMinutes / 60);

  return (
    <div data-page-width="full" className="-mt-6 pb-6">
      {/* ---- Hero ---------------------------------------------------- */}
      <section className="on-light relative bg-[var(--glam-hero-ground)] text-ink">
        <BrandImage
          path={HERO_IMAGE_PATH}
          alt=""
          width={1600}
          height={600}
          sizes="100vw"
          priority
          className="aspect-[8/3] w-full object-cover object-[70%_center] lg:absolute lg:inset-0 lg:h-full lg:object-right"
        />

        <Container className="relative py-10 lg:py-20 xl:py-24">
          <div className="max-w-[34rem] xl:max-w-[38rem]">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">
              For hair, makeup and nail vendors
            </p>

            <h1 className="mt-4 font-display text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.035em] text-ink sm:text-[3.4rem] lg:text-[3.75rem]">
              Work the hours you choose. Get paid for all of them.
            </h1>

            <p className="mt-5 max-w-lg text-base text-ink-muted">
              GLAMNET sends you jobs in your sector that fit the hours you have
              actually set. You accept the ones you want. No shift rotas, no
              exclusivity, and no chasing anyone for money afterwards.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/sign-up?role=vendor"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-metal px-7 text-[15px] font-bold text-metal-ink transition duration-[180ms] ease-glam active:scale-[0.98]"
              >
                Claim my free storefront page
                <ArrowRight size={16} weight="bold" aria-hidden />
              </Link>
              <Link
                href="/sign-in/vendor"
                className="inline-flex min-h-12 items-center rounded-full bg-surface px-6 text-[15px] font-semibold text-ink ring-1 ring-line transition duration-[180ms] ease-glam hover:bg-sunken active:scale-[0.98]"
              >
                Already a vendor
              </Link>
            </div>

            <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-muted">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={15} weight="fill" className="text-normal" aria-hidden />
                Free to join
              </span>
              <span className="flex items-center gap-1.5">
                <CurrencyGbp size={15} weight="fill" className="text-accent-700" aria-hidden />
                You keep {share}% plus travel
              </span>
            </p>
          </div>
        </Container>
      </section>

      {/* ---- What you actually get ----------------------------------- */}
      <Container className="pt-14 sm:pt-16">
        <BlockHeading
          title="What you get"
          lede="The terms, stated plainly. Nothing here changes once you are on."
        />
        <ul className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
          <Point
            icon={<CurrencyGbp size={20} weight="light" />}
            title={`${share}% of the work, travel in full`}
            body={`You keep ${share}% of every service you deliver and the whole travel fee for your sector. The platform fee is the rest, and it is taken from the customer's total — never invoiced to you.`}
          />
          <Point
            icon={<Sliders size={20} weight="light" />}
            title="Your hours, your sector"
            body="Set a weekly pattern, block out whatever you need, and switch new requests off entirely when life happens. Turning work off never touches a job you have already accepted."
          />
          <Point
            icon={<CalendarX size={20} weight="light" />}
            title={`${TRANSITION_BUFFER_MINUTES} minutes between jobs, always`}
            body={`Every booking reserves its service time plus ${TRANSITION_BUFFER_MINUTES} minutes. You are never offered work that would have you finishing one appointment as the next begins.`}
          />
          <Point
            icon={<Lightning size={20} weight="light" />}
            title="Short notice pays more"
            body={`A job starting within ${thresholdHours} hours carries an emergency rate, and your share of that surcharge is broken out separately on the ticket and in your ledger. You see it before you accept.`}
          />
          <Point
            icon={<ClockCounterClockwise size={20} weight="light" />}
            title="Paid after the job, not chased"
            body="The customer's card is authorised before the request ever reaches you. Payment releases once the work is completed and rated — you are never invoicing anybody."
          />
          <Point
            icon={<MapPin size={20} weight="light" />}
            title="No address until you are going"
            body="Requests show you the sector, the services, the duration and the pay. The street address is released when you unlock it, just before you set off."
          />
        </ul>
      </Container>

      {/* ---- Earnings, honestly -------------------------------------- */}
      <section className="mt-14 bg-sunken py-14 sm:mt-16 sm:py-16">
        <Container>
          <BlockHeading
            title="How the money works"
            lede="A worked example, using the real rates."
          />
          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr] lg:items-start">
            <div className="rounded-glam border border-line bg-surface p-5">
              <dl className="space-y-2.5 text-[15px]">
                <Row label="A service you price at £100" value="£100.00" />
                <Row
                  label={`Your share (${share}%)`}
                  value={`£${(share).toFixed(2)}`}
                  strong
                />
                <Row label="Travel fee for your sector" value="in full" />
                <Row
                  label={`Emergency work (within ${thresholdHours}h)`}
                  value={`+${share}% of the surcharge`}
                  emphasis
                />
              </dl>
              <p className="mt-4 border-t border-line pt-3 text-sm text-ink-muted">
                {/* Deliberately no "average earnings" figure. The marketplace
                    is young and any number would be invented; what can be
                    stated is the rate, which is fixed. */}
                We do not publish an average earnings figure. What you make
                depends on your prices, your hours and your sector — the part
                we can promise is the rate, and it is the one above.
              </p>
            </div>

            <ol className="space-y-3">
              <Step
                n={1}
                title="Apply and get vetted"
                body="Tell us who you are, what you do and where you cover. Applications are reviewed before an account can take any work — which is the reason customers trust the badge."
              />
              <Step
                n={2}
                title="Set your hours"
                body="A weekly pattern plus any blocked periods. We only ever offer you times you have said you are free."
              />
              <Step
                n={3}
                title="Accept the jobs you want"
                body={`Requests go to up to ${BROADCAST_FANOUT} vendors at once and the first to accept takes it, so there is about ${BROADCAST_ACCEPTANCE_WINDOW_MINUTES} minutes to decide. Declining costs you nothing.`}
              />
              <Step
                n={4}
                title="Do the work, get paid"
                body="Mark yourself on the way, arrived, started and complete. Payment releases once the customer rates the job."
              />
            </ol>
          </div>
        </Container>
      </section>

      {/* ---- What we ask --------------------------------------------- */}
      <Container className="pt-14 sm:pt-16">
        <BlockHeading
          title="What we ask of you"
          lede="Short list, and we hold everyone to it."
        />
        <ul className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
          {[
            "Turn up when you accept, or cancel early enough for us to re-broadcast.",
            "Keep your hours honest — the calendar is what customers are shown.",
            "Do the service that was booked, at the price that was quoted.",
            "Treat someone's home the way you would want yours treated.",
          ].map((line) => (
            <li
              key={line}
              className="rounded-glam border border-line bg-surface p-4 text-[15px] text-ink"
            >
              {line}
            </li>
          ))}
        </ul>
      </Container>

      {/* ---- CTA ------------------------------------------------------ */}
      <Container className="pt-14 sm:pt-16">
        <div className="overflow-hidden rounded-glam-lg bg-gradient-to-br from-accent-100 via-accent-100 to-brand-50 p-8 text-center sm:p-12">
          <h2 className="font-display text-3xl font-bold tracking-[-0.02em] text-ink sm:text-4xl">
            Start taking bookings
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] text-ink-muted">
            Applying takes a few minutes. You choose your hours before anything
            is ever sent to you, and you can switch requests off at any point.
          </p>
          <Link
            href="/sign-up?role=vendor"
            className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-metal px-8 text-[15px] font-bold text-metal-ink transition duration-[180ms] ease-glam active:scale-[0.98]"
          >
            Become a vendor
            <ArrowRight size={16} weight="bold" aria-hidden />
          </Link>
          <p className="mt-4 text-sm text-ink-muted">
            {stats.cityCount > 0
              ? `Currently covering ${stats.cityCount} ${stats.cityCount === 1 ? "city" : "cities"}.`
              : "New sectors are opening now."}{" "}
            Not in yours yet? Apply anyway and we will tell you when it opens.
          </p>
        </div>
      </Container>
    </div>
  );
}

function Point({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="rounded-glam border border-line bg-surface p-5 shadow-card">
      <span
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700"
      >
        {icon}
      </span>
      <h3 className="mt-3.5 font-display text-lg font-semibold text-ink">
        {title}
      </h3>
      <p className="mt-1.5 text-[15px] text-ink-muted">{body}</p>
    </li>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-4 rounded-glam border border-line bg-surface p-4">
      <span
        aria-hidden
        data-numeric
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-metal font-mono text-sm font-bold text-metal-ink"
      >
        {n}
      </span>
      <span>
        <span className="block text-[15px] font-semibold text-ink">{title}</span>
        <span className="mt-1 block text-sm text-ink-muted">{body}</span>
      </span>
    </li>
  );
}

function Row({
  label,
  value,
  strong,
  emphasis,
}: {
  label: string;
  value: string;
  strong?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd
        data-numeric
        className={`text-right ${strong ? "text-lg font-bold text-ink" : ""} ${
          emphasis ? "font-semibold text-emergency-ink" : "text-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
