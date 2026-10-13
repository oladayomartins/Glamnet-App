import Link from "next/link";
import { Card, EmptyState, LifecycleChip } from "@/components/ui";
import { formatDayTime, formatMoney } from "@/lib/format";
import type { AccountBooking } from "@/lib/server/admin/account-detail";

/**
 * A compact list of bookings for a person's page: when, with whom, what it
 * came to and where it stands. Each row opens the admin booking page.
 */
export function BookingTable({
  bookings,
  side,
  empty,
}: {
  bookings: AccountBooking[];
  /** Whose page this is: the other party is the one named in each row. */
  side: "customer" | "vendor";
  empty: string;
}) {
  if (bookings.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead className="border-b border-line font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Appointment</th>
            <th className="px-3 py-2 font-medium">{side === "customer" ? "Vendor" : "Customer"}</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Payment</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
            <th className="px-3 py-2 text-right font-medium">Rating</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {bookings.map((booking) => {
            const other = side === "customer" ? booking.provider : booking.customer;
            return (
              <tr key={booking.id} className="hover:bg-sunken">
                <td className="px-3 py-2">
                  <Link href={`/admin/bookings/${booking.id}`} className="font-medium text-ink hover:text-accent-700">
                    {formatDayTime(booking.appointmentStartAt)}
                  </Link>
                  <span className="block font-mono text-[10px] text-ink-muted">{booking.id}</span>
                </td>
                <td className="px-3 py-2">
                  {other ? (
                    <Link href={`/admin/accounts/${other.id}`} className="text-ink hover:text-accent-700">
                      {other.name}
                    </Link>
                  ) : (
                    <span className="text-ink-muted">Not yet assigned</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <LifecycleChip status={booking.status} size="sm" />
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-ink-muted">
                  {booking.paymentStatus.replaceAll("_", " ").toLowerCase()}
                  {booking.settlementStatus === "DISPUTED" ? <span className="block text-warning">disputed</span> : null}
                </td>
                <td data-numeric className="px-3 py-2 text-right tabular-nums text-ink">
                  {formatMoney(booking.totalInvoicePriceMinor)}
                  {booking.refundedMinor > 0 ? (
                    <span className="block text-[11px] text-warning">−{formatMoney(booking.refundedMinor)} refunded</span>
                  ) : null}
                </td>
                <td data-numeric className="px-3 py-2 text-right text-ink-muted">
                  {booking.rating ? `${booking.rating}★` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
