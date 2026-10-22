import { describe, expect, it } from '@jest/globals';
import {
  addDaysToDateValue,
  combineDateAndTime,
  getDayRange,
  getWeekDays,
  getWeekRange,
  getWeekStart,
  isSameDay,
  isToday,
  isValidDateValue,
  isValidTimeOfDay,
  isNextDayEnd,
  isWithinMaxDuration,
  shiftWeek,
  toDateInputValue,
  toEndOfDayInstant,
} from './calendar-week';

describe('getWeekStart', () => {
  it('snaps to Monday 00:00', () => {
    // 2026-10-21 is a Wednesday.
    const wednesday = new Date(2026, 9, 21, 13, 45);
    const start = getWeekStart(wednesday);

    expect(start.getDay()).toBe(1);
    expect(start.getDate()).toBe(19);
    expect(start.getMonth()).toBe(9);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
  });

  it('keeps Sunday in the week that starts on the previous Monday', () => {
    const sunday = new Date(2026, 9, 25, 8, 0);
    const start = getWeekStart(sunday);

    expect(start.getDay()).toBe(1);
    expect(start.getDate()).toBe(19);
  });
});

describe('getWeekDays', () => {
  it('returns seven consecutive days from the week start', () => {
    const days = getWeekDays(new Date(2026, 9, 19));

    expect(days).toHaveLength(7);
    expect(days[0].getDate()).toBe(19);
    expect(days[6].getDate()).toBe(25);
    // Monday first, Sunday last.
    expect(days.map((day) => day.getDay())).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });
});

describe('shiftWeek', () => {
  it('moves a full week in both directions', () => {
    const start = new Date(2026, 9, 19);

    expect(shiftWeek(start, 1).getDate()).toBe(26);
    expect(shiftWeek(start, -1).getDate()).toBe(12);
  });
});

describe('getWeekRange', () => {
  it('always sends both bounds, seven days apart', () => {
    const { from, to } = getWeekRange(new Date(2026, 9, 19));

    expect(from).toBeTruthy();
    expect(to).toBeTruthy();
    expect(new Date(to).getTime() - new Date(from).getTime()).toBe(
      7 * 24 * 60 * 60 * 1000,
    );
  });
});

describe('getDayRange', () => {
  it('spans local midnight to the next local midnight', () => {
    const { start, end } = getDayRange(new Date(2026, 9, 21, 15, 30));

    expect(start.getHours()).toBe(0);
    expect(start.getDate()).toBe(21);
    expect(end.getDate()).toBe(22);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe('isSameDay / isToday', () => {
  it('compares calendar days, not instants', () => {
    expect(
      isSameDay(new Date(2026, 9, 21, 0, 0), new Date(2026, 9, 21, 23, 59)),
    ).toBe(true);
    expect(isSameDay(new Date(2026, 9, 21), new Date(2026, 9, 22))).toBe(false);
  });

  it('recognizes today', () => {
    expect(isToday(new Date())).toBe(true);
    expect(isToday(new Date(2020, 0, 1))).toBe(false);
  });
});

describe('toDateInputValue', () => {
  it('renders the local calendar date as yyyy-MM-dd', () => {
    expect(toDateInputValue(new Date(2026, 9, 21, 23, 30))).toBe('2026-10-21');
  });
});

describe('combineDateAndTime', () => {
  it('builds a local date', () => {
    const date = combineDateAndTime('2026-10-21', 9, 30);

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(9);
    expect(date.getDate()).toBe(21);
    expect(date.getHours()).toBe(9);
    expect(date.getMinutes()).toBe(30);
  });

  it('returns an invalid date for malformed input', () => {
    expect(Number.isNaN(combineDateAndTime('nope', 9, 0).getTime())).toBe(true);
  });
});

describe('isValidDateValue', () => {
  it('accepts a real calendar date', () => {
    expect(isValidDateValue('2026-10-21')).toBe(true);
  });

  it('rejects malformed and impossible dates', () => {
    expect(isValidDateValue('2026-2-1')).toBe(false);
    expect(isValidDateValue('21/10/2026')).toBe(false);
    expect(isValidDateValue('2026-02-31')).toBe(false);
    expect(isValidDateValue('')).toBe(false);
  });
});

describe('isValidTimeOfDay', () => {
  it('accepts 24-hour clock times', () => {
    expect(isValidTimeOfDay(0, 0)).toBe(true);
    expect(isValidTimeOfDay(23, 59)).toBe(true);
  });

  it('rejects out-of-range and non-integer values', () => {
    expect(isValidTimeOfDay(24, 0)).toBe(false);
    expect(isValidTimeOfDay(9, 60)).toBe(false);
    expect(isValidTimeOfDay(Number.NaN, 0)).toBe(false);
  });
});

describe('isWithinMaxDuration', () => {
  it('accepts events up to 24 hours', () => {
    const start = new Date(2026, 9, 21, 9, 0);
    expect(isWithinMaxDuration(start, new Date(2026, 9, 22, 9, 0))).toBe(true);
    expect(isWithinMaxDuration(start, new Date(2026, 9, 22, 9, 1))).toBe(false);
  });
});

describe('addDaysToDateValue', () => {
  it('adds days in local time and keeps the yyyy-MM-dd format', () => {
    expect(addDaysToDateValue('2026-10-19', 1)).toBe('2026-10-20');
    expect(addDaysToDateValue('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysToDateValue('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('returns an empty value for malformed input', () => {
    expect(addDaysToDateValue('21/10/2026', 1)).toBe('');
    expect(addDaysToDateValue('', 1)).toBe('');
  });
});

describe('toEndOfDayInstant', () => {
  it('returns the last instant of the local day', () => {
    expect(toEndOfDayInstant('2026-10-19')).toBe(
      new Date(2026, 9, 19, 23, 59, 59, 999).toISOString(),
    );
  });

  it('returns an empty string for malformed input', () => {
    expect(toEndOfDayInstant('not-a-date')).toBe('');
  });
});

describe('isNextDayEnd', () => {
  it('is true when the event ends on the day after it starts', () => {
    const start = new Date(2026, 9, 19, 23, 0).toISOString();
    const end = new Date(2026, 9, 20, 1, 0).toISOString();
    expect(isNextDayEnd(start, end)).toBe(true);
  });

  it('is false for a same-day event', () => {
    const start = new Date(2026, 9, 19, 10, 0).toISOString();
    const end = new Date(2026, 9, 19, 12, 0).toISOString();
    expect(isNextDayEnd(start, end)).toBe(false);
  });
});
