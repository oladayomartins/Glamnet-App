import Link from "next/link";
import { notFound } from "next/navigation";
import { ChartBar } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/server/prisma";
import { storefrontStats } from "@/lib/server/storefront-stats";
import { Card, EmptyState, SectionTitle } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { parseStatPeriod, STAT_PERIODS, type SourceTotals } from "@/lib/domain/storefront-stats";
import { requireVendorPage } from "../access";

export const dynamic = "force-dynamic";

const dayLabel = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Storefront stats: views of the vendor's storefront split by where people
 * came from — their own shared link or GLAMNET's directory — and how many of
 * those turned into bookings and money.
 */
export default async function StorefrontStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const [{ id }, { period: raw }] = await Promise.all([params, searchParams]);
  await requireVendorPage(id, `/provider/${id}/stats`);
  const provider = await prisma.provider.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (!provider) notFound();

  const period = parseStatPeriod(raw);
  const stats = await storefrontStats(id, STAT_PERIODS[period]);
  const peak = Math.max(1, ...stats.days.map((day) => day.link + day.directory));
  const nothingYet = stats.total.views === 0 && stats.total.bookings === 0;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/provider/${id}`} className="inline-flex min-h-11 items-center text-sm text-ink-muted hover:text-brand-700">
          ← Dashboard
        </Link>
        <h1 className="font-display text-[28px] font-bold leading-tight text-ink">Storefront stats</h1>
        <p className="mt-1 text-sm text-ink-muted">
          How many people looked at your storefront, where they came from, and how many booked. Your own visits
          aren&rsquo;t counted.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Period">
        {(Object.keys(STAT_PERIODS) as (keyof typeof STAT_PERIODS)[]).map((key) => (
          <Link
            key={key}
            href={`/provider/${id}/stats?period=${key}`}
            aria-current={period === key ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition duration-[180ms] ${
              period === key ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200" : "bg-surface text-ink-muted ring-1 ring-line hover:text-ink"
            }`}
          >
            Last {STAT_PERIODS[key]} days
          </Link>
        ))}
      </nav>

      {nothingYet ? (
        <EmptyState icon={<ChartBar size={24} weight="light" />}>
          No visits yet in this period. Put your booking link in your Instagram or TikTok bio — it&rsquo;s on your{" "}
          <Link href={`/provider/${id}#bio-link`} className="font-semibold text-ink underline underline-offset-2">
            dashboard
          </Link>{" "}
          — and visits will show here.
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <SourceCard
              title="Your own link"
              hint="Bio, WhatsApp, anywhere you shared it"
              totals={stats.link}
              swatch="bg-accent-500"
            />
            <SourceCard
              title="GLAMNET directory"
              hint="Clients who found you on GLAMNET"
              totals={stats.directory}
              swatch="bg-brand-400"
            />
            <SourceCard title="All together" hint={`Last ${STAT_PERIODS[period]} days`} totals={stats.total} />
          </div>

          <section>
            <SectionTitle hint="Views per day">Visits</SectionTitle>
            <Card className="p-4">
              <div className="mb-3 flex flex-wrap gap-4 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-accent-500" /> Your link
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-brand-400" /> Directory
                </span>
              </div>
              <ol
                className="flex h-40 items-end gap-[2px]"
                aria-label={`Storefront views per day over the last ${STAT_PERIODS[period]} days`}
              >
                {stats.days.map((day) => {
                  const total = day.link + day.directory;
                  const label = `${dayLabel.format(new Date(`${day.date}T00:00:00Z`))}: ${total} ${total === 1 ? "view" : "views"} (${day.link} from your link, ${day.directory} from the directory)${day.bookings ? `, ${day.bookings} ${day.bookings === 1 ? "booking" : "bookings"}` : ""}`;
                  return (
                    <li key={day.date} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={label}>
                      <span className="sr-only">{label}</span>
                      {/* Stacked, with a 1px gap between the two sources. */}
                      <span
                        aria-hidden
                        className="block w-full rounded-t-[2px] bg-brand-400"
                        style={{ height: `${(day.directory / peak) * 100}%` }}
                      />
                      {day.link && day.directory ? <span aria-hidden className="block h-px w-full" /> : null}
                      <span
                        aria-hidden
                        className={`block w-full bg-accent-500 ${day.directory ? "" : "rounded-t-[2px]"}`}
                        style={{ height: `${(day.link / peak) * 100}%` }}
                      />
                    </li>
                  );
                })}
              </ol>
              <div className="mt-2 flex justify-between text-[11px] text-ink-muted" aria-hidden>
                <span>{dayLabel.format(new Date(`${stats.days[0].date}T00:00:00Z`))}</span>
                <span>Today</span>
              </div>
            </Card>
          </section>

          <p className="text-xs text-ink-muted">
            A view is one visit to your storefront page. Bookings are storefront bookings made in the period (own link
            and directory), and earned is what you&rsquo;re paid for the ones already completed. Requests sent out to
            several pros aren&rsquo;t included.
          </p>
        </>
      )}
    </div>
  );
}

function SourceCard({
  title,
  hint,
  totals,
  swatch,
}: {
  title: string;
  hint: string;
  totals: SourceTotals;
  swatch?: string;
}) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
        {swatch ? <span aria-hidden className={`h-2.5 w-2.5 rounded-sm ${swatch}`} /> : null}
        {title}
      </p>
      <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2" data-numeric>
        <div>
          <dt className="text-xs text-ink-muted">Views</dt>
          <dd className="font-display text-2xl font-bold text-ink">{totals.views}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Bookings</dt>
          <dd className="font-display text-2xl font-bold text-ink">{totals.bookings}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Booked</dt>
          <dd className="text-sm font-semibold text-ink">
            {totals.conversionPct === null ? "—" : `${totals.conversionPct}% of views`}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Earned</dt>
          <dd className="text-sm font-semibold text-ink">{formatMoney(totals.earnedMinor)}</dd>
        </div>
      </dl>
    </Card>
  );
}
