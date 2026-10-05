import { prisma } from "./prisma";
import { BookingError } from "./booking-service";
import {
  CLIENT_NOTE_MAX_LENGTH,
  countsAsClientBooking,
  matchesClient,
  summariseClient,
  summariseClients,
  type ClientBooking,
} from "@/lib/domain/clients";

/**
 * A vendor's clients and their private notes about them.
 *
 * Built only from this vendor's own bookings, and the client is shown by name
 * alone: no email, phone or home address. The note is the vendor's and nobody
 * else's — not the client's, not another vendor's.
 */

const BOOKING_SELECT = {
  id: true,
  customerId: true,
  status: true,
  paymentStatus: true,
  appointmentStartAt: true,
  providerPayoutMinor: true,
  rating: true,
  customer: { select: { name: true } },
} as const;

type Row = {
  id: string;
  customerId: string;
  status: string;
  paymentStatus: string;
  appointmentStartAt: Date;
  providerPayoutMinor: number;
  rating: number | null;
  customer: { name: string };
};

function toClientBooking(row: Row): ClientBooking {
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: row.customer.name,
    status: row.status,
    paymentStatus: row.paymentStatus,
    appointmentStartAt: row.appointmentStartAt,
    providerPayoutMinor: row.providerPayoutMinor,
    rating: row.rating,
  };
}

export async function listClients(providerId: string, query = "", now = new Date()) {
  const [rows, notes] = await Promise.all([
    prisma.booking.findMany({
      where: { providerId },
      select: BOOKING_SELECT,
      orderBy: { appointmentStartAt: "desc" },
      take: 5_000,
    }),
    prisma.providerClientNote.findMany({
      where: { providerId, note: { not: "" } },
      select: { customerId: true, note: true },
    }),
  ]);
  const noteFor = new Map(notes.map((entry) => [entry.customerId, entry.note]));
  return summariseClients(rows.map(toClientBooking), now)
    .filter((client) => matchesClient(client.name, query))
    .map((client) => ({ ...client, note: noteFor.get(client.customerId) ?? "" }));
}

/** One client's history with this vendor, or 404 if they aren't a client. */
export async function getClient(providerId: string, customerId: string, now = new Date()) {
  const rows = await prisma.booking.findMany({
    where: { providerId, customerId },
    orderBy: { appointmentStartAt: "desc" },
    select: {
      ...BOOKING_SELECT,
      reviewNote: true,
      serviceLocation: true,
      items: { select: { name: true, kind: true } },
    },
  });
  const real = rows.filter(countsAsClientBooking);
  if (real.length === 0) throw new BookingError("Client not found.", "NOT_FOUND", 404);

  const note = await prisma.providerClientNote.findUnique({
    where: { providerId_customerId: { providerId, customerId } },
    select: { note: true, updatedAt: true },
  });
  return {
    summary: summariseClient(real.map(toClientBooking), now),
    note: note?.note ?? "",
    noteUpdatedAt: note?.updatedAt ?? null,
    bookings: real.map((row) => ({
      id: row.id,
      status: row.status,
      at: row.appointmentStartAt,
      services: row.items.map((item) => (item.kind === "ADDON" ? `${item.name} (add-on)` : item.name)),
      payoutMinor: row.providerPayoutMinor,
      rating: row.rating,
      reviewNote: row.reviewNote,
      atWorkspace: row.serviceLocation === "VENDOR_PREMISES",
    })),
  };
}

/** Whether this customer has a real booking with this vendor. */
async function isClient(providerId: string, customerId: string) {
  const rows = await prisma.booking.findMany({
    where: { providerId, customerId },
    select: { status: true, paymentStatus: true },
    take: 50,
  });
  return rows.some(countsAsClientBooking);
}

/** Save the vendor's private note about a client. An empty note clears it. */
export async function saveClientNote(providerId: string, customerId: string, text: string) {
  const note = text.trim();
  if (note.length > CLIENT_NOTE_MAX_LENGTH) {
    throw new BookingError(`Keep the note under ${CLIENT_NOTE_MAX_LENGTH} characters.`, "INVALID_TRANSITION", 422);
  }
  if (!(await isClient(providerId, customerId))) {
    throw new BookingError("Client not found.", "NOT_FOUND", 404);
  }
  return prisma.providerClientNote.upsert({
    where: { providerId_customerId: { providerId, customerId } },
    create: { providerId, customerId, note },
    update: { note },
    select: { note: true, updatedAt: true },
  });
}

/** The vendor's note on one client, for their job page. */
export async function clientNoteFor(providerId: string, customerId: string) {
  const entry = await prisma.providerClientNote.findUnique({
    where: { providerId_customerId: { providerId, customerId } },
    select: { note: true },
  });
  return entry?.note ?? "";
}
