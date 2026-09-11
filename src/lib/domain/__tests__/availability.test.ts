import { describe, expect, it } from "vitest";
import {
  buildDayGrid,
  buildSlotOptions,
  isProviderAvailable,
  overlaps,
  reservationWindow,
  type ProviderSchedule,
  type WorkingWindow,
} from "../availability";
import { selectBroadcastTargets, type MatchCandidate } from "../matching";

/** Local-time helper: tests assert on wall-clock behaviour, as the UI does. */
const local = (iso: string) => new Date(iso);

const ALL_WEEK: WorkingWindow[] = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  startMinute: 9 * 60,
  endMinute: 20 * 60,
}));

const schedule = (over: Partial<ProviderSchedule> = {}): ProviderSchedule => ({
  providerId: "p1",
  workingWindows: ALL_WEEK,
  reservations: [],
  blocks: [],
  ...over,
});

describe("reservationWindow (spec §2)", () => {
  it("appends the 15-minute transition period", () => {
    // The spec's example: 12:00-14:00 services -> calendar booking 12:00-14:15.
    const window = reservationWindow(local("2026-04-01T12:00:00"), 120);
    expect(window.startAt.toISOString()).toBe(local("2026-04-01T12:00:00").toISOString());
    expect(window.endAt.toISOString()).toBe(local("2026-04-01T14:15:00").toISOString());
  });
});

describe("overlaps", () => {
  it("detects a partial overlap", () => {
    expect(
      overlaps(
        { startAt: local("2026-04-01T14:00:00"), endAt: local("2026-04-01T16:15:00") },
        { startAt: local("2026-04-01T15:30:00"), endAt: local("2026-04-01T17:15:00") },
      ),
    ).toBe(true);
  });

  it("allows back-to-back intervals (half-open)", () => {
    expect(
      overlaps(
        { startAt: local("2026-04-01T12:00:00"), endAt: local("2026-04-01T14:15:00") },
        { startAt: local("2026-04-01T14:15:00"), endAt: local("2026-04-01T15:00:00") },
      ),
    ).toBe(false);
  });
});

describe("isProviderAvailable", () => {
  it("accepts a free slot inside working hours", () => {
    expect(
      isProviderAvailable(schedule(), local("2026-04-01T12:00:00"), 120),
    ).toBe(true);
  });

  it("rejects the spec §7 emergency conflict example", () => {
    // Existing booking 14:00-16:15; customer requests an emergency 15:30 start.
    const withBooking = schedule({
      reservations: [
        { startAt: local("2026-04-01T14:00:00"), endAt: local("2026-04-01T16:15:00") },
      ],
    });
    expect(
      isProviderAvailable(withBooking, local("2026-04-01T15:30:00"), 90),
    ).toBe(false);
  });

  it("rejects a slot whose 15-minute buffer collides with the next booking", () => {
    // 12:00 + 120min service ends 14:00, but the buffer runs to 14:15, which
    // overlaps a booking starting at 14:10.
    const withBooking = schedule({
      reservations: [
        { startAt: local("2026-04-01T14:10:00"), endAt: local("2026-04-01T15:00:00") },
      ],
    });
    expect(
      isProviderAvailable(withBooking, local("2026-04-01T12:00:00"), 120),
    ).toBe(false);
  });

  it("accepts a slot that ends exactly when the next booking starts", () => {
    const withBooking = schedule({
      reservations: [
        { startAt: local("2026-04-01T14:15:00"), endAt: local("2026-04-01T15:00:00") },
      ],
    });
    expect(
      isProviderAvailable(withBooking, local("2026-04-01T12:00:00"), 120),
    ).toBe(true);
  });

  it("rejects a slot whose buffer runs past the end of the working day", () => {
    // Shift ends 20:00. An 18:00 start with 120min service needs until 20:15.
    expect(
      isProviderAvailable(schedule(), local("2026-04-01T18:00:00"), 120),
    ).toBe(false);
  });

  it("rejects a slot inside a manual block", () => {
    const blocked = schedule({
      blocks: [
        { startAt: local("2026-04-01T11:00:00"), endAt: local("2026-04-01T13:00:00") },
      ],
    });
    expect(
      isProviderAvailable(blocked, local("2026-04-01T12:00:00"), 60),
    ).toBe(false);
  });

  it("rejects a day the vendor does not work", () => {
    const weekdaysOnly = schedule({
      workingWindows: [{ dayOfWeek: 1, startMinute: 540, endMinute: 1_080 }],
    });
    // 2026-04-01 is a Wednesday.
    expect(
      isProviderAvailable(weekdaysOnly, local("2026-04-01T12:00:00"), 60),
    ).toBe(false);
  });
});

describe("buildSlotOptions", () => {
  it("offers only slots at least one vendor can serve", () => {
    const slots = buildSlotOptions(
      local("2026-04-01T00:00:00"),
      120,
      [schedule()],
      local("2026-04-01T00:00:00"),
    );

    expect(slots.length).toBeGreaterThan(0);
    // First legal start is 09:00; last is 17:45 (ends 19:45 + 15min = 20:00).
    expect(slots[0].startAt.getHours()).toBe(9);
    const last = slots[slots.length - 1];
    expect(last.startAt.getHours()).toBe(17);
    expect(last.startAt.getMinutes()).toBe(45);
  });

  it("never offers a slot in the past", () => {
    const slots = buildSlotOptions(
      local("2026-04-01T00:00:00"),
      60,
      [schedule()],
      local("2026-04-01T14:00:00"),
    );
    expect(slots.every((slot) => slot.startAt.getTime() >= local("2026-04-01T14:00:00").getTime()))
      .toBe(true);
  });

  it("drops slots blocked by an existing reservation", () => {
    const busy = schedule({
      reservations: [
        { startAt: local("2026-04-01T09:00:00"), endAt: local("2026-04-01T20:00:00") },
      ],
    });
    expect(
      buildSlotOptions(local("2026-04-01T00:00:00"), 60, [busy], local("2026-04-01T00:00:00")),
    ).toHaveLength(0);
  });
});

describe("buildDayGrid", () => {
  it("keeps start times nobody is free for, so the picker can show them", () => {
    const busy = schedule({
      reservations: [
        { startAt: local("2026-04-01T09:00:00"), endAt: local("2026-04-01T20:00:00") },
      ],
    });

    const grid = buildDayGrid(
      local("2026-04-01T00:00:00"),
      60,
      [busy],
      local("2026-04-01T00:00:00"),
    );

    // The working day is still described, even though none of it is bookable:
    // an absent 16:00 would read as "they do not work then".
    expect(grid.length).toBeGreaterThan(0);
    expect(grid.every((slot) => slot.availableProviderIds.length === 0)).toBe(true);
  });

  it("omits times outside every vendor's working hours", () => {
    const grid = buildDayGrid(
      local("2026-04-01T00:00:00"),
      60,
      [schedule()],
      local("2026-04-01T00:00:00"),
    );

    expect(grid.every((slot) => slot.startAt.getHours() >= 9)).toBe(true);
  });

  it("is the superset buildSlotOptions filters", () => {
    const partlyBusy = schedule({
      reservations: [
        { startAt: local("2026-04-01T09:00:00"), endAt: local("2026-04-01T12:00:00") },
      ],
    });
    const args = [
      local("2026-04-01T00:00:00"),
      60,
      [partlyBusy],
      local("2026-04-01T00:00:00"),
    ] as const;

    const grid = buildDayGrid(...args);
    const offered = buildSlotOptions(...args);

    expect(offered).toEqual(
      grid.filter((slot) => slot.availableProviderIds.length > 0),
    );
    expect(offered.length).toBeLessThan(grid.length);
  });
});

describe("selectBroadcastTargets (spec §7, §13)", () => {
  const candidate = (
    id: string,
    over: Partial<MatchCandidate> = {},
  ): MatchCandidate => ({
    providerId: id,
    sectors: ["S11"],
    serviceIds: ["updo", "glam"],
    rating: 4.5,
    completedBookings: 10,
    schedule: schedule({ providerId: id }),
    ...over,
  });

  const request = {
    sector: "S11",
    requiredServiceIds: ["updo"],
    appointmentStartAt: local("2026-04-01T12:00:00"),
    serviceDurationMinutes: 120,
  };

  it("returns at most five vendors, best rated first", () => {
    const candidates = Array.from({ length: 8 }, (_, index) =>
      candidate(`p${index}`, { rating: index / 2 }),
    );
    const targets = selectBroadcastTargets(candidates, request);

    expect(targets).toHaveLength(5);
    expect(targets[0].providerId).toBe("p7");
    expect(targets.map((target) => target.rating)).toEqual([3.5, 3, 2.5, 2, 1.5]);
  });

  it("excludes vendors outside the sector", () => {
    const targets = selectBroadcastTargets(
      [candidate("p1", { sectors: ["S20"] }), candidate("p2")],
      request,
    );
    expect(targets.map((target) => target.providerId)).toEqual(["p2"]);
  });

  it("excludes vendors who cannot deliver every requested service", () => {
    const targets = selectBroadcastTargets(
      [candidate("p1", { serviceIds: ["glam"] }), candidate("p2")],
      request,
    );
    expect(targets.map((target) => target.providerId)).toEqual(["p2"]);
  });

  it("excludes vendors whose calendar conflicts, even for an emergency", () => {
    const conflicted = candidate("p1", {
      schedule: schedule({
        providerId: "p1",
        reservations: [
          { startAt: local("2026-04-01T13:00:00"), endAt: local("2026-04-01T15:00:00") },
        ],
      }),
    });
    const targets = selectBroadcastTargets([conflicted, candidate("p2")], request);
    expect(targets.map((target) => target.providerId)).toEqual(["p2"]);
  });

  it("breaks a rating tie on completed bookings", () => {
    const targets = selectBroadcastTargets(
      [
        candidate("p1", { rating: 4.8, completedBookings: 5 }),
        candidate("p2", { rating: 4.8, completedBookings: 50 }),
      ],
      request,
    );
    expect(targets.map((target) => target.providerId)).toEqual(["p2", "p1"]);
  });
});
