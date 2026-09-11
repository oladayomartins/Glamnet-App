import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/server/prisma";
import { BookingTypeTag, EmptyState, SectionTitle, StatusPill } from "@/components/ui";
import { formatDayTime, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Where every signed-in user lands: their role decides what they see. */
export default async function AccountPage() {
  const user = await requireUser("/account");

  const bookings = user.customerId
    ? await prisma.booking.findMany({
        where: { customerId: user.customerId },
        orderBy: { appointmentStartAt: "desc" },
        take: 20,
        include: { items: true, provider: { select: { name: true } } },
      })
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Your account</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {user.email} · {user.role.toLowerCase()}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/book"
          className="rounded-glam-sm bg-brand-700 px-4 py-2.5 text-sm font-semibold text-on-brand"
        >
          Book a service
        </Link>
        {user.role === "PROVIDER" ? (
          <Link
            href={user.providerApproved ? `/provider/${user.providerId}` : "/provider/pending"}
            className="rounded-glam-sm bg-surface px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-line"
          >
            Provider dashboard
          </Link>
        ) : null}
        {user.role === "ADMIN" ? (
          <Link
            href="/admin"
            className="rounded-glam-sm bg-surface px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-line"
          >
            Admin dashboard
          </Link>
        ) : null}
        <form action="/auth/sign-out" method="post">
          <button
            type="submit"
            className="rounded-glam-sm px-4 py-2.5 text-sm font-medium text-ink-muted hover:text-ink"
          >
            Sign out
          </button>
        </form>
      </div>

      <section>
        <SectionTitle hint={`${bookings.length} shown`}>Your bookings</SectionTitle>
        {bookings.length === 0 ? (
          <EmptyState>
            No bookings yet.{" "}
            <Link href="/book" className="font-semibold text-brand-700 hover:underline">
              Book your first service
            </Link>
            .
          </EmptyState>
        ) : (
          <div className="space-y-2">
            {bookings.map((booking) => (
              <Link
                key={booking.id}
                href={`/bookings/${booking.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-glam border border-line bg-surface p-3 shadow-card transition hover:border-brand-400"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <BookingTypeTag bookingType={booking.bookingType} size="sm" />
                    <StatusPill status={booking.status} />
                    <span className="text-sm font-semibold text-ink">
                      {formatDayTime(booking.appointmentStartAt)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-ink-muted">
                    {booking.items.map((item) => item.name).join(" + ")}
                    {booking.provider ? ` · ${booking.provider.name}` : " · awaiting provider"}
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums text-ink">
                  {formatMoney(booking.totalInvoicePriceMinor)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
