import { describe, expect, it } from 'vitest';
import {
  MINUTES_PER_DAY,
  addDaysToDateValue,
  combineDateAndTime,
  dateAtMinutes,
  dropEventTimes,
  formatWeekLabel,
  getWeekDays,
  getWeekRange,
  getWeekStart,
  isSameDay,
  minutesFromOffset,
  shiftWeek,
  snapMinutes,
  timeInputValueAt,
  toDateInputValue,
  toEndOfDayInstant,
  toTimeInputValue,
  weekdayName,
} from './week';

// All dates are built in local time: the grid is a wall-clock view.

describe('getWeekStart', () => {
  it('returns Monday for any day of the week', () => {
    const monday = new Date(2026, 9, 19); // Monday Oct 19 2026
    expect(getWeekStart(monday).getDay()).toBe(1);
    expect(getWeekStart(new Date(2026, 9, 21)).getDate()).toBe(19); // Wednesday
    expect(getWeekStart(new Date(2026, 9, 25)).getDate()).toBe(19); // Sunday
    expect(getWeekStart(new Date(2026, 9, 26)).getDate()).toBe(26); // next Monday
  });

  it('normalizes the time to midnight', () => {
    const weekStart = getWeekStart(new Date(2026, 9, 21, 15, 42));
    expect(weekStart.getHours()).toBe(0);
    expect(weekStart.getMinutes()).toBe(0);
  });
});

describe('getWeekDays', () => {
  it('returns the seven days starting on Monday', () => {
    const days = getWeekDays(getWeekStart(new Date(2026, 9, 21)));
    expect(days).toHaveLength(7);
    expect(days[0].getDate()).toBe(19);
    expect(days[6].getDate()).toBe(25);
    expect(days.map((day) => day.getDay())).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });
});

describe('getWeekRange', () => {
  it('returns a half-open range of exactly seven days', () => {
    const weekStart = getWeekStart(new Date(2026, 9, 21));
    const { from, to } = getWeekRange(weekStart);
    const spanMs = new Date(to).getTime() - new Date(from).getTime();
    expect(spanMs).toBe(7 * 24 * 60 * 60 * 1000);
    expect(new Date(from).getTime()).toBe(weekStart.getTime());
  });
});

describe('shiftWeek', () => {
  it('moves by whole weeks and keeps the weekday', () => {
    const weekStart = getWeekStart(new Date(2026, 9, 21));
    expect(shiftWeek(weekStart, 1).getDate()).toBe(26);
    expect(shiftWeek(weekStart, -1).getDate()).toBe(12);
  });

  it('crosses month and year boundaries', () => {
    const december = getWeekStart(new Date(2026, 11, 30));
    const next = shiftWeek(december, 1);
    expect(next.getFullYear()).toBe(2027);
    expect(next.getMonth()).toBe(0);
  });
});

describe('formatWeekLabel', () => {
  it('collapses the month when the week is inside one month', () => {
    expect(formatWeekLabel(new Date(2026, 9, 19))).toBe('Oct 19 – 25, 2026');
  });

  it('shows both months when the week spans two', () => {
    expect(formatWeekLabel(new Date(2026, 9, 26))).toBe('Oct 26 – Nov 1, 2026');
  });
});

describe('minute-of-day math', () => {
  it('snaps down to the nearest half hour', () => {
    expect(snapMinutes(0)).toBe(0);
    expect(snapMinutes(29)).toBe(0);
    expect(snapMinutes(30)).toBe(30);
    expect(snapMinutes(599)).toBe(570);
    expect(snapMinutes(24 * 60)).toBe(MINUTES_PER_DAY);
  });

  it('maps a click offset to a snapped minute', () => {
    // Halfway down a 24h column is noon.
    expect(minutesFromOffset(720, 1440)).toBe(720);
    expect(minutesFromOffset(700, 1440)).toBe(690);
    expect(minutesFromOffset(0, 0)).toBe(0);
  });

  it('builds a date at a given minute of the day', () => {
    const day = new Date(2026, 9, 19);
    expect(toTimeInputValue(dateAtMinutes(day, 600))).toBe('10:00');
  });

  it('clamps 24:00 to 23:59 for time inputs', () => {
    const day = new Date(2026, 9, 19);
    expect(timeInputValueAt(day, MINUTES_PER_DAY)).toBe('23:59');
    expect(timeInputValueAt(day, 600)).toBe('10:00');
  });
});

describe('form values', () => {
  it('formats date and time inputs in local time', () => {
    const date = new Date(2026, 0, 5, 7, 5);
    expect(toDateInputValue(date)).toBe('2026-01-05');
    expect(toTimeInputValue(date)).toBe('07:05');
  });

  it('round-trips date and time inputs back to a local Date', () => {
    const built = combineDateAndTime('2026-10-19', '10:30');
    expect(built.getFullYear()).toBe(2026);
    expect(built.getMonth()).toBe(9);
    expect(built.getDate()).toBe(19);
    expect(built.getHours()).toBe(10);
    expect(built.getMinutes()).toBe(30);
  });

  it('returns an invalid date for malformed input', () => {
    expect(Number.isNaN(combineDateAndTime('', '10:00').getTime())).toBe(true);
    expect(Number.isNaN(combineDateAndTime('2026-10-19', '').getTime())).toBe(
      true
    );
  });
});

describe('recurrence bounds', () => {
  it('adds days to a date input value across months', () => {
    expect(addDaysToDateValue('2026-10-19', 28)).toBe('2026-11-16');
    expect(addDaysToDateValue('2026-12-30', 7)).toBe('2027-01-06');
    expect(addDaysToDateValue('2026-10-19', 0)).toBe('2026-10-19');
  });

  it('returns an empty value for a malformed date', () => {
    expect(addDaysToDateValue('', 7)).toBe('');
  });

  it('turns a date input value into the end of that local day', () => {
    const until = new Date(toEndOfDayInstant('2026-11-16'));
    expect(until.getFullYear()).toBe(2026);
    expect(until.getMonth()).toBe(10);
    expect(until.getDate()).toBe(16);
    expect(until.getHours()).toBe(23);
    expect(until.getMinutes()).toBe(59);
    expect(until.getSeconds()).toBe(59);
    expect(until.getMilliseconds()).toBe(999);
  });

  it('returns an empty value for a malformed date', () => {
    expect(toEndOfDayInstant('')).toBe('');
  });
});

describe('isSameDay', () => {
  it('ignores the time of day', () => {
    expect(
      isSameDay(new Date(2026, 9, 19, 0, 0), new Date(2026, 9, 19, 23, 59))
    ).toBe(true);
    expect(isSameDay(new Date(2026, 9, 19), new Date(2026, 9, 20))).toBe(false);
  });
});

describe('drag-and-drop times', () => {
  const hour = 60 * 60 * 1000;

  it('keeps the duration and snaps to the drop slot', () => {
    // A 10:00–12:00 event dropped halfway down the Friday column.
    const times = dropEventTimes({
      dayValue: '2026-10-23',
      offsetY: 720, // halfway of a 24h column, in pixels
      columnHeight: 1440, // 24h = 1440 "pixels" in the column scale
      durationMs: 2 * hour,
    });
    expect(times).toEqual({
      startAt: new Date(2026, 9, 23, 12, 0).toISOString(),
      endAt: new Date(2026, 9, 23, 14, 0).toISOString(),
    });
  });

  it('snaps down like slot clicks do', () => {
    const times = dropEventTimes({
      dayValue: '2026-10-23',
      offsetY: 700,
      columnHeight: 1440,
      durationMs: hour,
    });
    expect(times?.startAt).toBe(new Date(2026, 9, 23, 11, 30).toISOString());
  });

  it('clamps the bottom edge to 23:59 and lets long events spill over', () => {
    // offset past the bottom: minute 24:00 → 23:59; +2h ends the next day.
    const times = dropEventTimes({
      dayValue: '2026-10-23',
      offsetY: 1440,
      columnHeight: 1440,
      durationMs: 2 * hour,
    });
    expect(times?.startAt).toBe(new Date(2026, 9, 23, 23, 59).toISOString());
    expect(times?.endAt).toBe(new Date(2026, 9, 24, 1, 59).toISOString());
  });

  it('rejects a malformed target day', () => {
    expect(
      dropEventTimes({
        dayValue: '',
        offsetY: 0,
        columnHeight: 500,
        durationMs: hour,
      })
    ).toBeNull();
  });
});

describe('weekdayName', () => {
  it('maps dates to DayOfWeek names', () => {
    expect(weekdayName(new Date(2026, 9, 19))).toBe('monday');
    expect(weekdayName(new Date(2026, 9, 25))).toBe('sunday');
  });
});
