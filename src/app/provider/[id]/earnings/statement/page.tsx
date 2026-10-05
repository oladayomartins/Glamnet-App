import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/auth/session";
import { vendorLedger } from "@/lib/server/vendor-ledger";
import { KIND_LABELS, parsePeriod, periodRange, totalsOf } from "@/lib/domain/ledger";
import { formatMoney } from "@/lib/format";
import { ukDateString } from "@/lib/domain/uk-time";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

const longDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
const shortDate = (at: Date) => ukDateString(at).split("-").reverse().join("/");

/**
 * A printable earnings statement for one period: totals first, then every
 * entry. Printed (or saved as PDF from the print dialog) it is a one-document
 * record for a tax return, an accountant or a mortgage application.
 *
 * Always a white sheet, whatever the app theme, because it is meant for paper.
 */
export default async function EarningsStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const [{ id }, { period: rawPeriod }] = await Promise.all([params, searchParams]);
  const viewer = await requireUser(`/provider/${id}/earnings/statement`);
  if (viewer.role !== "ADMIN" && viewer.providerId !== id) redirect("/forbidden");

  const period = parsePeriod(rawPeriod);
  const now = new Date();
  const range = periodRange(period, now);
  const [provider, rows] = await Promise.all([
    prisma.provider.findUnique({ where: { id }, select: { id: true, name: true, email: true, slug: true } }),
    vendorLedger(id, range.from, range.to),
  ]);
  if (!provider) notFound();

  const totals = totalsOf(rows);
  // The period's last day, inclusive, for the heading ("6 April 2026 – 5 April 2027").
  const lastDay = new Date(Math.min(range.to.getTime(), now.getTime()) - 1);
  const ordered = [...rows].reverse();

  const summary: Array<[string, number, boolean?]> = [
    ["Client payments (services and fees)", totals.priceMinor],
    ["Tips", totals.tipMinor],
    ["GLAMNET commission", -totals.commissionMinor],
    ["Card processing fees", -totals.cardFeeMinor],
    ["Booking fees", -totals.bookingFeeMinor],
    ["Paid out to you", totals.payoutMinor, true],
    ...(totals.deductionMinor > 0 ? ([["Dispute deductions", -totals.deductionMinor]] as Array<[string, number]>) : []),
    ["Net earnings", totals.netMinor, true],
  ];

  return (
    <div data-print-statement>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href={`/provider/${provider.id}/earnings?period=${period}`}
          className="inline-flex min-h-11 items-center text-sm text-ink-muted hover:text-brand-700"
        >
          ← Earnings
        </Link>
        <PrintButton />
      </div>

      <article className="on-light mx-auto max-w-[210mm] rounded-glam bg-white p-6 text-[13px] text-ink shadow-card sm:p-10 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <Image src="/brand/glamnet-logo-on-light.png" alt="GLAMNET" width={156} height={28} style={{ width: 156, height: 28 }} />
            <h1 className="mt-4 font-display text-2xl font-bold text-ink">Earnings statement</h1>
            <p className="mt-1 text-ink-muted">
              {longDate.format(range.from)} – {longDate.format(lastDay)}
              {period === "tax" || period === "lasttax" ? ` · ${range.label.replace(/ \(.*\)$/, "")}` : ""}
            </p>
          </div>
          <dl className="text-right text-ink">
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">Prepared for</dt>
            <dd className="mt-0.5 font-semibold">{provider.name}</dd>
            <dd className="text-ink-muted">{provider.email}</dd>
            {provider.slug ? <dd className="text-ink-muted">glamnetapp.com/pro/{provider.slug}</dd> : null}
            <dt className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">Issued</dt>
            <dd>{longDate.format(now)}</dd>
          </dl>
        </header>

        <section className="mt-6 break-inside-avoid">
          <h2 className="font-display text-base font-semibold text-ink">Summary</h2>
          <dl className="mt-2 max-w-md">
            {summary.map(([label, amount, strong]) => (
              <div
                key={label}
                className={`flex justify-between gap-6 py-1 ${strong ? "border-t border-line font-bold" : ""}`}
              >
                <dt>{label}</dt>
                <dd data-numeric className="tabular-nums">
                  {amount < 0 ? `−${formatMoney(-amount)}` : formatMoney(amount)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-ink-muted">
            {totals.count} {totals.count === 1 ? "entry" : "entries"}: finished jobs and any late-cancellation or
            missed-appointment fees paid to you, by appointment date.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-base font-semibold text-ink">Entries</h2>
          {ordered.length === 0 ? (
            <p className="mt-2 text-ink-muted">No earnings in this period.</p>
          ) : (
            <div className="mt-2 overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[640px] border-collapse print:min-w-0">
                <thead>
                  <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">
                    <th className="py-2 pr-2 font-medium">Date</th>
                    <th className="py-2 pr-2 font-medium">Ref</th>
                    <th className="py-2 pr-2 font-medium">Item</th>
                    <th className="py-2 pr-2 text-right font-medium">Price</th>
                    <th className="py-2 pr-2 text-right font-medium">Tip</th>
                    <th className="py-2 pr-2 text-right font-medium">Fees</th>
                    <th className="py-2 text-right font-medium">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((row) => (
                    <tr key={row.id} className="break-inside-avoid border-b border-line/70 align-top">
                      <td className="py-1.5 pr-2 tabular-nums">{shortDate(row.at)}</td>
                      <td className="py-1.5 pr-2 font-mono text-[11px] text-ink-muted">{row.id.slice(-8)}</td>
                      <td className="py-1.5 pr-2">
                        {row.kind === "JOB" ? row.services : `${KIND_LABELS[row.kind]} (${row.services})`}
                        {row.bookingType === "EMERGENCY" ? " · emergency" : ""}
                        {row.client ? <span className="text-ink-muted"> · {row.client}</span> : null}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{formatMoney(row.priceMinor)}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{row.tipMinor ? formatMoney(row.tipMinor) : "—"}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        −{formatMoney(row.commissionMinor + row.cardFeeMinor + row.bookingFeeMinor + row.deductionMinor)}
                      </td>
                      <td className="py-1.5 text-right font-semibold tabular-nums">{formatMoney(row.netMinor)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td className="py-2 pr-2" colSpan={3}>
                      Total
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{formatMoney(totals.priceMinor)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{formatMoney(totals.tipMinor)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      −{formatMoney(totals.commissionMinor + totals.cardFeeMinor + totals.bookingFeeMinor + totals.deductionMinor)}
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(totals.netMinor)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <footer className="mt-8 border-t border-line pt-4 text-[11px] leading-relaxed text-ink-muted">
          Fees are GLAMNET&rsquo;s commission as shown on each booking, the 2% card fee on bookings through your own
          link, the booking fee where one applies, and any amount deducted after a dispute. Tips are passed to you in full. This statement is a record of your GLAMNET earnings, not a tax
          document; keep it with your own records.
        </footer>
      </article>
    </div>
  );
}
