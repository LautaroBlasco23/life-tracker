'use client';

import { useMemo, useState } from 'react';
import type { CalendarEvent, CalendarEventScope } from '@shared/types/calendar';
import { calendarService } from '@shared/services/calendar-service';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { DeleteModal } from '@/components/ui/card/delete-modal';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { showToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { useTranslations } from '@shared/contexts/language-context';
import { CalendarToolbar } from '../calendar/components/calendar-toolbar';
import { WeekGrid } from '../calendar/components/week-grid';
import {
  clearEventDragged,
  markEventDragged,
} from '../calendar/components/event-block';
import {
  CalendarEventModal,
  type EventDefaults,
} from '../calendar/modal/calendar-event-modal';
import { useWeekEvents } from '../calendar/hooks/use-week-events';
import {
  MINUTES_PER_DAY,
  dropEventTimes,
  formatDayLabel,
  formatTimeRange,
  getWeekDays,
  getWeekStart,
  isSameDay,
  isToday,
  shiftWeek,
  toDateInputValue,
} from '../calendar/lib/week';

const DEFAULT_EVENT_START_MINUTES = 9 * 60;
const DEFAULT_EVENT_DURATION_MINUTES = 60;

/**
 * Splits a dnd id like "week-12" or "day-2026-10-27" into its grid prefix
 * (unique per rendered grid) and its value (event id or column date).
 */
function splitDndId(id: string): { prefix: string; value: string } {
  const separator = id.indexOf('-');
  if (separator < 0) return { prefix: '', value: id };
  return { prefix: id.slice(0, separator), value: id.slice(separator + 1) };
}

/** The dnd setup of the calendar grid: pointer drags (6px) + keyboard. */
function useCalendarSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
}

export function CalendarView() {
  const t = useTranslations('calendar');
  const tCommon = useTranslations('common');

  const [anchor, setAnchor] = useState(() => new Date());
  const weekStart = useMemo(() => getWeekStart(anchor), [anchor]);
  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

  const { events, isLoading, reload } = useWeekEvents(weekStart);

  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(
    null
  );
  const sensors = useCalendarSensors();

  const onDragStart = (dragStart: DragStartEvent) => {
    const event = events.find((e) => {
      const { prefix, value } = splitDndId(String(dragStart.active.id));
      return prefix !== '' && Number(value) === e.id;
    });
    if (event) markEventDragged(event.id);
    setDraggingEvent(event ?? null);
  };

  const onDragEnd = (dragEnd: DragEndEvent) => {
    setDraggingEvent(null);
    clearEventDragged();

    const over = dragEnd.over;
    if (!over) return;

    const eventId = splitDndId(String(dragEnd.active.id));
    const target = splitDndId(String(over.id));
    const event = events.find((e) => Number(eventId.value) === e.id);
    if (!event || eventId.prefix === '' || target.prefix !== eventId.prefix) {
      return;
    }

    // Time comes from where the dragged block ends up inside the column,
    // not from the pointer: keeps duration and 30-minute snapping.
    const translated = dragEnd.active.rect.current.translated;
    const columnRect = over.rect;
    if (!translated || !columnRect || columnRect.height <= 0) return;

    const original = new Date(event.startAt).getTime();
    const times = dropEventTimes({
      dayValue: target.value,
      offsetY: translated.top - columnRect.top,
      columnHeight: columnRect.height,
      durationMs: new Date(event.endAt).getTime() - original,
    });
    if (!times) return;
    // Dropping back on the same slot is a no-op, not a request.
    if (new Date(times.startAt).getTime() === original) return;

    calendarService
      .updateEvent(
        event.id,
        { startAt: times.startAt, endAt: times.endAt },
        'occurrence'
      )
      .then(() => reload())
      .catch((error) =>
        showToast({
          title: t('failedToSave'),
          description: error instanceof Error ? error.message : undefined,
          variant: 'destructive',
        })
      );
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [defaults, setDefaults] = useState<EventDefaults | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<CalendarEvent | null>(
    null
  );
  const [deleteScope, setDeleteScope] =
    useState<CalendarEventScope>('occurrence');

  const goToWeek = (offset: number) => {
    const nextWeek = shiftWeek(weekStart, offset);
    setAnchor(nextWeek);
    setSelectedDay(nextWeek);
  };

  const goToToday = () => {
    const today = new Date();
    setAnchor(today);
    setSelectedDay(today);
  };

  const openCreateModal = (day: Date, startMinutes: number) => {
    const start = Math.min(startMinutes, MINUTES_PER_DAY - 30);
    setEditingEvent(null);
    setDefaults({
      date: day,
      startMinutes: start,
      endMinutes: start + DEFAULT_EVENT_DURATION_MINUTES,
    });
    setModalOpen(true);
  };

  const openNewEventModal = () => {
    const dayInWeek = days.find((day) => isSameDay(day, selectedDay));
    openCreateModal(dayInWeek ?? selectedDay, DEFAULT_EVENT_START_MINUTES);
  };

  const openEditModal = (event: CalendarEvent) => {
    setEditingEvent(event);
    setDefaults(null);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditingEvent(null);
    setDefaults(null);
    reload();
  };

  const handleRequestDelete = (event: CalendarEvent) => {
    setModalOpen(false);
    setDeletingEvent(event);
    setDeleteScope('occurrence');
  };

  const handleConfirmDelete = async () => {
    if (!deletingEvent) return;

    try {
      await calendarService.deleteEvent(deletingEvent.id, deleteScope);
      showToast({
        title: t('eventDeleted'),
        description: t('eventDeletedDescription'),
      });
      setDeletingEvent(null);
      reload();
    } catch (error) {
      showToast({
        title: t('failedToDelete'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const isEmpty = !isLoading && events.length === 0;

  return (
    <div>
      <CalendarToolbar
        weekStart={weekStart}
        onPreviousWeek={() => goToWeek(-1)}
        onNextWeek={() => goToWeek(1)}
        onToday={goToToday}
        onNewEvent={openNewEventModal}
      />

      {/* Small screens: the 7-column grid is unusable below ~768px, so the
          same grid renders a single selected day instead. */}
      <div className="flex gap-1 mb-3 md:hidden">
        {days.map((day) => {
          const { weekday, dayNumber } = formatDayLabel(day);
          const selected = isSameDay(day, selectedDay);

          return (
            <button
              key={toDateInputValue(day)}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={cn(
                'flex-1 rounded-md border px-1 py-2 text-center transition-colors',
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-surface text-foreground hover:bg-accent'
              )}
            >
              <span className="block text-[10px] uppercase tracking-wide">
                {weekday}
              </span>
              <span
                className={cn(
                  'block text-sm font-semibold tabular-nums',
                  !selected && isToday(day) && 'text-primary'
                )}
              >
                {dayNumber}
              </span>
            </button>
          );
        })}
      </div>

      <div className="hidden md:block">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setDraggingEvent(null);
            clearEventDragged();
          }}
        >
          <WeekGrid
            days={days}
            events={events}
            idPrefix="week"
            onSlotClick={openCreateModal}
            onEventClick={openEditModal}
          />
          <DragOverlay dropAnimation={null}>
            {draggingEvent ? (
              <div className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground shadow-lg">
                {draggingEvent.title}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <div className="md:hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setDraggingEvent(null);
            clearEventDragged();
          }}
        >
          <WeekGrid
            days={[selectedDay]}
            events={events}
            idPrefix="singleDay"
            onSlotClick={openCreateModal}
            onEventClick={openEditModal}
          />
        </DndContext>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {isLoading ? tCommon('loading') : isEmpty ? t('emptyWeek') : null}
      </p>

      <CalendarEventModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        event={editingEvent}
        defaults={defaults}
        onSaved={handleSaved}
        onRequestDelete={handleRequestDelete}
      />

      <DeleteModal
        open={deletingEvent !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingEvent(null);
        }}
        title={t('deleteEvent')}
        itemName={deletingEvent?.title ?? ''}
        confirmLabel={t('deleteEventConfirm')}
        itemDetails={
          deletingEvent ? (
            <div className="text-sm">
              <div className="font-medium text-foreground mb-1">
                {deletingEvent.title}
              </div>
              <div className="text-muted-foreground text-xs">
                <div>{deletingEvent.category}</div>
                <div className="mt-1">
                  {formatTimeRange(deletingEvent.startAt, deletingEvent.endAt)}
                </div>
              </div>
              {deletingEvent.seriesId ? (
                <div className="mt-3 space-y-1.5">
                  <Label htmlFor="delete-scope" className="text-xs">
                    {t('deleteScope')}
                  </Label>
                  <Select
                    value={deleteScope}
                    onValueChange={(value) =>
                      setDeleteScope(value as CalendarEventScope)
                    }
                  >
                    <SelectTrigger id="delete-scope" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="occurrence">
                        {t('applyToOccurrence')}
                      </SelectItem>
                      <SelectItem value="series">
                        {t('applyToSeries')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null
        }
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
