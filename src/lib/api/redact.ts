/**
 * Strip the customer's checkout PIN from a booking before it leaves the
 * server. The PIN is the customer's proof of satisfaction: if the vendor
 * could read it from any response, releasing payment would need no customer
 * at all. Only the customer's own booking page ever renders it.
 */
export function withoutPin<T extends { completionPin?: string }>(booking: T): T {
  if (booking.completionPin === undefined) return booking;
  return { ...booking, completionPin: booking.completionPin ? "••••" : "" };
}
