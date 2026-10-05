import Link from "next/link";
import { notFound } from "next/navigation";
import { Star } from "@phosphor-icons/react/dist/ssr";
import { BookingError } from "@/lib/server/booking-service";
import { getClient } from "@/lib/server/clients";
import { Card, LifecycleChip, SectionTitle } from "@/components/ui";
import { ClientNoteEditor } from "@/components/client-note-editor";
import { formatDay, formatDayTime, formatMoney } from "@/lib/format";
import { requireVendorPage } from "../../access";

export const dynamic = "force-dynamic";

/** One client: the vendor's private note, and every booking between them. */
export default async function VendorClientPage({
  params,
}: {
  params: Promise<{ id: string; customerId: string }>;
}) {
  const { id, customerId } = await params;
  const viewer = await requireVendorPage(id, `/provider/${id}/clients/${customerId}`);
  const client = await getClient(id, customerId).catch((error) => {
    if (error instanceof BookingError && error.status === 404) return null;
    throw error;
  });
  if (!client) notFound();
  const { summary } = client;
  const isOwner = viewer.providerId === id;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/provider/${id}/clients`} className="inline-flex min-h-11 items-center text-sm text-ink-muted hover:text-brand-700">
          ← Clients
        </Link>
        <h1 className="font-display text-[28px] font-bold leading-tight text-ink">{summary.name}</h1>
        <p className="mt-1 text-sm text-ink-muted" data-numeric>
          {summary.visits === 0 ? "New client" : `${summary.visits} ${summary.visits === 1 ? "visit" : "visits"}`}
          {summary.earnedMinor > 0 ? ` · ${formatMoney(summary.earnedMinor)} earned` : ""}
          {summary.lastVisitAt ? ` · last seen ${formatDay(summary.lastVisitAt)}` : ""}
          {summary.noShows > 0 ? ` · ${summary.noShows} no-show${summary.noShows === 1 ? "" : "s"}` : ""}
        </p>
      </div>

      {summary.nextBookingAt && summary.nextBookingId ? (
        <Link href={`/bookings/${summary.nextBookingId}`} className="block">
          <Card className="border-accent-500/50 p-4 hover:border-accent-500">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">Next booking</p>
            <p className="mt-1 text-[17px] font-semibold text-ink">{formatDayTime(summary.nextBookingAt)} →</p>
          </Card>
        </Link>
      ) : null}

      <Card className="p-4">
        <SectionTitle>Your notes</SectionTitle>
        {isOwner ? (
          <ClientNoteEditor customerId={customerId} clientName={summary.name} initialNote={client.note} />
        ) : (
          <p className="whitespace-pre-line text-[15px] text-ink">{client.note || "No notes."}</p>
        )}
      </Card>

      <section>
        <SectionTitle hint={`${client.bookings.length} in total`}>History</SectionTitle>
        <ul className="space-y-2">
          {client.bookings.map((booking) => (
            <li key={booking.id}>
              <Link href={`/bookings/${booking.id}`} className="block">
                <Card className="p-4 transition duration-[180ms] hover:border-accent-500/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[15px] font-semibold text-ink">{formatDayTime(booking.at)}</span>
                    <LifecycleChip status={booking.status} size="sm" />
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {booking.services.join(" + ")}
                    {booking.atWorkspace ? " · at your workspace" : " · at their address"}
                    {booking.payoutMinor > 0 && ["COMPLETED", "REVIEWED", "PAYMENT_RELEASED"].includes(booking.status)
                      ? ` · ${formatMoney(booking.payoutMinor)}`
                      : ""}
                  </p>
                  {booking.rating !== null ? (
                    <p className="mt-2 flex items-start gap-1.5 text-sm text-ink">
                      <Star size={14} weight="fill" className="mt-0.5 shrink-0 text-accent-500" aria-hidden />
                      <span>
                        {booking.rating}/5{booking.reviewNote ? ` — “${booking.reviewNote}”` : ""}
                      </span>
                    </p>
                  ) : null}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
