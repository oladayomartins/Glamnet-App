import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { Card, Pill } from "@/components/ui";
import { adReportByToken } from "@/lib/server/ad-report";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ad performance report",
  // A private link for one advertiser: never in search results.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const number = (value: number) => value.toLocaleString("en-GB");
const ctr = (views: number, clicks: number) => (views > 0 ? `${((clicks / views) * 100).toFixed(1)}%` : "—");
const longDate = (date: Date) =>
  date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
const dayLabel = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

const SCHEDULE_LABEL = { LIVE: "Running", SCHEDULED: "Not started yet", PAUSED: "Paused", ENDED: "Finished" } as const;

/**
 * An ad's performance report, for sharing with the advertiser: how long it
 * ran, how often it was seen and clicked, day by day. Reached by the secret
 * link in the admin ads page, so no account is needed to open it.
 */
export default async function AdReportPage({ params }: PageProps<"/ad-report/[token]">) {
  const { token } = await params;
  const shared = await adReportByToken(token);
  if (!shared) notFound();
  const { report } = shared;
  const busiest = Math.max(1, ...report.daily.map((row) => row.impressions));
  const newestFirst = [...report.daily].reverse();

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <header className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">Ad performance report</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-ink">{shared.name}</h1>
          <Pill tone={shared.schedule === "LIVE" ? "positive" : "neutral"}>{SCHEDULE_LABEL[shared.schedule]}</Pill>
        </div>
        <p className="text-[15px] text-ink-muted">
          {shared.advertiser ? `${shared.advertiser} · ` : ""}
          {shared.placement}
        </p>
        <p className="text-[15px] text-ink">
          {longDate(shared.startsAt)} → {shared.endsAt ? longDate(shared.endsAt) : "no end date"}
          <span className="text-ink-muted">
            {" "}
            · {report.days} {report.days === 1 ? "day" : "days"}
            {shared.schedule === "LIVE" ? " so far" : ""}
          </span>
        </p>
        {shared.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- ImageKit thumbnail
          <img
            src={`${shared.imageUrl}?tr=w-900,fo-auto`}
            alt={`The ad: ${shared.name}`}
            className="max-h-48 w-full rounded-glam border border-line object-cover"
          />
        ) : null}
        {shared.linkUrl ? (
          <p className="break-all text-xs text-ink-muted">Clicks go to {shared.linkUrl}</p>
        ) : (
          <p className="text-xs text-warning">This ad has no link, so it cannot be clicked.</p>
        )}
      </header>

      <section className="grid grid-cols-3 gap-3">
        {[
          { label: "Views", value: number(report.impressions) },
          { label: "Clicks", value: number(report.clicks) },
          { label: "Click rate", value: ctr(report.impressions, report.clicks) },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">{stat.label}</p>
            <p data-numeric className="mt-1 font-display text-2xl font-bold text-ink">
              {stat.value}
            </p>
          </Card>
        ))}
      </section>
      <p className="-mt-3 text-xs text-ink-muted">
        A view is counted when at least half of the ad is on someone&rsquo;s screen. A click is counted when someone taps
        it, before they are sent on.
      </p>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold text-ink">Day by day</h2>
          <a
            href={`/ad-report/${token}/csv`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-accent-700 ring-1 ring-line hover:bg-sunken"
          >
            <DownloadSimple size={15} aria-hidden /> Download spreadsheet
          </a>
        </div>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-sunken text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Views</th>
                <th className="px-4 py-2 text-right font-medium">Clicks</th>
                <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">Click rate</th>
              </tr>
            </thead>
            <tbody>
              {newestFirst.map((row) => (
                <tr key={row.day} className="border-t border-line">
                  <td className="whitespace-nowrap px-4 py-2 text-ink">{dayLabel(row.day)}</td>
                  <td className="w-full px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="block h-2 rounded-full bg-accent-500"
                        style={{ width: `${(row.impressions / busiest) * 100}%`, minWidth: row.impressions ? 4 : 0, maxWidth: "70%" }}
                      />
                      <span data-numeric className="font-mono text-xs text-ink">
                        {number(row.impressions)}
                      </span>
                    </div>
                  </td>
                  <td data-numeric className="px-4 py-2 text-right font-mono text-xs text-ink">
                    {number(row.clicks)}
                  </td>
                  <td data-numeric className="hidden px-4 py-2 text-right font-mono text-xs text-ink-muted sm:table-cell">
                    {ctr(row.impressions, row.clicks)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="mt-2 text-xs text-ink-muted">
          Days are UK dates. Totals above include every view and click since the ad was created, so they can be a little
          higher than the days listed add up to.
        </p>
      </section>
    </div>
  );
}
