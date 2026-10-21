'use client';

import { useMemo, useState } from 'react';
import type { CalendarEvent } from '@shared/types/calendar';
import { calendarService } from '@shared/services/calendar-service';
import { DeleteModal } from '@/components/ui/card/delete-modal';
import { showToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { useTranslations } from '@shared/contexts/language-context';
import { CalendarToolbar } from '../calendar/components/calendar-toolbar';
import { WeekGrid } from '../calendar/components/week-grid';
import {
  CalendarEventModal,
  type EventDefaults,
} from '../calendar/modal/calendar-event-modal';
import { useWeekEvents } from '../calendar/hooks/use-week-events';
import {
  MINUTES_PER_DAY,
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

export function CalendarView() {
  const t = useTranslations('calendar');
  const tCommon = useTranslations('common');

  const [anchor, setAnchor] = useState(() => new Date());
  const weekStart = useMemo(() => getWeekStart(anchor), [anchor]);
  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

  const { events, isLoading, reload } = useWeekEvents(weekStart);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [defaults, setDefaults] = useState<EventDefaults | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<CalendarEvent | null>(
    null
  );

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
  };

  const handleConfirmDelete = async () => {
    if (!deletingEvent) return;

    try {
      await calendarService.deleteEvent(deletingEvent.id);
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
        <WeekGrid
          days={days}
          events={events}
          onSlotClick={openCreateModal}
          onEventClick={openEditModal}
        />
      </div>

      <div className="md:hidden">
        <WeekGrid
          days={[selectedDay]}
          events={events}
          onSlotClick={openCreateModal}
          onEventClick={openEditModal}
        />
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
            </div>
          ) : null
        }
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
