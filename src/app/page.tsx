import Link from "next/link";
import { Lightning, MapPin, ShieldCheck, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/server/prisma";
import { getPricingContext } from "@/lib/server/emergency-config";
import { searchableAreas } from "@/lib/server/search";
import { Card } from "@/components/ui";
import { describeSurcharge, formatDuration, formatMoney } from "@/lib/format";
import { SearchBar } from "@/components/search-bar";

export const dynamic = "force-dynamic";

/** The front door: what GLAMNET is, and a way straight into finding a service. */
export default async function MarketingPage() {
  const [areas, popular, { config, thresholdMinutes }, providerCount] =
    await Promise.all([
      searchableAreas(),
      prisma.service.findMany({
        where: { isActive: true, kind: "SERVICE" },
        orderBy: { durationMinutes: "desc" },
        take: 6,
        select: {
          id: true,
          name: true,
          category: true,
          priceMinor: true,
          durationMinutes: true,
        },
      }),
      getPricingContext(),
      prisma.provider.count({ where: { approvalStatus: "APPROVED" } }),
    ]);

  const thresholdHours = Math.round(thresholdMinutes / 60);

  return (
    <div className="space-y-14 pb-8">
      {/* ---- Hero ---------------------------------------------------- */}
      <section className="pt-4">
        <h1 className="max-w-2xl font-display text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-ink sm:text-5xl">
          Hair and makeup,
          <br />
          at your door.
        </h1>
        <p className="mt-4 max-w-xl text-base text-ink-muted">
          Book a vetted beauty professional to come to you — today if you need
          one. Real availability, a price you see before you pay, and no
          searching through people who are already busy.
        </p>

        <div className="mt-6 max-w-2xl">
          <SearchBar areas={areas} />
        </div>

        <p className="mt-3 text-xs text-ink-muted">
          {providerCount} professionals across{" "}
          {new Set(areas.map((area) => area.city)).size} areas
        </p>
      </section>

      {/* ---- Why ----------------------------------------------------- */}
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: <MapPin size={20} weight="bold" />,
            title: "They come to you",
            body: "Your home, your chair. Travel is a fixed fee shown up front, never a surprise.",
          },
          {
            icon: <ShieldCheck size={20} weight="bold" />,
            title: "Vetted professionals",
            body: "Every provider is reviewed before taking work, and rated by customers after.",
          },
          {
            icon: <Sparkle size={20} weight="bold" />,
            title: "Genuinely available",
            body: "You only see times a professional can actually make, including travel between jobs.",
          },
        ].map((item) => (
          <Card key={item.title} className="p-4">
            <span className="text-brand-700">{item.icon}</span>
            <h2 className="mt-2 font-display text-base font-semibold text-ink">
              {item.title}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{item.body}</p>
          </Card>
        ))}
      </section>

      {/* ---- Emergency ----------------------------------------------- */}
      <section>
        <Card className="border-l-4 border-l-emergency p-5">
          <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-emergency-ink">
            <Lightning size={16} weight="bold" />
            Need someone today?
          </p>
          <h2 className="mt-2 font-display text-xl font-semibold text-ink">
            Emergency bookings, within {thresholdHours} hours
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Something came up. Book an appointment starting in the next{" "}
            {thresholdHours} hours and we broadcast it straight to the
            professionals near you who are free right now.
            {config
              ? ` Short notice carries a ${describeSurcharge(config.surchargeType, config.surchargeValue)} emergency rate —`
              : " Short notice carries an emergency rate —"}{" "}
            shown in full before you authorise payment, never after.
          </p>
          <Link
            href="/book"
            className="mt-4 inline-flex rounded-glam-sm bg-emergency px-4 py-2.5 text-sm font-semibold text-on-emergency"
          >
            Find someone now
          </Link>
        </Card>
      </section>

      {/* ---- Popular services ---------------------------------------- */}
      <section>
        <h2 className="font-display text-xl font-semibold text-ink">
          Popular services
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {popular.map((service) => (
            <Link
              key={service.id}
              href={`/search?q=${encodeURIComponent(service.name)}`}
              className="rounded-glam border border-line bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-raised"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-semibold text-ink">
                  {service.name}
                </span>
                <span className="font-mono text-sm font-semibold text-ink">
                  {formatMoney(service.priceMinor)}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                {formatDuration(service.durationMinutes)} · {service.category}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ---- For providers ------------------------------------------- */}
      <section>
        <Card className="p-5">
          <h2 className="font-display text-xl font-semibold text-ink">
            Are you a beauty professional?
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Set your own hours and service menu, and get booking requests from
            customers near you. We handle scheduling, payment and the
            15-minute gap between jobs so you are never double-booked.
          </p>
          <Link
            href="/sign-up"
            className="mt-4 inline-flex rounded-glam-sm bg-brand-700 px-4 py-2.5 text-sm font-semibold text-on-brand"
          >
            Apply to join
          </Link>
        </Card>
      </section>
    </div>
  );
}
