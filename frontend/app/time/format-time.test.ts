import { describe, expect, it } from 'vitest';
import { formatDuration, formatTimerDisplay } from './format-time';

describe('formatDuration', () => {
  it('formats sub-hour durations in minutes', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(5)).toBe('5 min');
    expect(formatDuration(59)).toBe('59 min');
  });

  it('formats whole hours without minutes', () => {
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(120)).toBe('2h');
  });

  it('formats mixed hours and minutes', () => {
    expect(formatDuration(61)).toBe('1h 1m');
    expect(formatDuration(150)).toBe('2h 30m');
  });
});

describe('formatTimerDisplay', () => {
  it('pads every segment to two digits', () => {
    expect(formatTimerDisplay(0)).toBe('00:00:00');
    expect(formatTimerDisplay(59)).toBe('00:00:59');
    expect(formatTimerDisplay(60)).toBe('00:01:00');
  });

  it('splits hours, minutes and seconds', () => {
    expect(formatTimerDisplay(3661)).toBe('01:01:01');
    expect(formatTimerDisplay(3725)).toBe('01:02:05');
  });
});
