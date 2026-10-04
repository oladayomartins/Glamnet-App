import type { SessionUser } from "@/lib/auth/session";
import { BookingError } from "@/lib/server/booking-service";

/** The signed-in person as a side of a booking: its client or its vendor. */
export function partyOf(user: SessionUser):
  | { role: "CUSTOMER"; customerId: string }
  | { role: "PROVIDER"; providerId: string } {
  if (user.role === "CUSTOMER" && user.customerId) return { role: "CUSTOMER", customerId: user.customerId };
  if (user.role === "PROVIDER" && user.providerId) return { role: "PROVIDER", providerId: user.providerId };
  throw new BookingError("Booking not found.", "NOT_FOUND", 404);
}
