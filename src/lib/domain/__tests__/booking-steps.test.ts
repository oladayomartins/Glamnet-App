import { describe, expect, it } from "vitest";
import { resolveStep } from "@/lib/domain/booking-steps";

const at = (requestedStep: number, serviceCount: number, hasSlot: boolean) =>
  resolveStep({ requestedStep, serviceCount, hasSlot });

describe("resolveStep", () => {
  it("opens on Services with nothing chosen", () => {
    const state = at(1, 0, false);
    expect(state.activeStep).toBe(1);
    expect(state.furthestStep).toBe(1);
    expect(state.blockedReason).toBe("Choose at least one service");
  });

  it("unlocks Time once there is a basket, and Confirm once there is a slot", () => {
    expect(at(1, 2, false).furthestStep).toBe(2);
    expect(at(1, 2, true).furthestStep).toBe(3);
  });

  it("clamps a stale step back when the basket is emptied underneath it", () => {
    // The case the clamp exists for: standing on Confirm, then removing every
    // service. The customer lands on step 1 in the same render.
    expect(at(3, 0, false).activeStep).toBe(1);
  });

  it("clamps back to Time when only the slot is cleared", () => {
    expect(at(3, 2, false).activeStep).toBe(2);
    expect(at(3, 2, false).blockedReason).toBe("Pick a time to continue");
  });

  it("never blocks Confirm — the button there submits", () => {
    expect(at(3, 2, true).blockedReason).toBeNull();
  });

  it("refuses to go below step 1 whatever it is handed", () => {
    expect(at(0, 2, true).activeStep).toBe(1);
    expect(at(-5, 2, true).activeStep).toBe(1);
    expect(at(Number.NaN, 2, true).activeStep).toBe(1);
  });

  it("does not let a step be skipped by asking for a later one", () => {
    // Asking for Confirm with no slot must not reveal the price screen.
    expect(at(3, 1, false).activeStep).toBe(2);
  });
});
