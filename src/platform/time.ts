import type { Clock } from "./clock";

/**
 * The time convention (ST-003, story review TT-B / D4) – every time-based rule uses these helpers:
 * - calendar logic ("today", dates, months) in Europe/Berlin;
 * - waiting times are elapsed hours ("longer than 3 days" = more than 72 h, "older than 14 days" = more than 336 h);
 * - month arithmetic clamps to the month end (31 January + 1 month = 28/29 February);
 * - a maintenance task is overdue once its due date plus 25 % of the interval's actual days (rounded up) is reached.
 */

/** A calendar date in Europe/Berlin, `YYYY-MM-DD`. */
export type CalendarDate = string;

const berlinDate = new Intl.DateTimeFormat("en", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function calendarDate(instant: Date): CalendarDate {
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    berlinDate.formatToParts(instant).find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const berlinDateTime = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** A point in time as the team and visitors see it: Berlin time, e.g. "15.01.2026, 10:05". */
export function formatDateTime(instant: Date): string {
  return berlinDateTime.format(instant);
}

export function today(clock: Clock): CalendarDate {
  return calendarDate(clock.now());
}

export function elapsedMoreThanHours(since: Date, now: Date, hours: number): boolean {
  return now.getTime() - since.getTime() > hours * 3_600_000;
}

/** Whole hours from `since` to `now` – how long something has been waiting (the triage list, ST-017). */
export function elapsedHours(since: Date, now: Date): number {
  return Math.floor((now.getTime() - since.getTime()) / 3_600_000);
}

const DAY_MS = 86_400_000;

// Calendar arithmetic on UTC midnights – no time zone or summer time involved.
function parse(date: CalendarDate): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Not a calendar date: ${date}`);
  return new Date(`${date}T00:00:00Z`);
}

function format(date: Date): CalendarDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return format(new Date(parse(date).getTime() + days * DAY_MS));
}

export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / DAY_MS);
}

export function addMonths(date: CalendarDate, months: number): CalendarDate {
  const d = parse(date);
  const monthIndex = d.getUTCFullYear() * 12 + d.getUTCMonth() + months;
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex - year * 12;
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return format(new Date(Date.UTC(year, month, Math.min(d.getUTCDate(), lastDayOfMonth))));
}

/** 25 % of the actual days of an interval starting on `start`, rounded up – the time from due to overdue. */
export function graceDays(start: CalendarDate, intervalMonths: number): number {
  return Math.ceil(daysBetween(start, addMonths(start, intervalMonths)) / 4);
}

/** Due date and first overdue day of a maintenance task last done on `lastDone` with an interval of whole months. */
export function maintenanceDates(
  lastDone: CalendarDate,
  intervalMonths: number,
): { dueDate: CalendarDate; overdueFrom: CalendarDate } {
  const dueDate = addMonths(lastDone, intervalMonths);
  return { dueDate, overdueFrom: addDays(dueDate, graceDays(lastDone, intervalMonths)) };
}
