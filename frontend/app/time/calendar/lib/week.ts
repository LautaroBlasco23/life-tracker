import { addDays, addWeeks, startOfWeek } from 'date-fns';
import type { DayOfWeek } from '@shared/types/activity';

/** ISO week: the grid starts on Monday. */
export const WEEK_STARTS_ON = 1 as const;
export const DAYS_IN_WEEK = 7;
export const HOURS_IN_DAY = 24;
export const MINUTES_PER_DAY = HOURS_IN_DAY * 60;
/** Pixels per hour in the week grid. */
export const HOUR_HEIGHT = 56;
/** Clicking an empty slot snaps to this granularity. */
export const SNAP_MINUTES = 30;

export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
}

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: DAYS_IN_WEEK }, (_, index) =>
    addDays(weekStart, index)
  );
}

export function shiftWeek(weekStart: Date, weeks: number): Date {
  return addWeeks(weekStart, weeks);
}

/**
 * The half-open [from, to) range sent to the API. ISO strings carry the
 * user's offset, so the backend stores/compares real instants.
 */
export function getWeekRange(weekStart: Date): { from: string; to: string } {
  return {
    from: weekStart.toISOString(),
    to: addDays(weekStart, DAYS_IN_WEEK).toISOString(),
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

export function formatWeekLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, DAYS_IN_WEEK - 1);
  const startMonth = weekStart.toLocaleDateString(undefined, {
    month: 'short',
  });
  const endMonth = weekEnd.toLocaleDateString(undefined, { month: 'short' });
  const year = weekEnd.getFullYear();

  if (weekStart.getMonth() === weekEnd.getMonth()) {
    return `${startMonth} ${weekStart.getDate()} – ${weekEnd.getDate()}, ${year}`;
  }

  return `${startMonth} ${weekStart.getDate()} – ${endMonth} ${weekEnd.getDate()}, ${year}`;
}

export function formatDayLabel(date: Date): {
  weekday: string;
  dayNumber: string;
} {
  return {
    weekday: date.toLocaleDateString(undefined, { weekday: 'short' }),
    dayNumber: String(date.getDate()),
  };
}

export function formatHourLabel(hour: number): string {
  return `${String(hour % 24).padStart(2, '0')}:00`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimeRange(startAt: string, endAt: string): string {
  return `${formatTime(new Date(startAt))} – ${formatTime(new Date(endAt))}`;
}

/** `yyyy-MM-dd` in local time, the value shape of <input type="date">. */
export function toDateInputValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** `HH:mm` in local time, the value shape of <input type="time">. */
export function toTimeInputValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Builds a local Date from the two form inputs. Construction is local-time on
 * purpose: the user is editing their own wall clock, and `toISOString()`
 * converts to the instant the API needs.
 */
export function combineDateAndTime(dateValue: string, timeValue: string): Date {
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hours, minutes] = timeValue.split(':').map(Number);

  if ([year, month, day, hours, minutes].some((part) => Number.isNaN(part))) {
    return new Date(Number.NaN);
  }

  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

/**
 * Adds days to a `yyyy-MM-dd` date input value, keeping the same format.
 * Month and year overflow is handled by the Date constructor.
 */
export function addDaysToDateValue(dateValue: string, days: number): string {
  const date = combineDateAndTime(dateValue, '00:00');
  if (Number.isNaN(date.getTime())) return '';
  return toDateInputValue(
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
  );
}

/**
 * End of the local day of a `yyyy-MM-dd` date input value, as an ISO instant.
 * A recurring event repeats on that day, so the bound is the last instant of
 * the day the user picked.
 */
export function toEndOfDayInstant(dateValue: string): string {
  const parts = dateValue.split('-').map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return '';
  const [year, month, day] = parts;
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

export function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function dateAtMinutes(day: Date, minutes: number): Date {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    0,
    minutes,
    0,
    0
  );
}

/** Rounds a minute-of-day down to the nearest SNAP_MINUTES slot. */
export function snapMinutes(minutes: number): number {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY, minutes));
  return Math.floor(clamped / SNAP_MINUTES) * SNAP_MINUTES;
}

/**
 * `HH:mm` for an arbitrary minute-of-day. Values at or past midnight are
 * clamped to 23:59 because <input type="time"> cannot express 24:00.
 */
export function timeInputValueAt(day: Date, minutes: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY - 1, minutes));
  return toTimeInputValue(dateAtMinutes(day, clamped));
}

/** Maps a click offset inside a day column to a snapped minute-of-day. */
export function minutesFromOffset(
  offsetY: number,
  columnHeight: number
): number {
  if (columnHeight <= 0) return 0;
  return snapMinutes(Math.floor((offsetY / columnHeight) * MINUTES_PER_DAY));
}

/** Week day names indexed by `Date.getDay()` (Sunday=0). */
const WEEKDAY_NAMES: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/** The `DayOfWeek` name of a date, used to seed the weekday checkboxes. */
export function weekdayName(date: Date): DayOfWeek {
  return WEEKDAY_NAMES[date.getDay()];
}

/**
 * The times of an event dropped with a drag inside the week grid. The target
 * day comes from the column, the start time from the drop offset, and the
 * original duration is preserved.
 */
export function dropEventTimes(input: {
  /** `yyyy-MM-dd` of the column the event was dropped on. */
  dayValue: string;
  /** Vertical offset, in pixels, inside that column. */
  offsetY: number;
  columnHeight: number;
  /** Preserved `endAt - startAt` of the pre-drag event. */
  durationMs: number;
}): { startAt: string; endAt: string } | null {
  // The bottom edge clamps to 23:59 <input type="time"> semantics; longer
  // events simply spill into the next day, as overnight events already do.
  const startMinutes = Math.min(
    minutesFromOffset(input.offsetY, input.columnHeight),
    MINUTES_PER_DAY - 1
  );
  const start = combineDateAndTime(
    input.dayValue,
    toTimeInputValue(dateAtMinutes(new Date(), startMinutes))
  );
  if (Number.isNaN(start.getTime())) return null;

  return {
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + input.durationMs).toISOString(),
  };
}
