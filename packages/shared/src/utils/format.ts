// Platform-agnostic formatting/date helpers shared by web and mobile.

export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatInputValue(value: string): string {
  const numericValue = value.replace(/[^0-9]/g, '');
  if (!numericValue) return '';
  return Number(numericValue).toLocaleString('en-US');
}

export function parseInputValue(formattedValue: string): string {
  return formattedValue.replace(/,/g, '');
}

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
  if (getDayKey(date) === getDayKey(new Date())) return t('today');
  if (getDayKey(date) === getDayKey(new Date(Date.now() - 86_400_000)))
    return t('yesterday');

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

/**
 * Convert a date-input value (YYYY-MM-DD, user's local calendar date) to a
 * UTC ISO string at local midnight. Stored this way, the instant renders back
 * to the same calendar date in the user's timezone (the app sends its IANA
 * timezone on every request and the backend filters in that zone).
 */
export function dateInputToISO(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toISOString();
}

/** Convert an ISO instant to the user's local calendar date-input value. */
export function isoToDateInput(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** User's local calendar date (YYYY-MM-DD) for "today". */
export function todayInput(): string {
  return getDayKey(new Date());
}
