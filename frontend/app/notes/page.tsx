'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import { useTranslations } from '@shared/contexts/language-context';
import { NotesView } from './views/notesView';
import { StickyNotesView } from './views/stickyNotesView';

type NotesPageView = 'notes' | 'sticky';

export default function NotesPage() {
  const t = useTranslations('notes');

  const [view, setView] = useState<NotesPageView>('notes');
  // Sub-sections mount lazily the first time they are visited and stay mounted
  // (hidden) afterwards, so unsaved drafts and loaded data survive tab switches.
  const [visited, setVisited] = useState<Record<NotesPageView, boolean>>({
    notes: true,
    sticky: false,
  });

  const handleViewChange = (next: string) => {
    const nextView = next as NotesPageView;
    setView(nextView);
    setVisited((prev) =>
      prev[nextView] ? prev : { ...prev, [nextView]: true }
    );
  };

  return (
    <div className="h-[calc(100vh-4rem)] lg:h-screen flex flex-col">
      <PageHeader title={t('title')} description={t('description')}>
        <Tabs value={view} onValueChange={handleViewChange}>
          <TabsList>
            <TabsTrigger value="notes">{t('tabNotes')}</TabsTrigger>
            <TabsTrigger value="sticky">{t('tabSticky')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      <div className="flex-1 min-h-0 flex flex-col">
        {visited.notes && (
          <div
            className={cn(
              'flex-1 min-h-0 flex flex-col',
              view === 'notes' ? undefined : 'hidden'
            )}
          >
            <NotesView />
          </div>
        )}

        {visited.sticky && (
          <div
            className={cn(
              'flex-1 min-h-0',
              view === 'sticky' ? 'overflow-y-auto' : 'hidden'
            )}
          >
            <StickyNotesView />
          </div>
        )}
      </div>
    </div>
  );
}
