import type { Prisma } from "@prisma/client";

/** The admin bookings list's filters, shared by the page and its CSV export. */
export const BOOKING_FILTERS = [
  "ALL",
  "NORMAL",
  "EMERGENCY",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "DISPUTED",
] as const;
export type BookingFilter = (typeof BOOKING_FILTERS)[number];

export function parseBookingFilter(value: string | null | undefined): BookingFilter {
  return (BOOKING_FILTERS as readonly string[]).includes(value ?? "") ? (value as BookingFilter) : "ALL";
}

export function bookingFilterWhere(filter: BookingFilter): Prisma.BookingWhereInput {
  if (filter === "NORMAL" || filter === "EMERGENCY") return { bookingType: filter };
  if (filter === "ALL") return {};
  // A payment dispute lives on settlementStatus; a lifecycle one on status.
  if (filter === "DISPUTED") return { OR: [{ status: "DISPUTED" }, { settlementStatus: "DISPUTED" }] };
  return { status: filter };
}

/** A booking id, or part of a customer's or vendor's name or email. */
export function bookingSearchWhere(q: string): Prisma.BookingWhereInput {
  if (!q) return {};
  const text = { contains: q, mode: "insensitive" as const };
  return {
    OR: [
      { id: { startsWith: q } },
      { customer: { OR: [{ name: text }, { email: text }] } },
      { provider: { OR: [{ name: text }, { email: text }] } },
    ],
  };
}

export function bookingListWhere(filter: BookingFilter, q: string): Prisma.BookingWhereInput {
  return { AND: [bookingFilterWhere(filter), bookingSearchWhere(q)] };
}
