'use client';

import { useMemo } from 'react';
import type { CalendarEvent } from '@shared/types/calendar';
import { cn } from '@/lib/utils';
import { layoutDayEvents } from '../lib/layout';
import {
  HOURS_IN_DAY,
  HOUR_HEIGHT,
  MINUTES_PER_DAY,
  isToday,
  minutesFromMidnight,
  minutesFromOffset,
} from '../lib/week';
import { EventBlock } from './event-block';

interface DayColumnProps {
  day: Date;
  events: CalendarEvent[];
  /** Current time, refreshed by the parent once a minute. */
  now: Date;
  onSlotClick: (day: Date, minutes: number) => void;
  onEventClick: (event: CalendarEvent) => void;
}

export function DayColumn({
  day,
  events,
  now,
  onSlotClick,
  onEventClick,
}: DayColumnProps) {
  const positioned = useMemo(() => layoutDayEvents(events, day), [events, day]);
  const today = isToday(day);

  const handleColumnClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onSlotClick(day, minutesFromOffset(event.clientY - rect.top, rect.height));
  };

  return (
    <div
      onClick={handleColumnClick}
      className={cn(
        'relative flex-1 border-l border-border first:border-l-0',
        today && 'bg-primary/[0.03]'
      )}
      data-day={day.toDateString()}
    >
      {Array.from({ length: HOURS_IN_DAY }, (_, hour) => (
        <div
          key={hour}
          aria-hidden
          className="pointer-events-none absolute left-0 right-0 border-t border-border/60"
          style={{ top: hour * HOUR_HEIGHT }}
        />
      ))}

      {positioned.map(
        ({ event, lane, laneCount, topPercent, heightPercent }) => (
          <EventBlock
            key={event.id}
            event={event}
            lane={lane}
            laneCount={laneCount}
            topPercent={topPercent}
            heightPercent={heightPercent}
            onClick={() => onEventClick(event)}
          />
        )
      )}

      {today && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 right-0 z-20"
          style={{
            top: `${(minutesFromMidnight(now) / MINUTES_PER_DAY) * 100}%`,
          }}
        >
          <div className="h-px w-full bg-primary" />
          <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-primary" />
        </div>
      )}
    </div>
  );
}
