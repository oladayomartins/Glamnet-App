import { describe, expect, it } from "vitest";
import { countsAsClientBooking, matchesClient, summariseClients, type ClientBooking } from "../clients";

const now = new Date("2026-10-10T12:00:00Z");
let n = 0;
function booking(over: Partial<ClientBooking>): ClientBooking {
  n += 1;
  return {
    id: `b${n}`,
    customerId: "c1",
    customerName: "Jade Whitfield",
    status: "PAYMENT_RELEASED",
    paymentStatus: "ESCROW_RELEASED",
    appointmentStartAt: new Date("2026-09-01T10:00:00Z"),
    providerPayoutMinor: 4_000,
    rating: null,
    ...over,
  };
}

describe("countsAsClientBooking", () => {
  it("ignores expired requests and abandoned checkouts", () => {
    expect(countsAsClientBooking({ status: "EXPIRED", paymentStatus: "VOIDED" })).toBe(false);
    expect(countsAsClientBooking({ status: "ACCEPTED", paymentStatus: "PENDING_AUTHORISATION" })).toBe(false);
  });

  it("counts paid, cancelled and missed bookings", () => {
    expect(countsAsClientBooking({ status: "CONFIRMED", paymentStatus: "AUTHORISED" })).toBe(true);
    expect(countsAsClientBooking({ status: "CANCELLED", paymentStatus: "VOIDED" })).toBe(true);
    expect(countsAsClientBooking({ status: "NO_SHOW", paymentStatus: "ESCROW_RELEASED" })).toBe(true);
  });
});

describe("summariseClients", () => {
  it("adds up visits, earnings, ratings, cancellations and no-shows per client", () => {
    const [jade] = summariseClients(
      [
        booking({ rating: 5, appointmentStartAt: new Date("2026-08-01T10:00:00Z") }),
        booking({ rating: 4, providerPayoutMinor: 6_000, appointmentStartAt: new Date("2026-09-20T10:00:00Z") }),
        booking({ status: "CANCELLED", paymentStatus: "VOIDED", providerPayoutMinor: 9_999 }),
        booking({ status: "NO_SHOW" }),
        booking({ status: "EXPIRED", paymentStatus: "VOIDED" }),
      ],
      now,
    );
    expect(jade).toMatchObject({
      visits: 2,
      earnedMinor: 10_000,
      averageRating: 4.5,
      cancellations: 1,
      noShows: 1,
      lastVisitAt: new Date("2026-09-20T10:00:00Z"),
      nextBookingAt: null,
    });
  });

  it("puts clients with a booking coming up first, soonest first", () => {
    const clients = summariseClients(
      [
        booking({ customerId: "old", customerName: "Old Regular", appointmentStartAt: new Date("2026-10-09T10:00:00Z") }),
        booking({ customerId: "later", customerName: "Later", status: "CONFIRMED", paymentStatus: "AUTHORISED", appointmentStartAt: new Date("2026-10-20T10:00:00Z") }),
        booking({ customerId: "soon", customerName: "Soon", status: "CONFIRMED", paymentStatus: "CARD_SAVED", appointmentStartAt: new Date("2026-10-11T10:00:00Z") }),
        booking({ customerId: "gone", customerName: "Gone", status: "EXPIRED", paymentStatus: "VOIDED" }),
      ],
      now,
    );
    expect(clients.map((client) => client.customerId)).toEqual(["soon", "later", "old"]);
    expect(clients[0].nextBookingId).toBeTruthy();
  });
});

describe("matchesClient", () => {
  it("matches any part of the name, ignoring case and accents", () => {
    expect(matchesClient("Zoë Adébáyọ̀", "zoe")).toBe(true);
    expect(matchesClient("Jade Whitfield", "WHIT")).toBe(true);
    expect(matchesClient("Jade Whitfield", "rosie")).toBe(false);
    expect(matchesClient("Jade Whitfield", "  ")).toBe(true);
  });
});
