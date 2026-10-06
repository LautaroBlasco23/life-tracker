/**
 * Date/time helpers shared by the activity/reminder forms on web and mobile.
 * All functions work in the user's local timezone.
 */

/** Combines a calendar date with an "HH:MM" time input value into a local Date. */
export function buildDateTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/** Formats a Date as a "YYYY-MM-DD" date input value. */
export function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Formats a Date as an "HH:MM" time input value. */
export function formatTimeInput(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
