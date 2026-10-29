'use client';

import { useEffect, useRef, useState } from 'react';
import type { CalendarEvent } from '@shared/types/calendar';
import { cn } from '@/lib/utils';
import {
  HOURS_IN_DAY,
  HOUR_HEIGHT,
  formatDayLabel,
  formatHourLabel,
  isToday,
  toDateInputValue,
} from '../lib/week';
import { DayColumn } from './day-column';

const DEFAULT_SCROLL_HOUR = 7;

interface WeekGridProps {
  days: Date[];
  events: CalendarEvent[];
  /** Prefix for dnd ids; each rendered grid needs its own to keep them unique. */
  idPrefix?: string;
  onSlotClick: (day: Date, minutes: number) => void;
  onEventClick: (event: CalendarEvent) => void;
  className?: string;
}

export function WeekGrid({
  days,
  events,
  idPrefix = 'week',
  onSlotClick,
  onEventClick,
  className,
}: WeekGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());

  // One timer for the whole grid keeps the now-line fresh without per-event
  // intervals.
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = DEFAULT_SCROLL_HOUR * HOUR_HEIGHT;
    }
  }, []);

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface overflow-hidden',
        className
      )}
    >
      {/* Day headers */}
      <div className="flex border-b border-border">
        <div className="w-14 shrink-0" />
        {days.map((day) => {
          const { weekday, dayNumber } = formatDayLabel(day);
          const today = isToday(day);

          return (
            <div
              key={toDateInputValue(day)}
              className="flex-1 border-l border-border py-2 text-center"
            >
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {weekday}
              </div>
              <div
                className={cn(
                  'text-sm font-semibold tabular-nums',
                  today ? 'text-primary' : 'text-foreground'
                )}
              >
                {dayNumber}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable 24h body */}
      <div
        ref={scrollRef}
        className="overflow-y-auto max-h-[calc(100vh-22rem)] min-h-[320px]"
      >
        <div
          className="relative flex"
          style={{ height: HOURS_IN_DAY * HOUR_HEIGHT }}
        >
          {/* Hour gutter */}
          <div className="relative w-14 shrink-0 border-r border-border">
            {Array.from({ length: HOURS_IN_DAY }, (_, hour) => (
              <div
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground"
                style={{ top: hour * HOUR_HEIGHT }}
              >
                {hour === 0 ? '' : formatHourLabel(hour)}
              </div>
            ))}
          </div>

          {days.map((day) => (
            <DayColumn
              key={toDateInputValue(day)}
              day={day}
              events={events}
              now={now}
              idPrefix={idPrefix}
              onSlotClick={onSlotClick}
              onEventClick={onEventClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
