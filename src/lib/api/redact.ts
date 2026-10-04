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

type VendorVisible = {
  completionPin?: string;
  addressLine?: string | null;
  addressUnlocked?: boolean;
  customer?: { name: string } | null;
  broadcasts?: { providerId: string }[];
};

/**
 * A booking as the vendor on it may see it.
 *
 * Beyond the PIN: the client's street address stays hidden until the
 * ADDRESS_UNLOCKED step (spec §8), the client is reduced to their name (no
 * email, phone, home postcode or payment ids), and on a broadcast the vendor
 * sees only their own offer, not which competitors were asked.
 */
export function forVendor<T extends VendorVisible>(booking: T, providerId: string | null): T {
  const redacted = withoutPin(booking);
  return {
    ...redacted,
    ...("addressLine" in booking && !booking.addressUnlocked ? { addressLine: "" } : {}),
    ...(booking.customer ? { customer: { name: booking.customer.name } } : {}),
    ...(booking.broadcasts
      ? { broadcasts: booking.broadcasts.filter((offer) => offer.providerId === providerId) }
      : {}),
  };
}
