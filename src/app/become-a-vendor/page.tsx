import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarCheck,
  CaretDown,
  Check,
  Images,
  Link as LinkIcon,
  LockKey,
  MapPin,
  SealCheck,
  Sparkle,
  Star,
  Storefront,
} from "@phosphor-icons/react/dist/ssr";
import { getPricingContext } from "@/lib/server/emergency-config";
import { BrandImage } from "@/components/brand-image";
import { formatMoney } from "@/lib/format";
import { TRUST_FEE_MINOR } from "@/lib/domain/constants";
import { DISPUTE_WINDOW_HOURS, REQUIRED_COMPLETION_PHOTOS } from "@/lib/domain/completion";
import {
  CARD_PROCESSING_FEE_BPS,
  DISCOVERY_COMMISSION_BPS,
  decideCommission,
  settle,
} from "@/lib/domain/settlement";
import { SPECIALTY_HUBS } from "@/lib/domain/specialty-hubs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Become a vendor",
  description:
    "Claim a free storefront for your beauty business. 0% commission on clients from your own link, a calendar that cannot double-book, and payment released by your client's PIN.",
};

const SIGN_UP = "/sign-up?role=vendor";

/** The contained column every block sits in. */
function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-[var(--glam-page-max)] px-4 ${className}`}>{children}</div>
  );
}

/**
 * The vendor landing page.
 *
 * Laid out as a sequence of alternating bands — hero, two feature splits, a
 * feature grid, the money, the steps, FAQs and a closing CTA — so a vendor
 * can scan it top to bottom in under a minute.
 *
 * Every figure is computed from the constants the engine runs on (the
 * commission rules, the card fee, the trust fee, the dispute window, the
 * photo count), so the page cannot quietly drift from what the app does.
 * Nothing on it is an invented statistic or testimonial: where a real one
 * would go, the page states the platform's own terms instead.
 */
export default async function BecomeVendorPage() {
  const { thresholdMinutes } = await getPricingContext();
  const thresholdHours = Math.round(thresholdMinutes / 60);

  // Worked example on a £100 service, through the real settlement engine.
  const example = { totalMinor: 10_000 + TRUST_FEE_MINOR, commissionableMinor: 10_000, trustFeeMinor: TRUST_FEE_MINOR, tipMinor: 0 };
  const ruleA = settle({ ...example, commission: decideCommission({ source: "DIRECT_LINK", hasPriorBooking: false }) });
  const ruleB = settle({ ...example, commission: decideCommission({ source: "MARKETPLACE", hasPriorBooking: false }) });
  const commissionPct = DISCOVERY_COMMISSION_BPS / 100;
  const cardFeePct = CARD_PROCESSING_FEE_BPS / 100;

  return (
    <div data-page-width="full" className="-mt-6">
      {/* ---- Hero ------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-canvas">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_70%_at_50%_0%,color-mix(in_oklab,var(--glam-gold)_28%,transparent),transparent_70%)]"
        />
        <Container className="relative py-20 text-center sm:py-28">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-accent-700">
            For independent hair, beauty &amp; wellness pros
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl font-display text-[2.5rem] font-extrabold leading-[1.05] tracking-[-0.035em] text-ink sm:text-6xl">
            Get booked by clients who value what you do.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-ink-muted sm:text-lg">
            GLAMNET gives your home salon, private room or chair a storefront of its own — your
            looks, your menu, your prices and a calendar clients can book straight into.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <CtaLink href={SIGN_UP}>Claim my free storefront page</CtaLink>
            <Link
              href="/sign-in/vendor"
              className="inline-flex min-h-12 items-center rounded-full px-6 text-[15px] font-semibold text-ink ring-1 ring-line transition duration-[180ms] ease-glam hover:bg-surface"
            >
              I already have one
            </Link>
          </div>
          <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-muted">
            <TrustItem>Free to list</TrustItem>
            <TrustItem>0% commission on your own link</TrustItem>
            <TrustItem>Paid by PIN, never chased</TrustItem>
          </ul>
        </Container>
      </section>

      {/* ---- Reach clients who get it ---------------------------------- */}
      <Band>
        <Split
          text={
            <>
              <Eyebrow>A marketplace that gets it</Eyebrow>
              <Heading>Reach clients who already understand your work</Heading>
              <p className="mt-4 text-[15px] text-ink-muted">
                Clients browse by the craft they want, not a generic &ldquo;beauty&rdquo; list — so
                the person booking your knotless braids or your bridal gele already knows what
                good looks like, and is looking for you.
              </p>
              <ul className="mt-5 space-y-2.5">
                {SPECIALTY_HUBS.map((hub) => (
                  <CheckItem key={hub.slug}>
                    <span className="font-semibold text-ink">{hub.name}</span> — {hub.blurb.toLowerCase()}
                  </CheckItem>
                ))}
              </ul>
            </>
          }
          visual={
            <div className="relative">
              <div className="overflow-hidden rounded-glam-lg shadow-raised">
                <BrandImage
                  path="/Glamorous Makeup Application Portrait  .png"
                  alt="A makeup artist finishing a client's glam look"
                  width={720}
                  height={600}
                  sizes="(max-width: 1024px) 100vw, 520px"
                  className="aspect-[6/5] w-full object-cover"
                />
              </div>
              <MockCard className="absolute -bottom-6 left-4 w-64 sm:left-[-1.5rem]">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent-700">
                  New booking · example
                </p>
                <p className="mt-1.5 text-sm font-semibold text-ink">Asian Bridal Makeup + Gele Tie</p>
                <p className="mt-0.5 text-xs text-ink-muted">Sat 10:00 · at your studio, S10</p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-normal-ink">
                  <LockKey size={13} weight="fill" aria-hidden /> Card hold in place
                </p>
              </MockCard>
            </div>
          }
        />
      </Band>

      {/* ---- Run your business professionally --------------------------- */}
      <Band tone="sunken">
        <Split
          reverse
          text={
            <>
              <Eyebrow>Built-in tools</Eyebrow>
              <Heading>Run your business professionally</Heading>
              <p className="mt-4 text-[15px] text-ink-muted">
                Set your own menu, times and prices. Clients see one transparent price card before
                they book, and the full amount is held on their card — nothing to invoice, nothing
                to chase. When you finish, you take {REQUIRED_COMPLETION_PHOTOS} photos of the look,
                your client reads you a 4-digit PIN, and the money is released.
              </p>
              <Link
                href={SIGN_UP}
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-700 hover:underline"
              >
                Set up my menu <ArrowRight size={14} weight="bold" aria-hidden />
              </Link>
            </>
          }
          visual={
            <MockCard className="mx-auto w-full max-w-sm">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                What your client sees · example
              </p>
              <dl className="mt-3 space-y-1.5 text-sm">
                <MockRow label="Asian Bridal Makeup" value="£180.00" />
                <MockRow label="Gele Tie" value="£30.00" />
                <MockRow label="Trust fee" value={formatMoney(TRUST_FEE_MINOR)} />
                <MockRow label="Tip" value="£10.00" />
              </dl>
              <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
                <span className="text-sm font-bold text-ink">Held on card</span>
                <span data-numeric className="text-2xl font-bold text-accent-700">
                  {formatMoney(18_000 + 3_000 + TRUST_FEE_MINOR + 1_000)}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <span className="flex min-h-10 items-center justify-center rounded-full text-xs font-semibold text-ink ring-1 ring-line">
                  {REQUIRED_COMPLETION_PHOTOS} finish photos
                </span>
                <span className="flex min-h-10 items-center justify-center gap-1 rounded-full bg-metal text-xs font-bold text-metal-ink">
                  <LockKey size={12} weight="fill" aria-hidden /> Release with PIN
                </span>
              </div>
            </MockCard>
          }
        />
      </Band>

      {/* ---- Feature grid ----------------------------------------------- */}
      <Band>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Feature icon={<Storefront size={20} weight="light" />} title="A storefront that sells for you">
            Your three best transformations, your bio and socials, and a menu with your own prices
            and times — at glamnet.co/pro/your-name.
          </Feature>
          <Feature icon={<LinkIcon size={20} weight="light" />} title="0% commission on your link">
            Put your link in your Instagram or TikTok bio. Clients who book through it — and every
            client who comes back — cost you no commission, only the {cardFeePct}% card fee.
          </Feature>
          <Feature icon={<CalendarCheck size={20} weight="light" />} title="A calendar that can't double-book">
            Set your weekly hours and block holidays. Clients only see times you are genuinely free,
            with 15 minutes kept between every appointment.
          </Feature>
          <Feature icon={<LockKey size={20} weight="light" />} title="Paid by PIN, never chased">
            The client&rsquo;s card is held at booking. Their 4-digit PIN at the end releases the
            money straight to your bank through Stripe.
          </Feature>
          <Feature icon={<Star size={20} weight="light" />} title="Reviews that build trust">
            Only clients who actually had an appointment can review you, and reviews can&rsquo;t be
            edited afterwards — so your rating means something.
          </Feature>
          <Feature icon={<SealCheck size={20} weight="light" />} title="A verified, trusted profile">
            Upload your insurance or licence once. When we have checked it you get the verified
            badge, and your storefront and calendar go live.
          </Feature>
        </div>
      </Band>

      {/* ---- Get discovered --------------------------------------------- */}
      <Band tone="sunken">
        <Split
          text={
            <>
              <Eyebrow>The directory</Eyebrow>
              <Heading>Get discovered by clients ready to book</Heading>
              <p className="mt-4 text-[15px] text-ink-muted">
                Verified storefronts appear in the Sheffield directory under the hubs you work in,
                sorted by distance from the client&rsquo;s postcode. Short-notice bookings inside{" "}
                {thresholdHours} hours carry an emergency rate, shown to the client before they pay.
              </p>
              <ul className="mt-5 space-y-2.5">
                <CheckItem>Listed by specialty hub and postcode sector</CheckItem>
                <CheckItem>Nearest pros shown first — your local clients find you</CheckItem>
                <CheckItem>Bridal clients are offered nail overlays from pros nearby</CheckItem>
              </ul>
            </>
          }
          visual={
            <MockCard className="mx-auto w-full max-w-sm p-0">
              <div className="relative aspect-[16/9] rounded-t-glam bg-metal">
                <span className="absolute left-3 top-3 rounded-full bg-obsidian/85 px-2.5 py-1 text-xs font-semibold text-on-obsidian">
                  1.2 km
                </span>
                <Images size={28} className="absolute bottom-3 right-3 text-metal-ink/50" aria-hidden />
              </div>
              <div className="p-4">
                <p className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
                  Your name here
                  <SealCheck size={15} weight="fill" className="text-accent-500" aria-label="Verified" />
                </p>
                <p className="mt-1 flex items-center gap-3 text-xs text-ink-muted">
                  <span className="flex items-center gap-1">
                    <Star size={12} weight="fill" className="text-accent-500" aria-hidden /> New
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={12} aria-hidden /> Home salon · S10
                  </span>
                </p>
                <p className="mt-2 flex justify-between text-xs">
                  <span className="text-ink-muted">Afro &amp; Textured</span>
                  <span className="font-bold text-accent-700">from £95.00</span>
                </p>
              </div>
            </MockCard>
          }
        />
      </Band>

      {/* ---- The money ---------------------------------------------------- */}
      <Band>
        <div className="text-center">
          <Eyebrow>How the money works</Eyebrow>
          <Heading>Two simple rules, on a £100 service</Heading>
        </div>
        <div className="mx-auto mt-8 grid max-w-4xl gap-4 md:grid-cols-2">
          <MoneyCard
            badge="Your own link"
            title="Clients from your link, and every repeat client"
            payout={ruleA.providerPayoutMinor}
            lines={[
              ["Marketplace commission", "0%"],
              [`Card processing (${cardFeePct}%)`, formatMoney(ruleA.processingFeeMinor)],
            ]}
            highlight
          />
          <MoneyCard
            badge="First marketplace booking"
            title="A new client who found you on GLAMNET"
            payout={ruleB.providerPayoutMinor}
            lines={[
              [`Acquisition commission (${commissionPct}%)`, formatMoney(ruleB.platformCommissionMinor)],
              ["Card processing", "we cover it"],
            ]}
          />
        </div>
        <p className="mx-auto mt-5 max-w-2xl text-center text-sm text-ink-muted">
          Tips always go to you in full, and so does any travel fee when you visit a client at
          home. The {formatMoney(TRUST_FEE_MINOR)} trust fee is paid by the client. After that
          first booking, the same client is yours at 0% for good.
        </p>
      </Band>

      {/* ---- Steps ---------------------------------------------------------- */}
      <Band tone="sunken">
        <div className="text-center">
          <Eyebrow>Simple from day one</Eyebrow>
          <Heading>From sign-up to your first booking</Heading>
        </div>
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StepItem n="01" title="Create your storefront">
            Your link, bio, socials, workspace and menu — in a few minutes.
          </StepItem>
          <StepItem n="02" title="Upload your documents">
            Insurance or practitioner licence, as a photo or PDF. Stored privately.
          </StepItem>
          <StepItem n="03" title="Link your bank">
            Connect payouts securely with Stripe, then we verify you and you go live.
          </StepItem>
          <StepItem n="04" title="Share your link and get booked">
            Paste it in your bio. Clients book, you do what you do best, the PIN pays you.
          </StepItem>
        </ol>
        <div className="mt-10 text-center">
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-700 hover:underline"
          >
            See how bookings work <ArrowRight size={14} weight="bold" aria-hidden />
          </Link>
        </div>
      </Band>

      {/* ---- Promise --------------------------------------------------------- */}
      <Band>
        <figure className="mx-auto max-w-3xl text-center">
          <Sparkle size={28} weight="fill" className="mx-auto text-accent-500" aria-hidden />
          <blockquote className="mt-5 font-display text-2xl font-semibold leading-snug tracking-[-0.015em] text-ink sm:text-3xl">
            &ldquo;You set the price. The client&rsquo;s card is held before you pick up a brush,
            and it&rsquo;s released the moment they tell you they&rsquo;re happy.&rdquo;
          </blockquote>
          <figcaption className="mt-5 text-sm text-ink-muted">The GLAMNET promise to every pro</figcaption>
        </figure>
      </Band>

      {/* ---- FAQ ---------------------------------------------------------------- */}
      <Band tone="sunken">
        <div className="text-center">
          <Eyebrow>Questions?</Eyebrow>
          <Heading>Everything else you might be wondering</Heading>
        </div>
        <div className="mx-auto mt-8 max-w-2xl divide-y divide-line border-y border-line">
          <Faq q="Is it really free to list?">
            Yes. There is no sign-up fee or subscription. You only ever pay the {cardFeePct}% card
            fee on bookings, plus a {commissionPct}% commission on the first booking from a new
            client who found you through GLAMNET.
          </Faq>
          <Faq q="Who are the clients on GLAMNET?">
            People in and around Sheffield looking for a specific craft — protective styling,
            bridal and gele, BIAB, blow-dries, sports massage — who want to see your work and your
            prices before they book.
          </Faq>
          <Faq q="What kinds of services can I list?">
            Anything across the five hubs:{" "}
            {SPECIALTY_HUBS.map((hub) => hub.name).join(", ")}. You set your own price and duration
            for each one.
          </Faq>
          <Faq q="How do I receive bookings and get paid?">
            Clients book an open slot on your calendar and their card is held. At the end you
            upload {REQUIRED_COMPLETION_PHOTOS} photos, they read you a 4-digit PIN, and the money
            goes to your bank through Stripe. They have {DISPUTE_WINDOW_HOURS} hours to raise a
            problem, and then the booking is closed.
          </Faq>
          <Faq q="How long does it take to set up?">
            The storefront takes a few minutes. You go live once we have checked your insurance or
            licence and your bank is linked.
          </Faq>
          <Faq q="Do I need my own website?">
            No. Your storefront is your website — a link you can share anywhere, with your lookbook,
            menu, calendar and reviews on it.
          </Faq>
          <Faq q="Can I take time off?">
            Any time. Block specific dates, or switch on vacation mode to pause your storefront in
            one tap. Bookings you already have are kept.
          </Faq>
        </div>
      </Band>

      {/* ---- Closing CTA ------------------------------------------------------ */}
      <section className="bg-metal">
        <Container className="py-16 text-center sm:py-20">
          <h2 className="font-display text-3xl font-extrabold tracking-[-0.025em] text-metal-ink sm:text-4xl">
            Your craft deserves a bigger stage.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] text-metal-ink/80">
            Join the independent pros building their client list on GLAMNET. Free to list, set up in
            minutes.
          </p>
          <Link
            href={SIGN_UP}
            className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-obsidian px-8 text-[15px] font-bold text-on-obsidian transition duration-[180ms] ease-glam active:scale-[0.98]"
          >
            Claim my free storefront page
            <ArrowRight size={16} weight="bold" aria-hidden />
          </Link>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-metal-ink/75">
            <Check size={13} weight="bold" aria-hidden /> Free to list · No card needed to sign up
          </p>
        </Container>
      </section>
    </div>
  );
}

/* ---- Building blocks ------------------------------------------------------ */

function Band({ children, tone = "canvas" }: { children: ReactNode; tone?: "canvas" | "sunken" }) {
  return (
    <section className={tone === "sunken" ? "bg-sunken" : "bg-canvas"}>
      <Container className="py-16 sm:py-24">{children}</Container>
    </section>
  );
}

function Split({ text, visual, reverse }: { text: ReactNode; visual: ReactNode; reverse?: boolean }) {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
      <div className={reverse ? "lg:order-2" : ""}>{text}</div>
      <div className={reverse ? "lg:order-1" : ""}>{visual}</div>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-accent-700">
      {children}
    </p>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-2 font-display text-3xl font-bold leading-tight tracking-[-0.025em] text-ink sm:text-4xl">
      {children}
    </h2>
  );
}

function CtaLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center gap-2 rounded-full bg-metal px-7 text-[15px] font-bold text-metal-ink shadow-raised transition duration-[180ms] ease-glam hover:brightness-105 active:scale-[0.98]"
    >
      {children}
      <ArrowRight size={16} weight="bold" aria-hidden />
    </Link>
  );
}

function TrustItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <Check size={14} weight="bold" className="text-accent-500" aria-hidden />
      {children}
    </li>
  );
}

function CheckItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[15px] text-ink-muted">
      <span
        aria-hidden
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-accent-500/60"
      >
        <Check size={11} weight="bold" className="text-accent-500" />
      </span>
      <span>{children}</span>
    </li>
  );
}

function MockCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-glam border border-line bg-surface p-4 shadow-raised ${className}`}>
      {children}
    </div>
  );
}

function MockRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd data-numeric className="text-ink">
        {value}
      </dd>
    </div>
  );
}

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-glam border border-line bg-surface p-6 transition duration-[180ms] ease-glam hover:border-accent-500/60">
      <span
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-glam-sm bg-accent-100 text-accent-700"
      >
        {icon}
      </span>
      <h3 className="mt-4 font-display text-[17px] font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{children}</p>
    </div>
  );
}

function MoneyCard({
  badge,
  title,
  payout,
  lines,
  highlight,
}: {
  badge: string;
  title: string;
  payout: number;
  lines: [string, string][];
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-glam-lg border bg-surface p-6 ${
        highlight ? "border-accent-500 shadow-raised" : "border-line"
      }`}
    >
      <span
        className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider ${
          highlight ? "bg-metal text-metal-ink" : "bg-sunken text-ink-muted ring-1 ring-line"
        }`}
      >
        {badge}
      </span>
      <p className="mt-3 text-[15px] font-semibold text-ink">{title}</p>
      <dl className="mt-4 space-y-1.5 text-sm">
        {lines.map(([label, value]) => (
          <MockRow key={label} label={label} value={value} />
        ))}
      </dl>
      <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3">
        <span className="text-sm font-bold text-ink">You receive</span>
        <span data-numeric className="text-3xl font-extrabold text-accent-700">
          {formatMoney(payout)}
        </span>
      </div>
    </div>
  );
}

function StepItem({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <li>
      <span aria-hidden data-numeric className="font-display text-5xl font-extrabold text-accent-500/35">
        {n}
      </span>
      <h3 className="mt-2 text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-ink-muted">{children}</p>
    </li>
  );
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group py-1">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
        {q}
        <CaretDown
          size={16}
          className="shrink-0 text-ink-muted transition duration-[180ms] ease-glam group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <p className="pb-5 pr-8 text-sm leading-relaxed text-ink-muted">{children}</p>
    </details>
  );
}
