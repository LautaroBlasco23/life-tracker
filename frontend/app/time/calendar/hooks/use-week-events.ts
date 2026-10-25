'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { calendarService } from '@shared/services/calendar-service';
import type { CalendarEvent } from '@shared/types/calendar';
import { useTranslations } from '@shared/contexts/language-context';
import { showToast } from '@/lib/toast';
import { getWeekRange } from '../lib/week';

/**
 * Loads the events overlapping the given week. Responses for a week the user
 * already navigated away from are dropped, so fast clicking cannot leave the
 * grid showing another week's data.
 */
export function useWeekEvents(weekStart: Date) {
  const t = useTranslations('calendar');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const requestRef = useRef(0);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    const requestId = ++requestRef.current;
    const { from, to } = getWeekRange(weekStart);
    let cancelled = false;

    setIsLoading(true);

    calendarService
      .getEvents({ from, to })
      .then((data) => {
        if (cancelled || requestRef.current !== requestId) return;
        setEvents(data);
      })
      .catch((error: unknown) => {
        if (cancelled || requestRef.current !== requestId) return;
        setEvents([]);
        showToast({
          title: t('failedToLoad'),
          description: error instanceof Error ? error.message : undefined,
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (cancelled || requestRef.current !== requestId) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [weekStart, reloadKey, t]);

  return { events, isLoading, reload };
}
