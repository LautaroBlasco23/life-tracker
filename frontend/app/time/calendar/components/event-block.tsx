'use client';

import type { CalendarEvent } from '@shared/types/calendar';
import { useDraggable } from '@dnd-kit/core';
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

/**
 * Marks an event as "just dragged" so the click browsers dispatch right
 * after pointerup does not open the edit modal. The mark is consumed by the
 * next click on that event and falls back to clearing itself shortly after
 * (the click fires synchronously after the drag-end callback).
 */
let draggedEventId: number | null = null;

export function markEventDragged(eventId: number): void {
  draggedEventId = eventId;
}

export function clearEventDragged(): void {
  globalThis.setTimeout(() => {
    draggedEventId = null;
  }, 0);
}

interface EventBlockProps {
  event: CalendarEvent;
  lane: number;
  laneCount: number;
  topPercent: number;
  heightPercent: number;
  /** dnd-kit id for the draggable; omits drag behavior when absent. */
  dndId?: string;
  onClick: () => void;
}

export function EventBlock({
  event,
  lane,
  laneCount,
  topPercent,
  heightPercent,
  dndId,
  onClick,
}: EventBlockProps) {
  const accent = ACCENT_BARS[event.category] ?? ACCENT_BARS.default;
  const timeRange = formatTimeRange(event.startAt, event.endAt);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dndId ?? event.id,
    disabled: !dndId,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        // A click right after a real drag must not open the edit modal.
        if (draggedEventId === event.id) {
          draggedEventId = null;
          return;
        }
        onClick();
      }}
      aria-label={`${event.title}, ${timeRange}`}
      className={cn(
        'absolute z-10 overflow-hidden rounded-md border border-border bg-surface pl-2.5 pr-1.5 py-1 text-left touch-none',
        'transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        'flex flex-col justify-start gap-0.5 cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-40'
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
