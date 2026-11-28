import { describe, expect, it } from 'vitest';
import { formatDayFrequency, formatDays } from './day-format';
import en from '../messages/en.json';
import es from '../messages/es.json';

const tWith =
  (messages: { days: Record<string, string> }) =>
  (key: string): string =>
    messages.days[key] ?? key;

describe('formatDays', () => {
  it('orders days Monday-first and translates them', () => {
    expect(formatDays(['friday', 'monday'], tWith(en))).toBe('Monday, Friday');
    expect(formatDays(['friday', 'monday'], tWith(es))).toBe('Lunes, Viernes');
  });

  it('drops unknown values and returns an empty string for no days', () => {
    expect(formatDays(['funday' as 'monday'], tWith(en))).toBe('');
    expect(formatDays([], tWith(en))).toBe('');
  });
});

describe('formatDayFrequency', () => {
  it('parses the JSON day list and translates it', () => {
    expect(formatDayFrequency('["monday","wednesday"]', tWith(en))).toBe(
      'Monday, Wednesday'
    );
    expect(formatDayFrequency('["monday","wednesday"]', tWith(es))).toBe(
      'Lunes, Miércoles'
    );
  });

  it('returns null for missing, malformed or unknown-only values', () => {
    expect(formatDayFrequency(undefined, tWith(en))).toBeNull();
    expect(formatDayFrequency('', tWith(en))).toBeNull();
    expect(formatDayFrequency('not json', tWith(en))).toBeNull();
    expect(formatDayFrequency('{"monday":true}', tWith(en))).toBeNull();
    expect(formatDayFrequency('["funday"]', tWith(en))).toBeNull();
  });
});
