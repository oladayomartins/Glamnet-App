import { prisma } from "./prisma";
import { BookingError } from "./booking-service";
import { CALENDAR_HOLDING_STATUSES, loadProviderSchedule } from "./schedules";
import { holdSavedCard } from "./payment-flow";
import { deliverBookingNotice, formatAppointment } from "./notifications";
import {
  addDays,
  addMinutes,
  buildDayGrid,
  isProviderAvailable,
  reservationWindow,
  startOfLocalDay,
  summariseDays,
  type ProviderSchedule,
} from "@/lib/domain/availability";
import {
  latestStartForHold,
  newTimeProblem,
  rescheduleBlocker,
  RESCHEDULE_DAYS_AHEAD,
  RESCHEDULE_MIN_NOTICE_MINUTES,
} from "@/lib/domain/reschedule";
import { holdIsDue } from "@/lib/domain/payment-rules";
import { ukDateString } from "@/lib/domain/uk-time";

/**
 * Moving a booking to a new time: one side suggests, the other accepts.
 *
 * The vendor's diary is checked when the time is suggested and again, under
 * the same per-vendor lock checkout uses, when it is accepted — a slot can be
 * taken by someone else in between.
 */

export type Party = { role: "CUSTOMER"; customerId: string } | { role: "PROVIDER"; providerId: string };

const SELECT = {
  id: true,
  status: true,
  paymentStatus: true,
  bookingType: true,
  appointmentStartAt: true,
  reservedUntilAt: true,
  serviceDurationMinutes: true,
  reservedDurationMinutes: true,
  holdAuthorisedAt: true,
  rescheduleCount: true,
  rescheduleStartAt: true,
  rescheduleBy: true,
  customerId: true,
  providerId: true,
  customer: { select: { name: true, email: true } },
  provider: { select: { name: true, email: true } },
} as const;

async function loadFor(bookingId: string, party: Party) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: SELECT });
  const isParty =
    booking &&
    ((party.role === "CUSTOMER" && booking.customerId === party.customerId) ||
      (party.role === "PROVIDER" && booking.providerId !== null && booking.providerId === party.providerId));
  if (!booking || !isParty) throw new BookingError("Booking not found.", "NOT_FOUND", 404);
  return booking;
}

type Loaded = Awaited<ReturnType<typeof loadFor>>;

/** The vendor's diary over a range, without this booking's own slot in it. */
async function scheduleWithout(booking: Loaded, from: Date, to: Date): Promise<ProviderSchedule | null> {
  const schedule = await loadProviderSchedule(booking.providerId!, from, to);
  if (!schedule) return null;
  const ownStart = booking.appointmentStartAt.getTime();
  const ownEnd = booking.reservedUntilAt.getTime();
  return {
    ...schedule,
    reservations: schedule.reservations.filter(
      (held) => !(held.startAt.getTime() === ownStart && held.endAt.getTime() === ownEnd),
    ),
  };
}

function notBefore(now: Date) {
  return addMinutes(now, RESCHEDULE_MIN_NOTICE_MINUTES);
}

/** How many days the picker offers: fewer when a card hold limits it. */
function daysOffered(booking: Loaded, now: Date) {
  const latest = latestStartForHold(booking);
  if (!latest) return RESCHEDULE_DAYS_AHEAD;
  const span = Math.floor((startOfLocalDay(latest).getTime() - startOfLocalDay(now).getTime()) / 86_400_000) + 1;
  return Math.max(0, Math.min(RESCHEDULE_DAYS_AHEAD, span));
}

/** The day picker for a new time. */
export async function rescheduleDays(bookingId: string, party: Party, now = new Date()) {
  const booking = await loadFor(bookingId, party);
  const blocker = rescheduleBlocker(booking);
  if (blocker) throw new BookingError(blocker, "INVALID_TRANSITION", 409);
  const days = daysOffered(booking, now);
  const start = startOfLocalDay(now);
  const schedule = await scheduleWithout(booking, start, addDays(start, days + 1));
  if (!schedule) return [];
  const latest = latestStartForHold(booking);
  return summariseDays(start, days, booking.serviceDurationMinutes, schedule, notBefore(now)).map((day) => {
    // A day the hold can only partly cover counts as free only if its first
    // opening is inside the limit.
    const firstOk = day.firstStartAt && (!latest || day.firstStartAt.getTime() <= latest.getTime());
    return {
      date: ukDateString(day.date),
      status: day.status === "free" && !firstOk ? "full" : day.status,
    };
  });
}

/** Free start times on one day for this booking's length. */
export async function rescheduleSlots(bookingId: string, party: Party, date: Date, now = new Date()) {
  const booking = await loadFor(bookingId, party);
  const blocker = rescheduleBlocker(booking);
  if (blocker) throw new BookingError(blocker, "INVALID_TRANSITION", 409);
  const dayStart = startOfLocalDay(date);
  const schedule = await scheduleWithout(booking, dayStart, addDays(dayStart, 2));
  if (!schedule) return [];
  return buildDayGrid(dayStart, booking.serviceDurationMinutes, [schedule], notBefore(now))
    .filter((slot) => slot.availableProviderIds.length > 0)
    .filter((slot) => !newTimeProblem(booking, slot.startAt, now))
    .map((slot) => slot.startAt.toISOString());
}

async function assertFree(booking: Loaded, startAt: Date) {
  const window = reservationWindow(startAt, booking.serviceDurationMinutes);
  const schedule = await scheduleWithout(booking, window.startAt, window.endAt);
  if (!schedule || !isProviderAvailable(schedule, startAt, booking.serviceDurationMinutes)) {
    throw new BookingError("That time isn't free in the vendor's diary. Choose another.", "ALREADY_TAKEN", 409);
  }
}

function otherSide(party: Party) {
  return party.role === "CUSTOMER" ? "PROVIDER" : "CUSTOMER";
}

async function tell(booking: Loaded, audience: "CUSTOMER" | "PROVIDER", title: string, body: string) {
  await prisma.notification.create({
    data: {
      bookingId: booking.id,
      audience,
      providerId: audience === "PROVIDER" ? booking.providerId : null,
      channel: "PUSH",
      bookingType: booking.bookingType,
      title,
      body,
    },
  });
  const to = audience === "PROVIDER" ? booking.provider?.email : booking.customer.email;
  const name = audience === "PROVIDER" ? (booking.provider?.name ?? "") : booking.customer.name;
  if (to) {
    await deliverBookingNotice({
      to,
      name: name.split(/\s+/)[0] || name,
      bookingId: booking.id,
      subject: title,
      heading: title,
      lead: body,
      cta: "Open booking",
    });
  }
}

/** Suggest a new time. Replaces any suggestion of your own still open. */
export async function proposeReschedule(bookingId: string, party: Party, startAt: Date, now = new Date()) {
  const booking = await loadFor(bookingId, party);
  const blocker = rescheduleBlocker(booking);
  if (blocker) throw new BookingError(blocker, "INVALID_TRANSITION", 409);
  if (booking.rescheduleStartAt && booking.rescheduleBy && booking.rescheduleBy !== party.role) {
    throw new BookingError("There's already a new time waiting for your answer.", "INVALID_TRANSITION", 409);
  }
  const problem = newTimeProblem(booking, startAt, now);
  if (problem) throw new BookingError(problem, "INVALID_TRANSITION", 422);
  await assertFree(booking, startAt);

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data: { rescheduleStartAt: startAt, rescheduleBy: party.role, rescheduleRequestedAt: now },
    }),
    prisma.bookingStatusEvent.create({
      data: {
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: booking.status,
        actor: party.role,
        note: `Suggested moving to ${startAt.toISOString()}.`,
      },
    }),
  ]);

  const who = party.role === "CUSTOMER" ? booking.customer.name.split(/\s+/)[0] || "Your client" : booking.provider?.name ?? "Your vendor";
  await tell(
    booking,
    otherSide(party),
    "New time suggested",
    `${who} asked to move your appointment from ${formatAppointment(booking.appointmentStartAt)} to ${formatAppointment(startAt)}. Open the booking to accept or decline.`,
  );
}

/**
 * Answer a suggestion. The other side accepts or declines; whoever made it
 * can withdraw it (a decline from them).
 */
export async function answerReschedule(bookingId: string, party: Party, accept: boolean, now = new Date()) {
  const booking = await loadFor(bookingId, party);
  const proposed = booking.rescheduleStartAt;
  if (!proposed || !booking.rescheduleBy) {
    throw new BookingError("There's no new time waiting on this booking.", "INVALID_TRANSITION", 409);
  }
  const own = booking.rescheduleBy === party.role;
  if (own && accept) {
    throw new BookingError("The other side needs to accept your suggestion.", "INVALID_TRANSITION", 409);
  }

  if (!accept) {
    await prisma.$transaction([
      prisma.booking.update({
        where: { id: booking.id },
        data: { rescheduleStartAt: null, rescheduleBy: "", rescheduleRequestedAt: null },
      }),
      prisma.bookingStatusEvent.create({
        data: {
          bookingId: booking.id,
          fromStatus: booking.status,
          toStatus: booking.status,
          actor: party.role,
          note: own ? "Withdrew the suggested new time." : "Declined the suggested new time.",
        },
      }),
    ]);
    if (!own) {
      await tell(
        booking,
        otherSide(party),
        "New time declined",
        `Your appointment stays at ${formatAppointment(booking.appointmentStartAt)}. Message them on the booking to find another time.`,
      );
    }
    return;
  }

  const blocker = rescheduleBlocker(booking);
  if (blocker) throw new BookingError(blocker, "INVALID_TRANSITION", 409);
  const problem = newTimeProblem(booking, proposed, now);
  if (problem) throw new BookingError(`That suggested time no longer works: ${problem}`, "INVALID_TRANSITION", 422);

  const window = reservationWindow(proposed, booking.serviceDurationMinutes);
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.providerId!}))`;
      const conflict = await tx.booking.findFirst({
        where: {
          id: { not: booking.id },
          providerId: booking.providerId,
          status: { in: [...CALENDAR_HOLDING_STATUSES] },
          appointmentStartAt: { lt: window.endAt },
          reservedUntilAt: { gt: window.startAt },
        },
        select: { id: true },
      });
      if (conflict) {
        throw new BookingError("That time has just been taken. Suggest another.", "ALREADY_TAKEN", 409);
      }
      await assertFree(booking, proposed);
      // Only the suggestion we read moves the booking: a second accept, or a
      // suggestion replaced meanwhile, changes nothing.
      const moved = await tx.booking.updateMany({
        where: { id: booking.id, rescheduleStartAt: proposed, status: { in: [booking.status] } },
        data: {
          appointmentStartAt: proposed,
          reservedUntilAt: addMinutes(proposed, booking.reservedDurationMinutes),
          rescheduleStartAt: null,
          rescheduleBy: "",
          rescheduleRequestedAt: null,
          rescheduleCount: { increment: 1 },
          // The "free cancellation ends soon" reminder is about the old time.
          reminderSentAt: null,
        },
      });
      if (moved.count === 0) {
        throw new BookingError("This booking changed meanwhile. Refresh and try again.", "INVALID_TRANSITION", 409);
      }
      await tx.bookingStatusEvent.create({
        data: {
          bookingId: booking.id,
          fromStatus: booking.status,
          toStatus: booking.status,
          actor: party.role,
          note: `Moved from ${booking.appointmentStartAt.toISOString()} to ${proposed.toISOString()}.`,
        },
      });
    },
    { maxWait: 8_000, timeout: 15_000 },
  );

  // A saved card whose hold is now due is held straight away, rather than
  // waiting for the daily sweep.
  if (booking.paymentStatus === "CARD_SAVED" && holdIsDue(proposed, now)) {
    await holdSavedCard(booking.id, now).catch((error) => console.error("[reschedule] hold failed", booking.id, error));
  }

  await tell(
    booking,
    otherSide(party),
    "Appointment moved",
    `Your appointment is now ${formatAppointment(proposed)} (was ${formatAppointment(booking.appointmentStartAt)}).`,
  );
}

/** For the booking page: the open suggestion, if any, in plain fields. */
export function pendingReschedule(booking: { rescheduleStartAt: Date | null; rescheduleBy: string }) {
  if (!booking.rescheduleStartAt || !booking.rescheduleBy) return null;
  return { startAt: booking.rescheduleStartAt.toISOString(), by: booking.rescheduleBy as "CUSTOMER" | "PROVIDER" };
}

