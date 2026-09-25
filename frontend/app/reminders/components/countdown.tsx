'use client';

import { Clock } from 'lucide-react';

export function formatRemaining(ms: number): string {
  if (ms <= 0) return '';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

interface CountdownProps {
  /** ISO timestamp the reminder unlocks/expires at. */
  target: string;
  /** Shared tick owned by the page — keeps all cards in sync. */
  now: Date;
  /** Sentence with the target date, e.g. "Opens Sep 30, 7:00 PM". */
  label: string;
}

export function Countdown({ target, now, label }: CountdownProps) {
  const remaining = new Date(target).getTime() - now.getTime();
  if (remaining <= 0) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
      <Clock className="h-4 w-4 shrink-0" />
      <span>{label}</span>
      <span className="font-medium text-foreground tabular-nums">
        {formatRemaining(remaining)}
      </span>
    </div>
  );
}
