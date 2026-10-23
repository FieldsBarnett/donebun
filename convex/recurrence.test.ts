import { describe, expect, it } from "vitest";
import { calculateNextDueDate, toLocalISOString } from "./recurrence";

describe("calculateNextDueDate", () => {
  it("advances weekly fixed tasks by one week", () => {
    const next = calculateNextDueDate(
      "2026-10-23",
      { strategy: "fixed", frequency: "weekly", interval: 1 },
      "2026-10-23T12:00:00",
    );
    expect(next).toBe("2026-10-30");
  });

  it("preserves time on timed weekly occurrences", () => {
    const next = calculateNextDueDate(
      "2026-10-23T09:00:00",
      { strategy: "fixed", frequency: "weekly", interval: 1 },
      "2026-10-23T12:00:00",
    );
    expect(next).toBe("2026-10-30T09:00:00");
  });
});

describe("toLocalISOString", () => {
  it("formats local calendar dates without UTC shift", () => {
    const d = new Date(2026, 9, 23, 15, 30, 0);
    expect(toLocalISOString(d, false)).toBe("2026-10-23");
    expect(toLocalISOString(d, true)).toBe("2026-10-23T15:30:00");
  });
});
