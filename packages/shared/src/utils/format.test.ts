import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dateInputToISO,
  formatCurrency,
  formatInputValue,
  formatShortDate,
  formatTime,
  getDayKey,
  getDayLabel,
  isoToDateInput,
  parseInputValue,
  todayInput,
} from './format';

afterEach(() => {
  vi.useRealTimers();
});

describe('formatCurrency', () => {
  it('adds thousands separators and at most 2 decimals', () => {
    expect(formatCurrency(1234.5)).toBe('1,234.5');
    expect(formatCurrency(1234567)).toBe('1,234,567');
    expect(formatCurrency(0)).toBe('0');
  });

  it('rounds to 2 decimal places', () => {
    expect(formatCurrency(19.999)).toBe('20');
  });
});

describe('formatInputValue / parseInputValue', () => {
  it('strips non-digits and groups the result', () => {
    expect(formatInputValue('1234')).toBe('1,234');
    expect(formatInputValue('12a34')).toBe('1,234'); // digits: 1234
    expect(formatInputValue('abc')).toBe('');
    expect(formatInputValue('')).toBe('');
  });

  it('parses back to a raw numeric string', () => {
    expect(parseInputValue('1,234')).toBe('1234');
    expect(parseInputValue('12,345,678')).toBe('12345678');
  });

  it('format -> parse round-trips the raw digits', () => {
    expect(parseInputValue(formatInputValue('9876543'))).toBe('9876543');
  });
});

describe('getDayKey', () => {
  it('returns the local YYYY-MM-DD key', () => {
    expect(getDayKey(new Date(2026, 0, 9))).toBe('2026-01-09');
    expect(getDayKey(new Date(2026, 11, 25))).toBe('2026-12-25');
  });
});

describe('getDayLabel', () => {
  const t = (key: string) => `<${key}>`;

  it('labels today and yesterday via the translations', () => {
    expect(getDayLabel(new Date(), t)).toBe('<today>');
    expect(getDayLabel(new Date(Date.now() - 86_400_000), t)).toBe(
      '<yesterday>'
    );
  });

  it('labels older dates, with the year only across years', () => {
    // A date guaranteed to be in the past and in the current year: Jan 2.
    const now = new Date();
    const earlyThisYear = new Date(now.getFullYear(), 0, 2);
    if (getDayKey(earlyThisYear) === getDayKey(now)) {
      return; // running on Jan 2: it is "today", skip the label assertion
    }
    expect(getDayLabel(earlyThisYear, t)).toBe('January 2');

    const pastYear = new Date(2020, 5, 15);
    expect(getDayLabel(pastYear, t)).toBe('June 15, 2020');
  });
});

describe('formatShortDate / formatTime', () => {
  it('formats the documented shapes', () => {
    expect(formatShortDate(new Date(2026, 7, 8))).toBe('Aug 8, 2026');
    const time = formatTime(new Date(2026, 7, 8, 15, 45));
    expect(time).toMatch(/^03:45\s?PM$/);
  });
});

describe('dateInputToISO / isoToDateInput', () => {
  it('converts a date input to an instant and back, same calendar day', () => {
    // Round-trip holds in every timezone: local midnight is stored so the
    // instant renders back to the same calendar date locally.
    const input = '2026-03-05';
    expect(isoToDateInput(dateInputToISO(input))).toBe(input);
  });

  it('dateInputToISO produces local midnight (seconds zeroed)', () => {
    const iso = dateInputToISO('2026-03-05');
    const parsed = new Date(iso);
    expect(parsed.getHours()).toBe(0);
    expect(parsed.getMinutes()).toBe(0);
    expect(parsed.getSeconds()).toBe(0);
  });
});

describe('todayInput', () => {
  it('equals the day key of now', () => {
    expect(todayInput()).toBe(getDayKey(new Date()));
  });
});
