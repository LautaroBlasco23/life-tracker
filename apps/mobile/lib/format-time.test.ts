import { describe, expect, it } from '@jest/globals';
import {
  dateInputToISO,
  formatInputValue,
  isoToDateInput,
  parseInputValue,
} from '@shared/utils/format';
import {
  formatDuration,
  formatTimerDisplay,
} from './format-time';

describe('formatDuration', () => {
  it('formats minutes under an hour', () => {
    expect(formatDuration(45)).toBe('45 min');
  });

  it('formats whole hours', () => {
    expect(formatDuration(120)).toBe('2h');
  });

  it('formats hours with remainder', () => {
    expect(formatDuration(125)).toBe('2h 5m');
  });
});

describe('formatTimerDisplay', () => {
  it('zero-pads each unit', () => {
    expect(formatTimerDisplay(3725)).toBe('01:02:05');
  });

  it('formats zero', () => {
    expect(formatTimerDisplay(0)).toBe('00:00:00');
  });
});

describe('input value round-trip (currency inputs)', () => {
  it('formats digits with thousand separators', () => {
    expect(formatInputValue('1234567')).toBe('1,234,567');
  });

  it('strips non-numeric characters', () => {
    expect(formatInputValue('12a3.4')).toBe('1,234');
  });

  it('round-trips formatted -> parsed', () => {
    expect(parseInputValue(formatInputValue('1234567'))).toBe('1234567');
    expect(parseInputValue('')).toBe('');
  });
});

describe('date-input <-> ISO round-trip (local midnight)', () => {
  it('keeps the calendar date stable in the local timezone', () => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const iso = dateInputToISO(dateStr);
    expect(isoToDateInput(iso)).toBe(dateStr);
  });

  it('snaps to local midnight', () => {
    const iso = dateInputToISO('2026-01-15');
    const d = new Date(iso);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });
});
