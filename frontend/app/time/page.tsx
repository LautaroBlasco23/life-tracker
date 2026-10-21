'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslations } from '@shared/contexts/language-context';
import { RecordsView } from './views/records-view';
import { CalendarView } from './views/calendar-view';

type TimeView = 'records' | 'calendar';

export default function TimePage() {
  const t = useTranslations('time');
  const tCalendar = useTranslations('calendar');

  const [view, setView] = useState<TimeView>('records');
  // Views mount lazily the first time they are visited and stay mounted
  // (hidden) afterwards, so list state, the selected week, and loaded data
  // survive tab switches.
  const [visited, setVisited] = useState<Record<TimeView, boolean>>({
    records: true,
    calendar: false,
  });

  const handleViewChange = (next: string) => {
    const nextView = next as TimeView;
    setView(nextView);
    setVisited((prev) =>
      prev[nextView] ? prev : { ...prev, [nextView]: true }
    );
  };

  return (
    <>
      <div className="flex flex-col gap-4 mb-8 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
          {t('title')}
        </h1>
        <Tabs value={view} onValueChange={handleViewChange}>
          <TabsList>
            <TabsTrigger value="records">{tCalendar('recordsTab')}</TabsTrigger>
            <TabsTrigger value="calendar">{tCalendar('tab')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {visited.records && (
        <div className={view === 'records' ? undefined : 'hidden'}>
          <RecordsView />
        </div>
      )}

      {visited.calendar && (
        <div className={view === 'calendar' ? undefined : 'hidden'}>
          <CalendarView />
        </div>
      )}
    </>
  );
}
