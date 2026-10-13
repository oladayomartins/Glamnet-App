import { describe, expect, it } from "vitest";
import {
  defaultWorkingWeek,
  weekFromWindows,
  weekProblem,
  weekToWindows,
} from "@/lib/domain/working-week";

describe("defaultWorkingWeek", () => {
  it("runs Monday first, the way a vendor reads their own week", () => {
    expect(defaultWorkingWeek().map((d) => d.label)).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
  });

  it("arrives pre-ticked Monday to Saturday, 9 to 6", () => {
    // The point of the step is that an ordinary week is one tap. An empty
    // week would be the same dead end as having no step at all.
    const week = defaultWorkingWeek();
    expect(week.filter((d) => d.working).map((d) => d.label)).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ]);
    expect(week.every((d) => d.start === "09:00" && d.end === "18:00")).toBe(true);
  });

  it("leaves Sunday off rather than advertising hours nobody keeps", () => {
    expect(defaultWorkingWeek().find((d) => d.label === "Sunday")?.working).toBe(false);
  });
});

describe("weekFromWindows", () => {
  it("falls back to the default week when nothing is saved", () => {
    expect(weekFromWindows([])).toEqual(defaultWorkingWeek());
  });

  it("reflects exactly the days that are saved", () => {
    const week = weekFromWindows([
      { dayOfWeek: 2, startMinute: 600, endMinute: 1_200 },
    ]);
    expect(week.filter((d) => d.working).map((d) => d.label)).toEqual(["Tuesday"]);
    const tuesday = week.find((d) => d.label === "Tuesday")!;
    expect(tuesday.start).toBe("10:00");
    expect(tuesday.end).toBe("20:00");
  });

  it("shows the widest span for a day saved as two shifts", () => {
    // Half a day silently disappearing is worse than showing the break as
    // worked — the editor says the same thing.
    const week = weekFromWindows([
      { dayOfWeek: 6, startMinute: 480, endMinute: 720 },
      { dayOfWeek: 6, startMinute: 840, endMinute: 1_200 },
    ]);
    const saturday = week.find((d) => d.label === "Saturday")!;
    expect(saturday.start).toBe("08:00");
    expect(saturday.end).toBe("20:00");
  });
});

describe("weekToWindows", () => {
  it("sends only the days actually worked", () => {
    expect(weekToWindows(defaultWorkingWeek())).toHaveLength(6);
    expect(weekToWindows(defaultWorkingWeek()).map((w) => w.dayOfWeek)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  it("converts clock strings to the minutes the engine stores", () => {
    const [monday] = weekToWindows(defaultWorkingWeek());
    expect(monday).toEqual({ dayOfWeek: 1, startMinute: 540, endMinute: 1_080 });
  });

  it("sends nothing when no day is worked", () => {
    const none = defaultWorkingWeek().map((d) => ({ ...d, working: false }));
    expect(weekToWindows(none)).toEqual([]);
  });
});

describe("weekProblem", () => {
  it("passes an ordinary week", () => {
    expect(weekProblem(defaultWorkingWeek())).toBeNull();
  });

  it("refuses a week with no days — the bug this step exists to prevent", () => {
    const none = defaultWorkingWeek().map((d) => ({ ...d, working: false }));
    expect(weekProblem(none)).toMatch(/at least one day/i);
  });

  it("names the day that finishes before it starts", () => {
    const week = defaultWorkingWeek().map((d) =>
      d.label === "Thursday" ? { ...d, start: "18:00", end: "09:00" } : d,
    );
    expect(weekProblem(week)).toBe("Thursday finishes before it starts.");
  });

  it("rejects a zero-length day", () => {
    const week = defaultWorkingWeek().map((d) =>
      d.label === "Monday" ? { ...d, start: "09:00", end: "09:00" } : d,
    );
    expect(weekProblem(week)).toMatch(/Monday/);
  });

  it("ignores a broken day that is not worked", () => {
    const week = defaultWorkingWeek().map((d) =>
      d.label === "Sunday" ? { ...d, start: "20:00", end: "06:00" } : d,
    );
    expect(weekProblem(week)).toBeNull();
  });
});
