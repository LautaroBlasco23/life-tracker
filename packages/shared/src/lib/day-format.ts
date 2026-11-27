import { DAYS_OF_WEEK, type DayOfWeek } from '../types/activity';

type Translate = (key: string) => string;

/** Formats days in Monday-first order, translated through `t`. */
export function formatDays(days: readonly DayOfWeek[], t: Translate): string {
  return DAYS_OF_WEEK.filter((day) => days.includes(day))
    .map((day) => t(day))
    .join(', ');
}

/**
 * Formats the JSON-encoded `dayFrequency` the API stores (e.g.
 * `["monday","friday"]`) as a translated, Monday-first list. Returns null for
 * missing or unparsable values so callers can skip the label entirely.
 */
export function formatDayFrequency(
  dayFrequency: string | null | undefined,
  t: Translate
): string | null {
  if (!dayFrequency) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(dayFrequency);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const days = DAYS_OF_WEEK.filter((day) => parsed.includes(day));
  return days.length > 0 ? formatDays(days, t) : null;
}
