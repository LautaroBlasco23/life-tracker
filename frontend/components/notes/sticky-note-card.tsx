'use client';

import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@shared/contexts/language-context';
import type { StickyNote } from '@shared/types/sticky-note';

interface StickyNoteCardProps {
  /** Omitted for the local "new note" draft card. */
  note?: StickyNote;
  autoEdit?: boolean;
  onSave: (data: {
    title: string;
    description: string;
  }) => void | Promise<void>;
  /** Removes the note — the cross in the top-right corner. */
  onDelete?: () => void;
  /** Discards the draft card (no note yet). */
  onCancel?: () => void;
}

/**
 * A single sticky note. Click the body to edit; the cross in the top-right
 * corner removes it once its idea is done. The draft variant (no `note`)
 * starts in edit mode.
 */
export function StickyNoteCard({
  note,
  autoEdit = false,
  onSave,
  onDelete,
  onCancel,
}: StickyNoteCardProps) {
  const t = useTranslations('stickyNotes');
  const tCommon = useTranslations('common');
  const [isEditing, setIsEditing] = useState(autoEdit);
  const [title, setTitle] = useState(note?.title ?? '');
  const [description, setDescription] = useState(note?.description ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const hasContent = Boolean(note && (note.title || note.description));

  const startEditing = () => {
    if (!note) return;
    setTitle(note.title);
    setDescription(note.description);
    setIsEditing(true);
  };

  const cancel = () => {
    if (!note) {
      onCancel?.();
      return;
    }
    setTitle(note.title);
    setDescription(note.description);
    setIsEditing(false);
  };

  const save = async () => {
    const nextTitle = title.trim();
    const nextDescription = description.trim();
    // Both empty: nothing worth persisting, so treat the action as a cancel.
    if (!nextTitle && !nextDescription) {
      cancel();
      return;
    }
    try {
      setIsSaving(true);
      await onSave({ title: nextTitle, description: nextDescription });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      save();
    }
  };

  return (
    <div className="relative isolate flex min-h-[9rem] flex-col rounded-xl border border-border bg-sticky p-4 shadow-sm">
      {note && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('delete')}
          title={t('delete')}
          className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/60 hover:text-destructive after:absolute after:-inset-1.5 after:content-['']"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {isEditing ? (
        <div className="flex h-full flex-col gap-2">
          <Input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('titlePlaceholder')}
            maxLength={255}
            className="border-none bg-transparent px-0 pr-10 font-semibold shadow-none focus-visible:ring-0"
          />
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('descriptionPlaceholder')}
            maxLength={10000}
            className="flex-1 resize-none border-none bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={cancel}
              disabled={isSaving}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="button" size="sm" onClick={save} disabled={isSaving}>
              {t('save')}
            </Button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={startEditing}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              startEditing();
            }
          }}
          className="flex-1 cursor-pointer focus-visible:outline-none"
        >
          {note?.title && (
            <p className="break-anywhere pr-10 font-semibold text-foreground">
              {note.title}
            </p>
          )}
          {note?.description && (
            <p className="mt-1 whitespace-pre-wrap break-anywhere text-sm text-muted-foreground">
              {note.description}
            </p>
          )}
          {!hasContent && (
            <p className="text-sm italic text-muted-foreground">
              {t('descriptionPlaceholder')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
