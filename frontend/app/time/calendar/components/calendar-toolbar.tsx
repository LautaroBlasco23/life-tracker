'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useTranslations } from '@shared/contexts/language-context';
import { formatWeekLabel } from '../lib/week';

interface CalendarToolbarProps {
  weekStart: Date;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onNewEvent: () => void;
}

export function CalendarToolbar({
  weekStart,
  onPreviousWeek,
  onNextWeek,
  onToday,
  onNewEvent,
}: CalendarToolbarProps) {
  const t = useTranslations('calendar');

  return (
    <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label={t('previousWeek')}
          onClick={onPreviousWeek}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onToday}>
          {t('today')}
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={t('nextWeek')}
          onClick={onNextWeek}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="ml-1 text-sm font-medium text-foreground sm:text-base">
          {formatWeekLabel(weekStart)}
        </span>
      </div>

      <Button
        size="sm"
        onClick={onNewEvent}
        className="flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        {t('newEvent')}
      </Button>
    </div>
  );
}
