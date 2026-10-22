import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CalendarX, ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import { calendarService, useLanguage, useTranslations } from '@shared';
import type { CalendarEvent } from '@shared/types/calendar';
import { showToast } from '../ui/toast';
import { Button } from '../ui/button';
import { DeleteModal } from '../ui/delete-modal';
import { useCategoryLabel } from '../../lib/category-labels';
import {
  formatDayHeading,
  formatTimeRange,
  formatWeekLabel,
  formatWeekday,
  getDayRange,
  getWeekDays,
  getWeekRange,
  getWeekStart,
  isSameDay,
  isToday,
  shiftWeek,
  toDateInputValue,
} from '../../lib/calendar-week';
import { useColors } from '../../lib/use-colors';
import { cn } from '../../lib/cn';
import {
  CalendarEventFormModal,
  type CalendarEventDefaults,
} from './calendar-event-form-modal';

const DEFAULT_START_MINUTES = 9 * 60;
const DEFAULT_DURATION_MINUTES = 60;

/**
 * Accent color per category (same mapping as web's event-block accent bars),
 * expressed with palette tokens so it follows the light/dark theme.
 */
const CATEGORY_ACCENT_CLASS: Record<string, string> = {
  Work: 'bg-secondary dark:bg-dark-secondary',
  Hobbies: 'bg-secondary dark:bg-dark-secondary',
  Exercise: 'bg-success dark:bg-dark-success',
  Meditation: 'bg-success dark:bg-dark-success',
  Social: 'bg-warning dark:bg-dark-warning',
  Gaming: 'bg-warning dark:bg-dark-warning',
  Entertainment: 'bg-warning dark:bg-dark-warning',
  Study: 'bg-primary dark:bg-dark-primary',
  Reading: 'bg-primary dark:bg-dark-primary',
};

const DEFAULT_ACCENT_CLASS = 'bg-primary dark:bg-dark-primary';

/**
 * Calendar tab (mobile port of web's calendar-view): a 7-day strip for the
 * current week plus the agenda of the selected day.
 */
export function CalendarView() {
  const t = useTranslations('calendar');
  const { locale } = useLanguage();
  const categoryLabel = useCategoryLabel();
  const colors = useColors();
  const intlLocale = locale === 'es' ? 'es-ES' : 'en-US';

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [formDefaults, setFormDefaults] = useState<CalendarEventDefaults | null>(
    null
  );
  const [deletingEvent, setDeletingEvent] = useState<CalendarEvent | null>(
    null
  );

  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      // `from` and `to` always travel together: the backend rejects a range
      // with a single bound.
      const { from, to } = getWeekRange(weekStart);

      calendarService
        .getEvents({ from, to })
        .then((data) => {
          if (cancelled) return;
          setEvents(data);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setEvents([]);
          showToast({
            title: t('failedToLoad'),
            description: error instanceof Error ? error.message : undefined,
            variant: 'destructive',
          });
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [weekStart, reloadKey, t])
  );

  const dayEvents = useMemo(() => {
    const { start, end } = getDayRange(selectedDay);
    return events
      .filter((event) => {
        const eventStart = new Date(event.startAt);
        const eventEnd = new Date(event.endAt);
        return eventStart < end && eventEnd > start;
      })
      .sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      );
  }, [events, selectedDay]);

  const goToWeek = (offset: number) => {
    const nextWeek = shiftWeek(weekStart, offset);
    setWeekStart(nextWeek);
    setSelectedDay(nextWeek);
  };

  const goToToday = () => {
    const today = new Date();
    setWeekStart(getWeekStart(today));
    setSelectedDay(today);
  };

  const openNewEvent = () => {
    const dayInWeek = days.find((day) => isSameDay(day, selectedDay));
    setEditingEvent(null);
    setFormDefaults({
      date: dayInWeek ?? selectedDay,
      startMinutes: DEFAULT_START_MINUTES,
      endMinutes: DEFAULT_START_MINUTES + DEFAULT_DURATION_MINUTES,
    });
    setShowFormModal(true);
  };

  const openEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setFormDefaults(null);
    setShowFormModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingEvent) return;
    const event = deletingEvent;
    try {
      await calendarService.deleteEvent(event.id);
      showToast({
        title: t('eventDeleted'),
        description: t('eventDeletedDescription'),
      });
      setDeletingEvent(null);
      setReloadKey((key) => key + 1);
    } catch (error) {
      showToast({
        title: t('failedToDelete'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
      throw error instanceof Error ? error : new Error('delete failed');
    }
  };

  return (
    <>
      <FlatList
        data={dayEvents}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View className="p-4 pb-0">
            <View className="flex-row items-center justify-between gap-2 mb-2">
              <View className="flex-row items-center gap-2">
                <Button
                  variant="outline"
                  className="h-9 w-9 px-0"
                  hitSlop={8}
                  onPress={() => goToWeek(-1)}
                  accessibilityLabel={t('previousWeek')}
                >
                  <ChevronLeft size={16} color={colors.foreground} />
                </Button>
                <Button
                  variant="outline"
                  className="h-9 px-3"
                  textClassName="text-sm"
                  onPress={goToToday}
                >
                  {t('today')}
                </Button>
                <Button
                  variant="outline"
                  className="h-9 w-9 px-0"
                  hitSlop={8}
                  onPress={() => goToWeek(1)}
                  accessibilityLabel={t('nextWeek')}
                >
                  <ChevronRight size={16} color={colors.foreground} />
                </Button>
              </View>
              <Button className="h-9 px-3" onPress={openNewEvent}>
                <View className="flex-row items-center gap-1.5">
                  <Plus size={14} color={colors.primaryForeground} />
                  <Text className="text-sm text-primary-foreground dark:text-dark-primary-foreground">
                    {t('newEvent')}
                  </Text>
                </View>
              </Button>
            </View>

            <Text className="text-sm font-medium text-foreground dark:text-dark-foreground mb-3">
              {formatWeekLabel(weekStart, intlLocale)}
            </Text>

            {/* 7-day picker strip (web's small-screen fallback) */}
            <View className="flex-row gap-1 mb-4">
              {days.map((day) => {
                const selected = isSameDay(day, selectedDay);
                return (
                  <Pressable
                    key={toDateInputValue(day)}
                    onPress={() => setSelectedDay(day)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    className={cn(
                      'flex-1 rounded-lg border px-1 py-2 items-center',
                      selected
                        ? 'border-primary bg-primary dark:border-dark-primary dark:bg-dark-primary'
                        : 'border-border dark:border-dark-border bg-surface dark:bg-dark-surface'
                    )}
                  >
                    <Text
                      className={cn(
                        'text-[10px] uppercase tracking-wide',
                        selected
                          ? 'text-primary-foreground dark:text-dark-primary-foreground'
                          : 'text-muted dark:text-dark-muted'
                      )}
                      numberOfLines={1}
                    >
                      {formatWeekday(day, intlLocale)}
                    </Text>
                    <Text
                      className={cn(
                        'text-sm font-semibold tabular-nums',
                        selected
                          ? 'text-primary-foreground dark:text-dark-primary-foreground'
                          : isToday(day)
                            ? 'text-primary dark:text-dark-primary'
                            : 'text-foreground dark:text-dark-foreground'
                      )}
                    >
                      {day.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="text-base font-semibold text-foreground dark:text-dark-foreground mb-3">
              {formatDayHeading(selectedDay, intlLocale)}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openEditEvent(item)}
            className="mx-4 mb-2 rounded-xl border border-border dark:border-dark-border bg-surface dark:bg-dark-surface p-4 flex-row gap-3"
          >
            <View
              className={cn(
                'w-1 rounded-full self-stretch',
                CATEGORY_ACCENT_CLASS[item.category] ?? DEFAULT_ACCENT_CLASS
              )}
            />
            <View className="flex-1">
              <Text className="text-base font-medium text-foreground dark:text-dark-foreground">
                {item.title}
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                {formatTimeRange(item.startAt, item.endAt)}
              </Text>
              {item.description ? (
                <Text className="text-xs text-muted dark:text-dark-muted mt-1">
                  {item.description}
                </Text>
              ) : null}
              <View className="rounded-md bg-primary/10 dark:bg-dark-primary/10 px-2 py-0.5 mt-2 self-start">
                <Text className="text-xs text-primary dark:text-dark-primary">
                  {categoryLabel(item.category)}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
        contentContainerClassName="pb-24"
        ListEmptyComponent={
          isLoading ? (
            <View className="py-10 items-center">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View className="items-center px-4 pt-6">
              <View className="h-16 w-16 rounded-full bg-surface dark:bg-dark-surface items-center justify-center mb-4">
                <CalendarX size={28} color={colors.textMuted} />
              </View>
              <Text className="text-lg font-medium text-foreground dark:text-dark-foreground text-center">
                {t('noEventsForDay')}
              </Text>
              <View className="mt-4">
                <Button
                  variant="outline"
                  className="h-9 px-3"
                  onPress={openNewEvent}
                >
                  <View className="flex-row items-center gap-1.5">
                    <Plus size={14} color={colors.foreground} />
                    <Text className="text-sm text-foreground dark:text-dark-foreground">
                      {t('newEvent')}
                    </Text>
                  </View>
                </Button>
              </View>
            </View>
          )
        }
      />

      <CalendarEventFormModal
        visible={showFormModal}
        event={editingEvent}
        defaults={formDefaults}
        onClose={() => {
          setShowFormModal(false);
          setEditingEvent(null);
          setFormDefaults(null);
        }}
        onSaved={() => setReloadKey((key) => key + 1)}
        onRequestDelete={(event) => {
          setShowFormModal(false);
          setEditingEvent(null);
          setDeletingEvent(event);
        }}
      />

      <DeleteModal
        visible={deletingEvent !== null}
        onClose={() => setDeletingEvent(null)}
        title={t('deleteEvent')}
        itemName={deletingEvent?.title ?? ''}
        itemDetails={
          deletingEvent ? (
            <View>
              <Text className="text-sm font-medium text-foreground dark:text-dark-foreground">
                {deletingEvent.title}
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted mt-1">
                {categoryLabel(deletingEvent.category)} ·{' '}
                {formatTimeRange(deletingEvent.startAt, deletingEvent.endAt)}
              </Text>
            </View>
          ) : null
        }
        confirmLabel={t('deleteEventConfirm')}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
