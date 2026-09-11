import { BROADCAST_FANOUT } from "./constants";
import { isProviderAvailable, type ProviderSchedule } from "./availability";

export interface MatchCandidate {
  providerId: string;
  /** Sector code the vendor covers, e.g. "S11". */
  sectors: readonly string[];
  /** Service ids the vendor is qualified to deliver. */
  serviceIds: readonly string[];
  /** 0–5 average customer rating; the primary ranking signal. */
  rating: number;
  /** Completed bookings — the tiebreak, favouring proven vendors. */
  completedBookings: number;
  schedule: ProviderSchedule;
}

export interface MatchRequest {
  sector: string;
  /** Service ids on the basket (add-ons excluded). */
  requiredServiceIds: readonly string[];
  appointmentStartAt: Date;
  /** Service duration only — the buffer is added by the availability check. */
  serviceDurationMinutes: number;
}

/**
 * Eligible vendors for a request, best first.
 *
 * Eligibility is geographic + skill + calendar. The calendar test uses the same
 * `isProviderAvailable` gate as the customer slot picker, including the
 * 15-minute transition buffer, so an emergency booking can never be broadcast
 * into a conflicting slot (spec §7).
 */
export function findEligibleProviders(
  candidates: readonly MatchCandidate[],
  request: MatchRequest,
): MatchCandidate[] {
  return candidates
    .filter((candidate) => candidate.sectors.includes(request.sector))
    .filter((candidate) =>
      request.requiredServiceIds.every((serviceId) =>
        candidate.serviceIds.includes(serviceId),
      ),
    )
    .filter((candidate) =>
      isProviderAvailable(
        candidate.schedule,
        request.appointmentStartAt,
        request.serviceDurationMinutes,
      ),
    )
    .sort(
      (a, b) =>
        b.rating - a.rating || b.completedBookings - a.completedBookings,
    );
}

/**
 * The shortlist a request is broadcast to (spec §13: "Broadcast to Top 5
 * Eligible Vendors"). First to accept wins; acceptance is serialised in the
 * database so a tie cannot double-book.
 */
export function selectBroadcastTargets(
  candidates: readonly MatchCandidate[],
  request: MatchRequest,
  fanout: number = BROADCAST_FANOUT,
): MatchCandidate[] {
  return findEligibleProviders(candidates, request).slice(0, fanout);
}
