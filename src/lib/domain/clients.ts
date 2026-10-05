/**
 * A vendor's client list, built from their bookings. Pure, so it can be
 * tested without a database.
 *
 * A client is anyone with a real booking with this vendor: an expired
 * request, or a checkout abandoned before the card went in, never made
 * them a client.
 */

/** The work was done (whether or not the money has moved yet). */
export const VISIT_STATUSES = ["COMPLETED", "REVIEWED", "PAYMENT_RELEASED", "DISPUTED"];

/** Booked and still ahead. */
const UPCOMING_STATUSES = ["ACCEPTED", "CONFIRMED", "ADDRESS_UNLOCKED", "PROVIDER_EN_ROUTE", "ARRIVED", "IN_PROGRESS"];

const UNPAID = ["NOT_STARTED", "PENDING_AUTHORISATION"];

export const CLIENT_NOTE_MAX_LENGTH = 2_000;

export interface ClientBooking {
  id: string;
  customerId: string;
  customerName: string;
  status: string;
  paymentStatus: string;
  appointmentStartAt: Date;
  providerPayoutMinor: number;
  rating: number | null;
}

/** Whether this booking makes its customer one of the vendor's clients. */
export function countsAsClientBooking(booking: Pick<ClientBooking, "status" | "paymentStatus">): boolean {
  if (booking.status === "EXPIRED") return false;
  // A checkout left before the card went in (the booking flow expires these,
  // but not always before someone looks).
  if (UNPAID.includes(booking.paymentStatus) && ["REQUESTED", "BROADCAST", "ACCEPTED"].includes(booking.status)) {
    return false;
  }
  return true;
}

export interface ClientSummary {
  customerId: string;
  name: string;
  visits: number;
  /** What the vendor has been paid, or will be, for the visits. */
  earnedMinor: number;
  lastVisitAt: Date | null;
  nextBookingAt: Date | null;
  nextBookingId: string | null;
  cancellations: number;
  noShows: number;
  /** Average of the ratings this client gave, or null. */
  averageRating: number | null;
}

export function summariseClients(bookings: readonly ClientBooking[], now = new Date()): ClientSummary[] {
  const byClient = new Map<string, ClientBooking[]>();
  for (const booking of bookings) {
    if (!countsAsClientBooking(booking)) continue;
    const list = byClient.get(booking.customerId) ?? [];
    list.push(booking);
    byClient.set(booking.customerId, list);
  }

  return [...byClient.values()].map((list) => summariseClient(list, now)).sort(byRecency);
}

export function summariseClient(list: readonly ClientBooking[], now = new Date()): ClientSummary {
  const visits = list.filter((booking) => VISIT_STATUSES.includes(booking.status));
  const upcoming = list
    .filter((booking) => UPCOMING_STATUSES.includes(booking.status) && booking.appointmentStartAt.getTime() >= now.getTime() - 6 * 60 * 60 * 1_000)
    .sort((a, b) => a.appointmentStartAt.getTime() - b.appointmentStartAt.getTime());
  const ratings = list.map((booking) => booking.rating).filter((rating): rating is number => rating !== null);
  const last = visits.reduce<Date | null>(
    (latest, booking) => (!latest || booking.appointmentStartAt > latest ? booking.appointmentStartAt : latest),
    null,
  );
  return {
    customerId: list[0].customerId,
    name: list[0].customerName,
    visits: visits.length,
    earnedMinor: visits.reduce((sum, booking) => sum + booking.providerPayoutMinor, 0),
    lastVisitAt: last,
    nextBookingAt: upcoming[0]?.appointmentStartAt ?? null,
    nextBookingId: upcoming[0]?.id ?? null,
    cancellations: list.filter((booking) => booking.status === "CANCELLED").length,
    noShows: list.filter((booking) => booking.status === "NO_SHOW").length,
    averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
  };
}

/** Coming up first (soonest first), then most recently seen. */
function byRecency(a: ClientSummary, b: ClientSummary): number {
  if (a.nextBookingAt && b.nextBookingAt) return a.nextBookingAt.getTime() - b.nextBookingAt.getTime();
  if (a.nextBookingAt) return -1;
  if (b.nextBookingAt) return 1;
  return (b.lastVisitAt?.getTime() ?? 0) - (a.lastVisitAt?.getTime() ?? 0) || a.name.localeCompare(b.name);
}

/** Case- and accent-insensitive name match for the search box. */
export function matchesClient(name: string, query: string): boolean {
  const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const wanted = fold(query.trim());
  return wanted === "" || fold(name).includes(wanted);
}
