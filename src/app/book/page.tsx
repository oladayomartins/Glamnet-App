import Link from "next/link";
import { prisma } from "@/lib/server/prisma";
import { getPricingContext } from "@/lib/server/emergency-config";
import { Card, SectionTitle } from "@/components/ui";
import { describeSurcharge, formatMoney } from "@/lib/format";

/**
 * Read live from the database on every request. Without this Next prerenders
 * the page at build time, which would freeze the hub and vendor data into
 * the build output.
 */
export const dynamic = "force-dynamic";

/** Step 1 of the booking journey (spec §13): Select Beauty Hub. */
export default async function BookPage() {
  const [hubs, { config, thresholdMinutes }] = await Promise.all([
    prisma.hub.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { providers: true } } },
    }),
    getPricingContext(),
  ]);

  const thresholdHours = Math.round(thresholdMinutes / 60);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Where are you?
        </h1>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">
          Pick your Beauty Hub to see the vendors covering your area and
          the times they are genuinely free — service duration, travel and the
          15-minute transition period all accounted for.
        </p>
      </section>

      <Card className="border-l-4 border-l-emergency p-4">
        <p className="text-sm font-bold uppercase tracking-wider text-emergency-ink">
          Need someone sooner?
        </p>
        <p className="mt-1 text-sm text-ink">
          Appointments within {thresholdHours} hours are handled as{" "}
          <strong>emergency bookings</strong>
          {config
            ? ` and carry a ${describeSurcharge(config.surchargeType, config.surchargeValue)} surcharge`
            : ""}
          . You will always see the surcharge on screen before you authorise
          payment.
        </p>
      </Card>

      <section>
        <SectionTitle hint={`${hubs.length} hubs live`}>
          Select your Beauty Hub
        </SectionTitle>

        <div className="grid gap-3 sm:grid-cols-2">
          {hubs.map((hub) => (
            <Link
              key={hub.id}
              href={`/book/${hub.id}`}
              className="rounded-glam border border-line bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-raised"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold text-ink">
                    {hub.name}
                  </p>
                  <p className="text-sm text-ink-muted">{hub.city}</p>
                </div>
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold tracking-wider text-brand-700">
                  {hub.sector}
                </span>
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                {hub._count.providers} providers · travel fee{" "}
                {formatMoney(hub.travelFeeMinor)}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
