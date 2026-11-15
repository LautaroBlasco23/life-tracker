'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { noteService } from '@shared/services/note-service';
import { noteGroupService } from '@shared/services/note-group-service';
import type { Note, NoteGroup, UpdateNoteRequest } from '@shared/types/note';

/**
 * An empty client-side title means "keep the server title": the backend
 * requires one (min=1), the note shows as "Untitled", and the editor shows
 * a hint. Without this, an untitled note could never save (the PUT sends
 * both fields and 400s on the empty title).
 */
const titleDirty = (clientTitle: string, serverTitle: string) =>
  clientTitle.trim().length > 0 && clientTitle !== serverTitle;
import { Plus, Search, FileText, ArrowLeft, FolderPlus } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { DeleteModal } from '@/components/ui/card/delete-modal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslations } from '@shared/contexts/language-context';
import {
  NotesSidebar,
  sortGroups,
  sortSectionNotes,
} from '@/components/notes/notes-sidebar';
import { CreateGroupModal } from '@/components/notes/create-group-modal';

/* CodeMirror live-markdown editor — lazy-loaded so its bundle stays out of
 * the initial page load. `ssr: false` because CM needs a DOM. */
const LiveMarkdownEditor = dynamic(
  () =>
    import('@/components/notes/live-markdown-editor').then((m) => ({
      default: m.LiveMarkdownEditor,
    })),
  { ssr: false, loading: () => <div className="w-full h-full" /> }
);

const DRAFT_STORAGE_KEY = 'notes_drafts';

/** Idle time after the last keystroke before an autosave fires. */
const AUTOSAVE_DEBOUNCE_MS = 1500;

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

interface NoteDrafts {
  [noteId: number]: { title: string; content: string };
}

function getDrafts(): NoteDrafts {
  const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
  if (!stored) return {};

  try {
    return JSON.parse(stored) as NoteDrafts;
  } catch {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    return {};
  }
}

function setDrafts(drafts: NoteDrafts): void {
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
}

function saveDraft(noteId: number, title: string, content: string): void {
  const drafts = getDrafts();
  drafts[noteId] = { title, content };
  setDrafts(drafts);
}

function removeDraft(noteId: number): void {
  const drafts = getDrafts();
  delete drafts[noteId];
  setDrafts(drafts);
}

function loadDraft(noteId: number): { title: string; content: string } | null {
  const drafts = getDrafts();
  return drafts[noteId] ?? null;
}

export function NotesView() {
  const t = useTranslations('notes');
  const tCommon = useTranslations('common');

  const [notes, setNotesState] = useState<Note[]>([]);
  const [groups, setGroupsState] = useState<NoteGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [deleteGroupModalOpen, setDeleteGroupModalOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<NoteGroup | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  // Latest values (used to snapshot state for optimistic-revert on failed requests).
  const notesRef = useRef<Note[]>([]);
  const groupsRef = useRef<NoteGroup[]>([]);
  const initializedRef = useRef(false);
  // Autosave: latest values as refs so timers/flushes see current data.
  const selectedNoteRef = useRef<Note | null>(null);
  const editValuesRef = useRef({ title: '', content: '' });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  const setNotes = useCallback((value: Note[] | ((prev: Note[]) => Note[])) => {
    setNotesState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      notesRef.current = next;
      return next;
    });
  }, []);

  const setGroups = useCallback(
    (value: NoteGroup[] | ((prev: NoteGroup[]) => NoteGroup[])) => {
      setGroupsState((prev) => {
        const next = typeof value === 'function' ? value(prev) : value;
        groupsRef.current = next;
        return next;
      });
    },
    []
  );

  const loadNotes = useCallback(
    async (query?: string) => {
      try {
        setIsLoading(true);
        if (query) {
          const userNotes = await noteService.searchNotes(query);
          setNotes(userNotes);
          return userNotes;
        }
        const [userNotes, userGroups] = await Promise.all([
          noteService.getNotes(),
          noteGroupService.getNoteGroups(),
        ]);
        setNotes(userNotes);
        setGroups(userGroups);
        return userNotes;
      } catch (error) {
        console.error('Failed to load notes:', error);
        showToast({
          title: t('failedToLoad'),
          description:
            error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        });
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [setNotes, setGroups]
  );

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initialize = async () => {
      await loadNotes();
    };

    initialize();
  }, [loadNotes]);

  useEffect(() => {
    if (!initializedRef.current) return;

    loadNotes(searchQuery);
  }, [searchQuery, loadNotes]);

  /* ---------- Autosave ----------
   * Notes save themselves: debounced PUT after typing stops, an immediate
   * flush on note switch / tab hide, and localStorage drafts as the offline
   * fallback. Never two concurrent PUTs for the same note (savingRef). */

  const cancelAutosave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const scheduleAutosave = useCallback(
    (delay: number = AUTOSAVE_DEBOUNCE_MS) => {
      cancelAutosave();
      saveTimerRef.current = setTimeout(() => void flushSave(), delay);
    },
    [cancelAutosave]
  );

  const flushSave = useCallback(async (): Promise<void> => {
    cancelAutosave();
    const note = selectedNoteRef.current;
    if (!note) return;
    const { title, content } = editValuesRef.current;
    const attempted = { title, content };
    const hasTitle = title.trim().length > 0;
    // Empty title = "keep the server title": the backend rejects empty
    // titles, so send content only and let the hint nudge the user.
    const payload: UpdateNoteRequest = hasTitle
      ? { title, content }
      : { content };
    if (!titleDirty(title, note.title) && content === note.content) return;

    if (savingRef.current) {
      scheduleAutosave(500);
      return;
    }
    savingRef.current = true;
    setSaveStatus('saving');
    try {
      const updatedNote = await noteService.updateNote(note.id, payload);
      setSelectedNote((prev) =>
        prev && prev.id === updatedNote.id ? updatedNote : prev
      );
      setNotes((prev) =>
        prev.map((n) => (n.id === updatedNote.id ? updatedNote : n))
      );
      removeDraft(updatedNote.id);
      setSaveStatus('saved');
    } catch (error) {
      // The draft (written on every keystroke) is the offline fallback.
      // No automatic retry: the next keystroke or flush trigger retries;
      // auto-retrying here would loop forever on permanent failures
      // (validation caps, expired sessions). The indicator stays truthful.
      console.error('Autosave failed:', error);
      setSaveStatus('error');
    } finally {
      savingRef.current = false;
    }
    // Edits made while the PUT was in flight need another pass. Compare
    // against what was just attempted — NOT the note state: a failed PUT
    // leaves it stale (pre-save values), which always differs from the
    // edit values and used to arm an endless self-rescheduling loop.
    const latestValues = editValuesRef.current;
    if (
      latestValues.title !== attempted.title ||
      latestValues.content !== attempted.content
    ) {
      scheduleAutosave(300);
    }
  }, [cancelAutosave, scheduleAutosave, setNotes]);

  // Keep the refs the timers read in sync with the latest state.
  useEffect(() => {
    selectedNoteRef.current = selectedNote;
    editValuesRef.current = { title: editTitle, content: editContent };
  }, [selectedNote, editTitle, editContent]);

  // Debounced autosave on every edit.
  useEffect(() => {
    if (!selectedNote) return;
    const dirty =
      titleDirty(editTitle, selectedNote.title) ||
      editContent !== selectedNote.content;
    if (!dirty) return;
    saveDraft(selectedNote.id, editTitle, editContent);
    setSaveStatus('unsaved');
    scheduleAutosave();
  }, [editTitle, editContent, selectedNote, scheduleAutosave]);

  // Flush when the tab is hidden or closed (draft covers what slips through).
  useEffect(() => {
    const flush = () => void flushSave();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', flush);
      cancelAutosave();
    };
  }, [flushSave, cancelAutosave]);

  const handleSelectNote = (note: Note) => {
    void flushSave(); // persist the previously open note before switching
    cancelAutosave();
    const draft = loadDraft(note.id);
    if (draft) {
      setEditTitle(draft.title);
      setEditContent(draft.content);
    } else {
      setEditTitle(note.title);
      setEditContent(note.content);
    }
    setSelectedNote(note);
    setSaveStatus('idle');
  };

  const handleBackToList = () => {
    void flushSave();
    cancelAutosave();
    setSelectedNote(null);
    setEditTitle('');
    setEditContent('');
    setSaveStatus('idle');
  };

  const handleCreateNote = async () => {
    void flushSave(); // persist any pending edits first
    cancelAutosave();
    try {
      const newNote = await noteService.createNote({
        title: t('untitled'),
        content: '',
      });
      setNotes((prev) => [newNote, ...prev]);
      setSelectedNote(newNote);
      setEditTitle(newNote.title);
      setEditContent(newNote.content);
      setSaveStatus('idle');
      showToast({
        title: t('noteCreated'),
        description: t('startWriting'),
      });
    } catch (error) {
      showToast({
        title: t('failedToCreate'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const openDeleteModal = (note: Note) => {
    setNoteToDelete(note);
    setDeleteModalOpen(true);
  };

  const handleDeleteNote = async () => {
    if (!noteToDelete) return;

    await noteService.deleteNote(noteToDelete.id);
    cancelAutosave();
    removeDraft(noteToDelete.id);
    setNotes((prev) => prev.filter((note) => note.id !== noteToDelete.id));
    if (selectedNote?.id === noteToDelete.id) {
      setSelectedNote(null);
      setEditTitle('');
      setEditContent('');
      setSaveStatus('idle');
    }
    showToast({
      title: t('noteDeleted'),
      description: t('noteDeletedDescription'),
    });
    setNoteToDelete(null);
  };

  const handleUpdateNotes = useCallback(
    async (nextNotes: Note[], sections: (number | null)[]) => {
      const snapshot = notesRef.current;
      setNotes(nextNotes);
      if (sections.length === 0) return;

      const describeSection = (source: Note[], groupId: number | null) =>
        JSON.stringify(
          sortSectionNotes(
            source.filter((note) => note.groupId === groupId)
          ).map((note) => [note.id, note.groupId, note.position])
        );

      const changed = sections.some(
        (groupId) =>
          describeSection(snapshot, groupId) !==
          describeSection(nextNotes, groupId)
      );
      if (!changed) return;

      const items = sections.flatMap((groupId) =>
        sortSectionNotes(
          nextNotes.filter((note) => note.groupId === groupId)
        ).map((note, position) => ({ id: note.id, groupId, position }))
      );

      try {
        await noteService.reorderNotes(items);
      } catch (error) {
        setNotes(snapshot);
        showToast({
          title: t('failedToSave'),
          description:
            error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        });
      }
    },
    [setNotes, t]
  );

  const handleUpdateGroups = useCallback(
    async (nextGroups: NoteGroup[]) => {
      const snapshot = groupsRef.current;
      setGroups(nextGroups);
      const describeOrder = (source: NoteGroup[]) =>
        JSON.stringify(sortGroups(source).map((group) => group.id));
      if (describeOrder(snapshot) === describeOrder(nextGroups)) return;

      try {
        await noteGroupService.reorderNoteGroups(
          sortGroups(nextGroups).map((group, position) => ({
            id: group.id,
            position,
          }))
        );
      } catch (error) {
        setGroups(snapshot);
        showToast({
          title: t('failedToSave'),
          description:
            error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        });
      }
    },
    [setGroups, t]
  );

  const handleRenameGroup = useCallback(
    async (groupId: number, name: string) => {
      const snapshot = groupsRef.current;
      setGroups((prev) =>
        prev.map((group) => (group.id === groupId ? { ...group, name } : group))
      );
      try {
        await noteGroupService.updateNoteGroup(groupId, { name });
      } catch (error) {
        setGroups(snapshot);
        showToast({
          title: t('failedToSave'),
          description:
            error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        });
      }
    },
    [setGroups, t]
  );

  const openDeleteGroupModal = (group: NoteGroup) => {
    setGroupToDelete(group);
    setDeleteGroupModalOpen(true);
  };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;

    try {
      setIsDeletingGroup(true);
      await noteGroupService.deleteNoteGroup(groupToDelete.id);
      setDeleteGroupModalOpen(false);
      const [userNotes, userGroups] = await Promise.all([
        searchQuery
          ? noteService.searchNotes(searchQuery)
          : noteService.getNotes(),
        noteGroupService.getNoteGroups(),
      ]);
      setNotes(userNotes);
      setGroups(userGroups);
      showToast({ title: t('groupDeleted') });
    } catch (error) {
      showToast({
        title: t('failedToDeleteGroup'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingGroup(false);
      setGroupToDelete(null);
    }
  };

  const handleGroupCreated = (group: NoteGroup) => {
    setCreateGroupOpen(false);
    // The backend places new groups first (position 0); shift existing ones down.
    setGroups((prev) => [
      group,
      ...prev.map((g) => ({ ...g, position: g.position + 1 })),
    ]);
  };

  const formatDate = (dateString: string): string => {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  return (
    <>
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row min-h-0">
        <aside
          className={cn(
            'flex flex-col bg-muted/30',
            'w-full md:w-80 md:border-r md:border-border',
            selectedNote ? 'hidden md:flex' : 'flex'
          )}
        >
          <div className="p-3 space-y-3 border-b border-border md:border-b-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => setCreateGroupOpen(true)}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              {t('addGroup')}
            </Button>
            <Button onClick={handleCreateNote} className="w-full" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t('newNote')}
            </Button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <NotesSidebar
              notes={notes}
              groups={groups}
              selectedNote={selectedNote}
              searchQuery={searchQuery}
              isLoading={isLoading}
              onSelectNote={handleSelectNote}
              onDeleteNote={openDeleteModal}
              onUpdateNotes={handleUpdateNotes}
              onUpdateGroups={handleUpdateGroups}
              onRenameGroup={handleRenameGroup}
              onOpenDeleteGroup={openDeleteGroupModal}
            />
          </div>
        </aside>

        <main
          className={cn(
            'flex-1 flex flex-col min-h-0',
            selectedNote ? 'flex' : 'hidden md:flex'
          )}
        >
          {selectedNote ? (
            <>
              <div className="p-4 border-b border-border flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToList}
                  className="md:hidden"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  {t('back')}
                </Button>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={t('titlePlaceholder')}
                  aria-label={t('titlePlaceholder')}
                  className={cn(
                    // Document-title presentation, not a form field: the
                    // shadcn Input defaults (dark:bg-input/30, border,
                    // focus ring) read as a boxed input in dark mode and
                    // can't be cleanly overridden through cn().
                    'min-w-0 flex-1 bg-transparent text-3xl font-semibold',
                    'text-foreground placeholder:text-muted-foreground/70',
                    'border-none shadow-none outline-none',
                    // focus:shadow-none beats the global input focus ring
                    // in globals.css (non-important component rule).
                    'focus:shadow-none',
                    // Quiet affordance: soft pill on hover/focus; the
                    // negative margin keeps the text flush with the edge.
                    'rounded-md px-2 py-0.5 -mx-2 h-auto',
                    'transition-colors hover:bg-muted/50 focus:bg-muted/50'
                  )}
                />
                <span
                  className="text-xs text-muted-foreground"
                  aria-live="polite"
                >
                  {saveStatus === 'saving' && t('saving')}
                  {(saveStatus === 'unsaved' || saveStatus === 'error') &&
                    t('unsavedChanges')}
                </span>
                {!editTitle.trim() && (
                  <span className="text-xs text-warning" aria-live="polite">
                    {t('titleRequired')}
                  </span>
                )}
              </div>
              <div className="flex-1 min-h-0 p-4">
                <LiveMarkdownEditor
                  value={editContent}
                  onChange={setEditContent}
                  placeholder={t('contentPlaceholder')}
                  ariaLabel={t('contentPlaceholder')}
                  uploadImage={(file) => noteService.uploadImage(file)}
                  imageUploadingAlt={t('imageUploadingAlt')}
                  imageAlt={t('imageAlt')}
                  imageUploadFailedLabel={t('imageUploadFailed')}
                  className="w-full h-full"
                />
              </div>
              <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
                {t('lastEdited', {
                  date: formatDate(selectedNote.editedAt),
                })}
                {(saveStatus === 'unsaved' || saveStatus === 'error') && (
                  <span className="ml-2 text-secondary">
                    {'• ' + t('unsavedChanges')}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">{t('selectNote')}</p>
                <p className="text-sm mt-1">{t('selectNoteDescription')}</p>
              </div>
            </div>
          )}
        </main>
      </div>

      <DeleteModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title={t('deleteNote')}
        itemName={noteToDelete?.title || t('untitled')}
        onConfirm={handleDeleteNote}
        confirmLabel={t('deleteNote')}
        itemDetails={
          noteToDelete && (
            <div className="text-sm">
              <div className="font-medium text-foreground mb-1">
                {noteToDelete.title || t('untitled')}
              </div>
              <div className="text-muted-foreground text-xs">
                {noteToDelete.content && (
                  <div className="mb-1 line-clamp-2">
                    {noteToDelete.content}
                  </div>
                )}
                <div>
                  {t('lastEdited', { date: formatDate(noteToDelete.editedAt) })}
                </div>
              </div>
            </div>
          )
        }
      />

      <CreateGroupModal
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
        onGroupCreated={handleGroupCreated}
      />

      <Dialog
        open={deleteGroupModalOpen}
        onOpenChange={setDeleteGroupModalOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('deleteGroupConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteGroupConfirmMessage')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteGroupModalOpen(false)}
              disabled={isDeletingGroup}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteGroup}
              disabled={isDeletingGroup}
            >
              {isDeletingGroup ? tCommon('deleting') : t('deleteGroup')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
