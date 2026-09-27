import { describe, expect, it } from "vitest";
import { fixedClock } from "./clock";
import {
  addMonths,
  calendarDate,
  elapsedMoreThanHours,
  formatDateTime,
  graceDays,
  maintenanceDates,
  today,
} from "./time";

describe("time convention", () => {
  describe("calendar dates are in Europe/Berlin", () => {
    it.each([
      ["winter time, last second of the day", "2026-01-15T22:59:59Z", "2026-01-15"],
      ["winter time, midnight", "2026-01-15T23:00:00Z", "2026-01-16"],
      ["day before summer time starts, midnight", "2026-03-28T23:00:00Z", "2026-03-29"],
      ["day summer time starts, last second (23 h day)", "2026-03-29T21:59:59Z", "2026-03-29"],
      ["day after summer time starts, midnight", "2026-03-29T22:00:00Z", "2026-03-30"],
      ["day summer time ends, midnight", "2026-10-24T22:00:00Z", "2026-10-25"],
      ["day summer time ends, last second (25 h day)", "2026-10-25T22:59:59Z", "2026-10-25"],
      ["day after summer time ends, midnight", "2026-10-25T23:00:00Z", "2026-10-26"],
    ])("%s: %s is %s", (_, instant, date) => {
      expect(calendarDate(new Date(instant))).toBe(date);
    });

    it("today is the Berlin date of the injected clock", () => {
      expect(today(fixedClock("2026-06-30T22:30:00Z"))).toBe("2026-07-01");
    });
  });

  describe("waiting times are elapsed hours", () => {
    it.each([
      ["exactly 72 h is not longer than 3 days", "2026-03-27T12:00:00Z", "2026-03-30T12:00:00Z", 72, false],
      [
        "72 h and 1 ms is longer than 3 days (across the summer-time change)",
        "2026-03-27T12:00:00Z",
        "2026-03-30T12:00:00.001Z",
        72,
        true,
      ],
      ["71 h 59 min is not longer than 3 days", "2026-09-01T08:00:00Z", "2026-09-04T07:59:00Z", 72, false],
      ["exactly 336 h is not older than 14 days", "2026-10-20T10:00:00Z", "2026-11-03T10:00:00Z", 336, false],
      [
        "336 h and 1 s is older than 14 days (across the winter-time change)",
        "2026-10-20T10:00:00Z",
        "2026-11-03T10:00:01Z",
        336,
        true,
      ],
    ])("%s", (_, since, now, hours, expected) => {
      expect(elapsedMoreThanHours(new Date(since), new Date(now), hours)).toBe(expected);
    });
  });

  describe("month arithmetic clamps to the month end", () => {
    it.each([
      ["2026-01-31", 1, "2026-02-28"],
      ["2028-01-31", 1, "2028-02-29"],
      ["2026-03-31", 1, "2026-04-30"],
      ["2026-01-15", 1, "2026-02-15"],
      ["2026-01-01", 3, "2026-04-01"],
      ["2026-11-30", 3, "2027-02-28"],
      ["2025-01-01", 12, "2026-01-01"],
      ["2028-02-29", 12, "2029-02-28"],
    ])("%s + %i month(s) = %s", (date, months, expected) => {
      expect(addMonths(date, months)).toBe(expected);
    });
  });

  describe("overdue after 25 % of the interval's actual days, rounded up", () => {
    it.each([
      // last done, months, due date, overdue from (due date + grace days)
      ["2026-02-01", 1, "2026-03-01", "2026-03-08"], // 28 days → 7
      ["2026-03-01", 1, "2026-04-01", "2026-04-09"], // 31 days → 8 (7.75 rounded up)
      ["2026-01-01", 3, "2026-04-01", "2026-04-24"], // 90 days → 23 (22.5 rounded up)
      ["2026-04-01", 3, "2026-07-01", "2026-07-24"], // 91 days → 23 (22.75 rounded up)
      ["2025-01-01", 12, "2026-01-01", "2026-04-03"], // 365 days → 92 (ST-043)
      ["2027-06-01", 12, "2028-06-01", "2028-09-01"], // 366 days (leap year) → 92 (91.5 rounded up)
    ])("last done %s, every %i month(s): due %s, overdue from %s", (lastDone, months, due, overdueFrom) => {
      expect(maintenanceDates(lastDone, months)).toEqual({ dueDate: due, overdueFrom });
    });
  });

  describe("grace period of an interval, counted from any start (e.g. the return to display, ST-056)", () => {
    it.each([
      ["2026-02-01", 1, 7],
      ["2026-05-10", 1, 8], // 31 days
      ["2026-01-01", 3, 23],
      ["2025-01-01", 12, 92],
    ])("from %s, %i month(s): %i days", (start, months, days) => {
      expect(graceDays(start, months)).toBe(days);
    });
  });

  describe("times are shown in Europe/Berlin", () => {
    it.each([
      ["2026-01-15T09:05:00Z", "15.01.2026, 10:05"],
      ["2026-07-15T09:05:00Z", "15.07.2026, 11:05"],
      ["2026-10-25T00:30:00Z", "25.10.2026, 02:30"],
      ["2026-10-25T01:30:00Z", "25.10.2026, 02:30"],
    ])("%s is shown as %s", (instant, shown) => {
      expect(formatDateTime(new Date(instant))).toBe(shown);
    });
  });
});
