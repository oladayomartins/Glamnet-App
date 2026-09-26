import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { getProviderToday } from "@/lib/server/provider-today";
import { RequestsInbox } from "./requests-inbox";
import { CalendarPanel } from "./calendar-panel";
import { TodayStrip } from "./today-strip";
import { AcceptingSwitch } from "./accepting-switch";
import { requireVendorPage } from "./access";
import { BioLink } from "@/components/bio-link";
import { siteUrl } from "@/lib/site";

/** The dashboard reads live figures, so it must not be prerendered. */
export const dynamic = "force-dynamic";

/** "Good morning" by the clock in the UK, where the vendors are. */
function greeting(now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Europe/London",
    }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Vendor PWA dashboard: calendar plus the broadcast inbox (spec §2, §6).
 *
 * Laid out in order of urgency, because on a phone every section costs a
 * scroll: the booking switch, then requests (which expire in minutes), then
 * today's numbers, the calendar, the bio link, and a way to settings. Push
 * and email preferences live on the settings page, not here. Requests and
 * the calendar also have tabs of their own.
 */
export default async function ProviderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const viewer = await requireVendorPage(id, `/provider/${id}`);

  const [provider, today] = await Promise.all([
    prisma.provider.findUnique({
      where: { id },
      include: { hub: { select: { name: true, sector: true } } },
    }),
    getProviderToday(id),
  ]);

  if (!provider || !today) notFound();

  const isOwner = viewer.providerId === id;
  const firstName = provider.name.trim().split(/\s+/)[0];
  // Hub names usually carry their sector already ("London RM9"), and
  // "London RM9 · RM9" reads as a mistake.
  const area = provider.hub.name.includes(provider.hub.sector)
    ? provider.hub.name
    : `${provider.hub.name} · ${provider.hub.sector}`;

  return (
    <div className="space-y-6">
      <header>
        {isOwner ? null : (
          <Link
            href="/provider"
            className="inline-flex min-h-11 items-center text-sm text-ink-muted hover:text-brand-700"
          >
            ← All vendors
          </Link>
        )}
        <h1 className="font-display text-[28px] font-bold leading-tight text-ink">
          {isOwner ? `${greeting()}, ${firstName}` : provider.name}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
          {/* A rating before any completed job is the default, not a score. */}
          {provider.completedBookings === 0 ? (
            <span className="rounded-full bg-sunken px-2.5 py-0.5 text-xs font-bold text-accent-700 ring-1 ring-accent-500/40">
              New on Glamnet
            </span>
          ) : null}
          <span>{area}</span>
          {provider.completedBookings > 0 ? (
            <>
              <span aria-hidden>·</span>
              <span data-numeric>
                {provider.rating.toFixed(1)}★ · {provider.completedBookings} completed
              </span>
            </>
          ) : null}
          <span aria-hidden>·</span>
          <Link
            href={provider.slug ? `/pro/${provider.slug}` : "/provider/onboarding?step=storefront"}
            className="inline-flex min-h-11 items-center font-semibold text-ink hover:text-brand-700"
          >
            {provider.slug ? "View my storefront" : "Set up my storefront"}
          </Link>
        </div>
      </header>

      <AcceptingSwitch providerId={provider.id} initial={provider.isAcceptingWork} />

      <RequestsInbox providerId={provider.id} />

      <TodayStrip today={today} />

      <CalendarPanel providerId={provider.id} />

      <section id="bio-link" className="scroll-mt-20">
        {provider.slug ? (
          <BioLink origin={siteUrl().replace(/^https?:\/\//, "")} slug={provider.slug} />
        ) : (
          <Link
            href="/provider/onboarding?step=storefront"
            className="flex min-h-11 items-center rounded-glam border border-dashed border-line p-4 text-sm text-ink-muted hover:border-accent-500"
          >
            Claim your storefront link to share in your Instagram and TikTok bio →
          </Link>
        )}
      </section>

      <Link
        href={`/provider/${provider.id}/settings`}
        className="flex min-h-14 items-center justify-between gap-3 rounded-glam border border-line bg-surface px-4 py-3 transition duration-[180ms] hover:bg-sunken"
      >
        <span>
          <span className="block font-semibold text-ink">Settings</span>
          <span className="block text-sm text-ink-muted">
            Notifications, emails, storefront and working hours
          </span>
        </span>
        <span aria-hidden className="text-ink-muted">
          →
        </span>
      </Link>
    </div>
  );
}
