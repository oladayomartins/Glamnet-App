import { describe, expect, it } from "vitest";
import { summariseDays, type ProviderSchedule } from "@/lib/domain/availability";

// Saturday 26 September 2026, 08:00 local.
const now = new Date(2026, 8, 26, 8, 0);

const schedule = (overrides: Partial<ProviderSchedule> = {}): ProviderSchedule => ({
  providerId: "p1",
  // Monday to Saturday, 09:00–18:00; closed on Sunday.
  workingWindows: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    startMinute: 9 * 60,
    endMinute: 18 * 60,
  })),
  reservations: [],
  blocks: [],
  ...overrides,
});

describe("summariseDays", () => {
  it("marks a working day free, with its first start", () => {
    const [saturday] = summariseDays(now, 1, 60, schedule(), now);
    expect(saturday.status).toBe("free");
    expect(saturday.firstStartAt?.getHours()).toBe(9);
    expect(saturday.date.getDate()).toBe(26);
  });

  it("marks a non-working day closed", () => {
    const days = summariseDays(now, 2, 60, schedule(), now);
    expect(days[1].date.getDay()).toBe(0);
    expect(days[1].status).toBe("closed");
    expect(days[1].firstStartAt).toBeNull();
  });

  it("marks a working day with nothing left full", () => {
    const booked = schedule({
      reservations: [{ startAt: new Date(2026, 8, 26, 9, 0), endAt: new Date(2026, 8, 26, 18, 0) }],
    });
    const [saturday] = summariseDays(now, 1, 60, booked, now);
    expect(saturday.status).toBe("full");
  });

  it("counts a working day whose hours have passed as full, not closed", () => {
    const evening = new Date(2026, 8, 26, 19, 0);
    const [saturday] = summariseDays(evening, 1, 60, schedule(), evening);
    expect(saturday.status).toBe("full");
  });

  it("finds a basket too long for the day as full", () => {
    const [saturday] = summariseDays(now, 1, 10 * 60, schedule(), now);
    expect(saturday.status).toBe("full");
  });
});
