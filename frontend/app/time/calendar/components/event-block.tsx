'use client';

import type { CalendarEvent } from '@shared/types/calendar';
import { cn } from '@/lib/utils';
import { Repeat } from 'lucide-react';
import { formatTimeRange } from '../lib/week';

const ACCENT_BARS: Record<string, string> = {
  Work: 'bg-secondary',
  Study: 'bg-primary',
  Reading: 'bg-primary',
  Exercise: 'bg-success',
  Meditation: 'bg-success',
  Social: 'bg-warning',
  Entertainment: 'bg-warning',
  Gaming: 'bg-warning',
  Hobbies: 'bg-secondary',
  default: 'bg-primary',
};

interface EventBlockProps {
  event: CalendarEvent;
  lane: number;
  laneCount: number;
  topPercent: number;
  heightPercent: number;
  onClick: () => void;
}

export function EventBlock({
  event,
  lane,
  laneCount,
  topPercent,
  heightPercent,
  onClick,
}: EventBlockProps) {
  const accent = ACCENT_BARS[event.category] ?? ACCENT_BARS.default;
  const timeRange = formatTimeRange(event.startAt, event.endAt);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={`${event.title}, ${timeRange}`}
      className={cn(
        'absolute z-10 overflow-hidden rounded-md border border-border bg-surface pl-2.5 pr-1.5 py-1 text-left',
        'transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        'flex flex-col justify-start gap-0.5'
      )}
      style={{
        top: `${topPercent}%`,
        height: `calc(${heightPercent}% - 2px)`,
        minHeight: 22,
        left: `calc(${(lane / laneCount) * 100}% + 2px)`,
        width: `calc(${100 / laneCount}% - 4px)`,
      }}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-0 top-0 bottom-0 w-1',
          accent
        )}
      />
      <span className="flex items-center gap-1">
        {event.seriesId ? (
          <Repeat
            aria-hidden
            className="h-3 w-3 shrink-0 text-muted-foreground"
          />
        ) : null}
        <span className="min-w-0 truncate text-xs font-medium leading-tight text-foreground">
          {event.title}
        </span>
      </span>
      <span className="truncate text-[11px] leading-tight text-muted-foreground">
        {timeRange}
      </span>
    </button>
  );
}
