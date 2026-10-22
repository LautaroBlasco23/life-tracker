'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, StickyNote as StickyNoteIcon } from 'lucide-react';
import { StickyNoteCard } from '@/components/notes/sticky-note-card';
import { stickyNoteService } from '@shared/services/sticky-note-service';
import type { StickyNote } from '@shared/types/sticky-note';
import { useTranslations } from '@shared/contexts/language-context';
import { showToast } from '@/lib/toast';

type StickyNoteDraft = { title: string; description: string };

export function StickyNotesView() {
  const t = useTranslations('stickyNotes');
  const tCommon = useTranslations('common');

  const [notes, setNotesState] = useState<StickyNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  // Latest notes (snapshot for optimistic-revert on failed requests).
  const notesRef = useRef<StickyNote[]>([]);

  const setNotes = useCallback(
    (value: StickyNote[] | ((prev: StickyNote[]) => StickyNote[])) => {
      setNotesState((prev) => {
        const next = typeof value === 'function' ? value(prev) : value;
        notesRef.current = next;
        return next;
      });
    },
    []
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setIsLoading(true);
        const data = await stickyNoteService.getStickyNotes();
        if (active) setNotes(data);
      } catch (error) {
        showToast({
          title: t('failedToLoad'),
          description:
            error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        });
      } finally {
        if (active) setIsLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [setNotes, t]);

  const handleCreate = async (data: StickyNoteDraft) => {
    try {
      const created = await stickyNoteService.createStickyNote(data);
      setNotes((prev) => [created, ...prev]);
      setIsCreating(false);
    } catch (error) {
      showToast({
        title: t('failedToCreate'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleSave = async (id: number, data: StickyNoteDraft) => {
    try {
      const updated = await stickyNoteService.updateStickyNote(id, data);
      setNotes((prev) =>
        prev.map((note) => (note.id === updated.id ? updated : note))
      );
    } catch (error) {
      showToast({
        title: t('failedToUpdate'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleDelete = async (id: number) => {
    const snapshot = notesRef.current;
    setNotes((prev) => prev.filter((note) => note.id !== id));

    try {
      await stickyNoteService.deleteStickyNote(id);
      showToast({ title: t('deleted') });
    } catch (error) {
      setNotes(snapshot);
      showToast({
        title: t('failedToDelete'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const showEmptyState = !isLoading && notes.length === 0 && !isCreating;

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex justify-end">
        <Button
          onClick={() => setIsCreating(true)}
          disabled={isCreating}
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('newNote')}
        </Button>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {tCommon('loading')}
        </p>
      ) : showEmptyState ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <StickyNoteIcon className="mb-4 h-12 w-12 opacity-50" />
          <p className="text-lg font-medium">{t('empty')}</p>
          <p className="mt-1 text-sm">{t('emptyDescription')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isCreating && (
            <StickyNoteCard
              key="draft"
              autoEdit
              onSave={handleCreate}
              onCancel={() => setIsCreating(false)}
            />
          )}
          {notes.map((note) => (
            <StickyNoteCard
              key={note.id}
              note={note}
              onSave={(data) => handleSave(note.id, data)}
              onDelete={() => handleDelete(note.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
