import { isToday, isYesterday } from 'date-fns';

/** Local-timezone day key (YYYY-MM-DD) used to group movements by day. */
export function getDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Label for a day header: "Today", "Yesterday", or a readable date. */
export function getDayLabel(
  date: Date,
  t: (key: string) => string
): string {
  if (isToday(date)) return t('today');
  if (isYesterday(date)) return t('yesterday');

  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Short date, e.g. "Aug 8, 2026". */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Time of day, e.g. "3:45 PM". */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
