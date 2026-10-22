/**
 * Week helpers for the mobile calendar.
 *
 * Mobile port of web's `frontend/app/time/calendar/lib/week.ts` (the web
 * version leans on date-fns; the app has no date library, so the few
 * calculations are done by hand).
 */

import { formatTime, getDayKey } from '@shared/utils/format';

const DAYS_IN_WEEK = 7;
/** ISO week: the day strip starts on Monday. */
const WEEK_STARTS_ON = 1;
const MAX_EVENT_DURATION_MINUTES = 24 * 60;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Monday 00:00 of the week containing `date`. */
export function getWeekStart(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset =
    (start.getDay() - WEEK_STARTS_ON + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  start.setDate(start.getDate() - offset);
  return start;
}

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: DAYS_IN_WEEK }, (_, index) =>
    addDays(weekStart, index),
  );
}

export function shiftWeek(weekStart: Date, weeks: number): Date {
  return addDays(weekStart, weeks * DAYS_IN_WEEK);
}

/**
 * The half-open [from, to) range sent to the API. The backend rejects a
 * half-open range, so both bounds always travel together.
 */
export function getWeekRange(weekStart: Date): { from: string; to: string } {
  return {
    from: weekStart.toISOString(),
    to: addDays(weekStart, DAYS_IN_WEEK).toISOString(),
  };
}

/** Local-time [start, end) bounds of a calendar day. */
export function getDayRange(day: Date): { start: Date; end: Date } {
  return {
    start: new Date(day.getFullYear(), day.getMonth(), day.getDate()),
    end: new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1),
  };
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/** Short weekday name ("Mon") for the day strip. */
export function formatWeekday(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { weekday: 'short' });
}

/** Day heading ("Mon, Oct 21"). */
export function formatDayHeading(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

/** Week range label ("Sep 30 – Oct 6, 2026"). */
export function formatWeekLabel(weekStart: Date, locale: string): string {
  const weekEnd = addDays(weekStart, DAYS_IN_WEEK - 1);
  const startMonth = weekStart.toLocaleDateString(locale, { month: 'short' });
  const endMonth = weekEnd.toLocaleDateString(locale, { month: 'short' });
  const year = weekEnd.getFullYear();

  if (weekStart.getMonth() === weekEnd.getMonth()) {
    return `${startMonth} ${weekStart.getDate()} – ${weekEnd.getDate()}, ${year}`;
  }

  return `${startMonth} ${weekStart.getDate()} – ${endMonth} ${weekEnd.getDate()}, ${year}`;
}

/** Time range of an event ("3:45 PM – 4:45 PM"). */
export function formatTimeRange(startAt: string, endAt: string): string {
  return `${formatTime(new Date(startAt))} – ${formatTime(new Date(endAt))}`;
}

/** `yyyy-MM-dd` in local time. */
export function toDateInputValue(date: Date): string {
  return getDayKey(date);
}

/**
 * Adds days to a `yyyy-MM-dd` date input value, keeping the same format.
 * (Port of web's `frontend/app/time/calendar/lib/week.ts`.)
 */
export function addDaysToDateValue(dateValue: string, days: number): string {
  const parts = dateValue.split('-');
  if (parts.length !== 3 || parts.some((part) => part === '')) return '';
  const [year, month, day] = parts.map(Number);
  if ([year, month, day].some((part) => Number.isNaN(part))) return '';
  return toDateInputValue(new Date(year, month - 1, day + days));
}

/**
 * End of the local day of a `yyyy-MM-dd` value, as an ISO instant. A
 * recurring event repeats on that day, so the bound is the last instant of
 * the day the user picked.
 */
export function toEndOfDayInstant(dateValue: string): string {
  const parts = dateValue.split('-');
  if (parts.length !== 3 || parts.some((part) => part === '')) return '';
  const [year, month, day] = parts.map(Number);
  if ([year, month, day].some((part) => Number.isNaN(part))) return '';
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

/** True when the event ends on the calendar day after it starts. */
export function isNextDayEnd(startAt: string, endAt: string): boolean {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }
  return (
    toDateInputValue(end) === addDaysToDateValue(toDateInputValue(start), 1)
  );
}

/**
 * Builds a local Date from a date value and a time of day. Construction is
 * local-time on purpose: the user edits their own wall clock, and
 * `toISOString()` converts to the instant the API needs.
 */
export function combineDateAndTime(
  dateValue: string,
  hours: number,
  minutes: number,
): Date {
  const [year, month, day] = dateValue.split('-').map(Number);
  if ([year, month, day, hours, minutes].some((part) => Number.isNaN(part))) {
    return new Date(Number.NaN);
  }
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

/** True for a real `yyyy-MM-dd` calendar date (rejects 2026-02-31). */
export function isValidDateValue(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = combineDateAndTime(value, 0, 0);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === Number(value.slice(0, 4)) &&
    date.getMonth() === Number(value.slice(5, 7)) - 1 &&
    date.getDate() === Number(value.slice(8, 10))
  );
}

/** True for a 24-hour clock time (hours 0-23, minutes 0-59). */
export function isValidTimeOfDay(hours: number, minutes: number): boolean {
  return (
    Number.isInteger(hours) &&
    Number.isInteger(minutes) &&
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59
  );
}

/** Longest event the API accepts (24 hours). */
export function isWithinMaxDuration(start: Date, end: Date): boolean {
  return (
    end.getTime() - start.getTime() <= MAX_EVENT_DURATION_MINUTES * 60 * 1000
  );
}
