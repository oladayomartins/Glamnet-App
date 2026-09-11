import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { requireApiRole } from "@/lib/auth/api-guard";
import { requireOwnProvider } from "@/lib/auth/provider-guard";
import { CALENDAR_HOLDING_STATUSES } from "@/lib/server/schedules";
import { BookingError } from "@/lib/server/booking-service";

const createSchema = z
  .object({
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    reason: z.string().min(1).max(120),
  })
  .refine((block) => block.startAt < block.endAt, {
    message: "A blocked period must end after it starts.",
  });

const deleteSchema = z.object({ blockId: z.string().min(1) });

/**
 * POST /api/providers/:id/time-off — block a period out.
 *
 * Refuses a block that would cover a booking the vendor has already
 * accepted. Letting it through would leave them committed to a customer and
 * marked unavailable at the same moment, and the customer would find out on
 * the day. Cancel the booking first; that path tells the customer.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole(["PROVIDER", "ADMIN"]);
    if ("response" in auth) return auth.response;

    const { id } = await params;
    const denied = requireOwnProvider(auth.user, id);
    if (denied) return denied;

    const { startAt, endAt, reason } = createSchema.parse(await request.json());

    // Half-open overlap, matching the availability engine: a booking that ends
    // exactly when the block starts does not conflict.
    const clash = await prisma.booking.findFirst({
      where: {
        providerId: id,
        status: { in: [...CALENDAR_HOLDING_STATUSES] },
        appointmentStartAt: { lt: endAt },
        reservedUntilAt: { gt: startAt },
      },
      select: { id: true, appointmentStartAt: true },
    });

    if (clash) {
      throw new BookingError(
        `That period covers a booking you have already accepted on ${clash.appointmentStartAt.toLocaleDateString("en-GB")}. Cancel it first if you cannot make it.`,
        "INVALID_TRANSITION",
        409,
      );
    }

    const block = await prisma.providerTimeOff.create({
      data: { providerId: id, startAt, endAt, reason },
    });

    return NextResponse.json({ block }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/providers/:id/time-off — unblock a period. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole(["PROVIDER", "ADMIN"]);
    if ("response" in auth) return auth.response;

    const { id } = await params;
    const denied = requireOwnProvider(auth.user, id);
    if (denied) return denied;

    const { blockId } = deleteSchema.parse(await request.json());

    // Scoped by providerId as well as by id: the block id alone must not be
    // enough to clear somebody else's holiday.
    const removed = await prisma.providerTimeOff.deleteMany({
      where: { id: blockId, providerId: id },
    });

    if (removed.count === 0) {
      throw new BookingError("No such blocked period.", "NOT_FOUND", 404);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
