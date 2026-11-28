import { describe, expect, it } from 'vitest';
import { buildDateTime, formatDateInput, formatTimeInput } from './datetime';

describe('buildDateTime', () => {
  it('combines a calendar date with an HH:MM value in local time', () => {
    const result = buildDateTime(new Date(2026, 5, 15), '09:30');

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(30);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('overrides the source date time-of-day (seconds/millis zeroed)', () => {
    const result = buildDateTime(new Date(2026, 11, 31, 23, 59, 59, 999), '00:05');

    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(5);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });
});

describe('formatDateInput', () => {
  it('zero-pads month and day to YYYY-MM-DD', () => {
    expect(formatDateInput(new Date(2026, 2, 5))).toBe('2026-03-05');
    expect(formatDateInput(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('formatTimeInput', () => {
  it('zero-pads hours and minutes to HH:MM', () => {
    expect(formatTimeInput(new Date(2026, 5, 15, 7, 5))).toBe('07:05');
    expect(formatTimeInput(new Date(2026, 5, 15, 23, 59))).toBe('23:59');
  });
});

describe('input round-trip', () => {
  it('date and time inputs rebuild to the same local instant (via components)', () => {
    const original = new Date(2026, 8, 2, 14, 45);
    const rebuilt = buildDateTime(
      new Date(2026, 8, 2),
      formatTimeInput(original)
    );

    expect(rebuilt.getTime()).toBe(original.getTime());
  });

  it('gotcha: a bare "YYYY-MM-DD" string parses as UTC, not local', () => {
    // Documented because consuming code must not reconstruct instants from
    // formatDateInput output with the Date(string) constructor.
    const utcParsed = new Date(formatDateInput(new Date(2026, 8, 2, 12, 0)));
    expect(utcParsed.toISOString()).toBe('2026-09-02T00:00:00.000Z');
  });
});
