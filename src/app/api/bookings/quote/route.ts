import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { quoteSchema } from "@/lib/api/schemas";
import { quoteBooking } from "@/lib/server/booking-service";
import { formatNotice } from "@/lib/domain/classification";

/**
 * POST /api/bookings/quote — the checkout preview.
 *
 * Returns the classification, the duration and the full itemised price so the
 * emergency surcharge is on screen before payment authorisation (spec §4).
 */
export async function POST(request: Request) {
  try {
    const input = quoteSchema.parse(await request.json());
    const { eligibleProviderIds, ...quote } = await quoteBooking(input);

    return NextResponse.json({
      quote: {
        ...quote,
        noticeLabel: formatNotice(quote.noticePeriodMinutes),
        isEmergency: quote.bookingType === "EMERGENCY",
        // The shortlist itself is internal: the customer sees only the count.
        providersAvailable: eligibleProviderIds.length,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
