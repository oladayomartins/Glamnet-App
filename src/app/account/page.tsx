import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/server/prisma";
import { BookingTypeTag, EmptyState, SectionTitle, LifecycleChip } from "@/components/ui";
import { formatCustomerDayTime, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

/** The three ways a customer looks for one of their own bookings (§C-11). */
const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
] as const;

type Tab = (typeof TABS)[number]["key"];

/** Where every signed-in user lands: their role decides what they see. */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [user, { tab: requestedTab }] = await Promise.all([
    requireUser("/account"),
    searchParams,
  ]);

  // Every sign-in, sign-up and email link lands here, so this is where each
  // account type is sent to its own dashboard. The role was fixed at sign-up
  // and is read from the database, never from the URL. /provider picks the
  // storefront wizard, the review screen or the live dashboard for a pro.
  if (user.role === "PROVIDER") redirect("/provider");
  if (user.role === "ADMIN") redirect("/admin");

  const tab: Tab = TABS.some((entry) => entry.key === requestedTab)
    ? (requestedTab as Tab)
    : "upcoming";

  const now = new Date();
  // Cancelled and disputed bookings leave the timeline entirely rather than
  // sitting in Past: a customer looking for what happened wants the ones that
  // happened.
  const closed = ["CANCELLED", "EXPIRED", "DISPUTED"];
  const tabFilter =
    tab === "cancelled"
      ? { status: { in: closed } }
      : tab === "past"
        ? {
            status: { notIn: closed },
            appointmentStartAt: { lt: now },
          }
        : {
            status: { notIn: closed },
            appointmentStartAt: { gte: now },
          };

  const bookings = user.customerId
    ? await prisma.booking.findMany({
        where: { customerId: user.customerId, ...tabFilter },
        // Upcoming reads forwards from now; the other two read backwards from
        // the most recent.
        orderBy: { appointmentStartAt: tab === "upcoming" ? "asc" : "desc" },
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

        <div
          className="mb-3 flex flex-wrap gap-2"
          role="tablist"
          aria-label="Booking history"
        >
          {TABS.map((entry) => (
            <Link
              key={entry.key}
              href={`/account?tab=${entry.key}`}
              role="tab"
              aria-selected={tab === entry.key}
              className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition duration-[180ms] ease-glam ${
                tab === entry.key
                  ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                  : "bg-surface text-ink-muted ring-1 ring-line hover:text-ink"
              }`}
            >
              {entry.label}
            </Link>
          ))}
        </div>

        {bookings.length === 0 ? (
          <EmptyState
            icon={<CalendarBlank size={24} weight="light" />}
            title={
              tab === "upcoming"
                ? "Nothing booked yet"
                : tab === "past"
                  ? "No completed bookings"
                  : "Nothing cancelled"
            }
            action={
              <Link
                href="/"
                className="inline-flex min-h-11 items-center rounded-full bg-metal px-6 text-sm font-bold text-metal-ink active:scale-[0.98]"
              >
                Find a vendor
              </Link>
            }
          >
            {tab === "upcoming"
              ? "When you book someone, the appointment and its live status appear here."
              : "Bookings move into this tab once they are behind you."}
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
                    <LifecycleChip status={booking.status} />
                    <span className="text-sm font-semibold text-ink">
                      {formatCustomerDayTime(booking.appointmentStartAt)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-ink-muted">
                    {booking.items.map((item) => item.name).join(" + ")}
                    {booking.provider ? ` · ${booking.provider.name}` : " · awaiting vendor"}
                  </p>
                </div>
                <span data-numeric className="text-sm font-bold text-ink">
                  {formatMoney(booking.totalInvoicePriceMinor + booking.tipMinor - booking.discountMinor)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
