'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
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
      <PageHeader title={t('title')}>
        <Tabs value={view} onValueChange={handleViewChange}>
          <TabsList>
            <TabsTrigger value="records">{tCalendar('recordsTab')}</TabsTrigger>
            <TabsTrigger value="calendar">{tCalendar('tab')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      {visited.records && (
        <div
          className={
            view === 'records' ? 'max-w-4xl mx-auto p-4 md:p-6' : 'hidden'
          }
        >
          <RecordsView />
        </div>
      )}

      {visited.calendar && (
        <div
          className={
            view === 'calendar' ? 'max-w-4xl mx-auto p-4 md:p-6' : 'hidden'
          }
        >
          <CalendarView />
        </div>
      )}
    </>
  );
}
