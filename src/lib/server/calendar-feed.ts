import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { CALENDAR_HOLDING_STATUSES } from "./schedules";
import { buildCalendar, type FeedEvent } from "@/lib/domain/ical";
import { formatDuration } from "@/lib/format";
import { siteUrl } from "@/lib/site";

/**
 * The vendor's calendar feed: their GLAMNET bookings and time off, for their
 * phone or laptop calendar to subscribe to.
 *
 * The link is the only key, so it is long and random, and the vendor can
 * reset it (cutting off every calendar that had the old one) or turn sync
 * off. The feed carries what a diary needs — service, client first name, time,
 * place — never the client's contact details or the vendor's private notes,
 * because subscribed calendars keep a copy on someone else's servers.
 */

/** How far back and ahead the feed reaches. */
const DAYS_BACK = 30;
const DAYS_AHEAD = 180;

const UNPAID = ["NOT_STARTED", "PENDING_AUTHORISATION", "AUTHORISATION_FAILED"];

function newToken() {
  return randomBytes(24).toString("base64url");
}

/** The feed's address, as https:// (Google, Outlook) and webcal:// (Apple). */
export function feedUrls(token: string) {
  const https = `${siteUrl()}/api/calendar/${token}.ics`;
  const webcal = https.replace(/^https?:\/\//, "webcal://");
  return {
    https,
    webcal,
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=${encodeURIComponent("GLAMNET bookings")}`,
  };
}

/** Turn sync on (or reset the link): a new token replaces any old one. */
export async function issueCalendarToken(providerId: string) {
  const token = newToken();
  await prisma.provider.update({ where: { id: providerId }, data: { calendarToken: token } });
  return token;
}

export async function revokeCalendarToken(providerId: string) {
  await prisma.provider.update({ where: { id: providerId }, data: { calendarToken: null } });
}

export async function calendarTokenFor(providerId: string) {
  const provider = await prisma.provider.findUnique({ where: { id: providerId }, select: { calendarToken: true } });
  return provider?.calendarToken ?? null;
}

/** The .ics text for a token, or null if no vendor has that link. */
export async function calendarFeed(token: string, now = new Date()): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const provider = await prisma.provider.findUnique({
    where: { calendarToken: token },
    select: { id: true, name: true, workspaceAddress: true, basePostcode: true },
  });
  if (!provider) return null;

  const from = new Date(now.getTime() - DAYS_BACK * 86_400_000);
  const to = new Date(now.getTime() + DAYS_AHEAD * 86_400_000);
  const [bookings, timeOff] = await Promise.all([
    prisma.booking.findMany({
      where: {
        providerId: provider.id,
        status: { in: [...CALENDAR_HOLDING_STATUSES] },
        appointmentStartAt: { gte: from, lt: to },
      },
      orderBy: { appointmentStartAt: "asc" },
      take: 2_000,
      select: {
        id: true,
        bookingType: true,
        paymentStatus: true,
        appointmentStartAt: true,
        serviceDurationMinutes: true,
        serviceLocation: true,
        sector: true,
        addressUnlocked: true,
        addressLine: true,
        rescheduleCount: true,
        customer: { select: { name: true } },
        items: { select: { name: true, kind: true } },
      },
    }),
    prisma.providerTimeOff.findMany({
      where: { providerId: provider.id, endAt: { gt: from }, startAt: { lt: to } },
      orderBy: { startAt: "asc" },
      select: { id: true, startAt: true, endAt: true, reason: true },
    }),
  ]);

  const workspace = [provider.workspaceAddress, provider.basePostcode].filter(Boolean).join(", ");
  const events: FeedEvent[] = bookings.map((booking) => {
    const services = booking.items.filter((item) => item.kind !== "ADDON").map((item) => item.name);
    const addOns = booking.items.filter((item) => item.kind === "ADDON").map((item) => item.name);
    const client = booking.customer.name.split(/\s+/)[0] || "Client";
    const atWorkspace = booking.serviceLocation === "VENDOR_PREMISES";
    const unpaid = UNPAID.includes(booking.paymentStatus);
    const url = `${siteUrl()}/bookings/${booking.id}`;
    return {
      uid: `booking-${booking.id}@glamnet`,
      start: booking.appointmentStartAt,
      end: new Date(booking.appointmentStartAt.getTime() + booking.serviceDurationMinutes * 60_000),
      summary: `${booking.bookingType === "EMERGENCY" ? "⚡ " : ""}${services.join(" + ") || "Booking"} — ${client}`,
      location: atWorkspace
        ? workspace || "Your workspace"
        : booking.addressUnlocked && booking.addressLine
          ? booking.addressLine
          : `${booking.sector} (client's address shows in GLAMNET when you unlock it)`,
      description: [
        `${client} · ${formatDuration(booking.serviceDurationMinutes)}${atWorkspace ? " · at your workspace" : " · you travel"}`,
        addOns.length ? `Add-ons: ${addOns.join(", ")}` : "",
        booking.bookingType === "EMERGENCY" ? "Emergency booking" : "",
        unpaid ? "The client's card isn't secured yet." : "",
        `Open in GLAMNET: ${url}`,
      ]
        .filter(Boolean)
        .join("\n"),
      url,
      sequence: booking.rescheduleCount,
      status: unpaid ? "TENTATIVE" : "CONFIRMED",
    };
  });

  for (const block of timeOff) {
    events.push({
      uid: `timeoff-${block.id}@glamnet`,
      start: block.startAt,
      end: block.endAt,
      summary: `Time off${block.reason && block.reason !== "Unavailable" ? ` — ${block.reason}` : ""}`,
      description: "Blocked in your GLAMNET diary: no bookings can land here.",
    });
  }

  return buildCalendar({ name: `GLAMNET — ${provider.name}`, events, now });
}
