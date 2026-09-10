import { describe, expect, it } from "vitest";
import { canTransition } from "@/lib/server/lifecycle";
import { BOOKING_STATUSES, NEXT_STATUS } from "../types";

describe("canTransition (spec §8)", () => {
  it("allows each documented forward step", () => {
    for (const status of BOOKING_STATUSES) {
      const next = NEXT_STATUS[status];
      if (next) expect(canTransition(status, next)).toBe(true);
    }
  });

  it("refuses to skip a step", () => {
    expect(canTransition("REQUESTED", "CONFIRMED")).toBe(false);
    expect(canTransition("ACCEPTED", "IN_PROGRESS")).toBe(false);
  });

  it("refuses to move backwards", () => {
    expect(canTransition("COMPLETED", "IN_PROGRESS")).toBe(false);
    expect(canTransition("CONFIRMED", "ACCEPTED")).toBe(false);
  });

  it("has no transition out of the final status", () => {
    expect(NEXT_STATUS.PAYMENT_RELEASED).toBeNull();
    expect(canTransition("PAYMENT_RELEASED", "REVIEWED")).toBe(false);
  });

  it("allows cancellation before the provider is en route or later", () => {
    expect(canTransition("BROADCAST", "CANCELLED")).toBe(true);
    expect(canTransition("PROVIDER_EN_ROUTE", "CANCELLED")).toBe(true);
    expect(canTransition("ARRIVED", "CANCELLED")).toBe(false);
    expect(canTransition("COMPLETED", "CANCELLED")).toBe(false);
  });

  it("allows a dispute only after the work is done", () => {
    expect(canTransition("COMPLETED", "DISPUTED")).toBe(true);
    expect(canTransition("PAYMENT_RELEASED", "DISPUTED")).toBe(true);
    expect(canTransition("BROADCAST", "DISPUTED")).toBe(false);
  });

  it("does not resurrect a cancelled booking", () => {
    expect(canTransition("CANCELLED", "ACCEPTED")).toBe(false);
    expect(canTransition("CANCELLED", "CANCELLED")).toBe(false);
  });
});
