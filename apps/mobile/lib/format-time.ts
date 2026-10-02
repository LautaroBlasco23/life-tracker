import { formatShortDate, formatTime } from '@shared/utils/format';

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

export function formatTimerDisplay(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hrs, mins, secs]
    .map((n) => n.toString().padStart(2, '0'))
    .join(':');
}

/** Compact "Sep 30, 3:45 PM" style record date. */
export function formatRecordDate(dateString: string): string {
  const d = new Date(dateString);
  return `${formatShortDate(d)} ${formatTime(d)}`;
}

