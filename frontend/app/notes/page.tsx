'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/ui/page-header';
import { noteService } from '@shared/services/note-service';
import { noteGroupService } from '@shared/services/note-group-service';
import type { Note, NoteGroup } from '@shared/types/note';
import {
  Plus,
  Search,
  FileText,
  Trash2,
  ArrowLeft,
  Pencil,
  FolderPlus,
} from 'lucide-react';
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
import { MarkdownView } from '@/components/notes/markdown-view';
import { NoteToolbar } from '@/components/notes/note-toolbar';
import {
  NotesSidebar,
  sortGroups,
  sortSectionNotes,
} from '@/components/notes/notes-sidebar';
import { CreateGroupModal } from '@/components/notes/create-group-modal';

const DRAFT_STORAGE_KEY = 'notes_drafts';

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

export default function NotesPage() {
  const t = useTranslations('notes');
  const tCommon = useTranslations('common');

  const [notes, setNotesState] = useState<Note[]>([]);
  const [groups, setGroupsState] = useState<NoteGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [deleteGroupModalOpen, setDeleteGroupModalOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<NoteGroup | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  // Latest values (used to snapshot state for optimistic-revert on failed requests).
  const notesRef = useRef<Note[]>([]);
  const groupsRef = useRef<NoteGroup[]>([]);
  const initializedRef = useRef(false);

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

  useEffect(() => {
    if (selectedNote) {
      const titleChanged = editTitle !== selectedNote.title;
      const contentChanged = editContent !== selectedNote.content;
      const unsaved = titleChanged || contentChanged;
      setHasUnsavedChanges(unsaved);

      if (unsaved) {
        saveDraft(selectedNote.id, editTitle, editContent);
      } else {
        removeDraft(selectedNote.id);
      }
    }
  }, [editTitle, editContent, selectedNote]);

  const handleSelectNote = (note: Note) => {
    const draft = loadDraft(note.id);
    if (draft) {
      setEditTitle(draft.title);
      setEditContent(draft.content);
      setHasUnsavedChanges(
        draft.title !== note.title || draft.content !== note.content
      );
    } else {
      setEditTitle(note.title);
      setEditContent(note.content);
      setHasUnsavedChanges(false);
    }
    setSelectedNote(note);
    setIsEditing(false);
  };

  const handleBackToList = () => {
    setSelectedNote(null);
    setEditTitle('');
    setEditContent('');
    setHasUnsavedChanges(false);
    setIsEditing(false);
  };

  const handleCreateNote = async () => {
    try {
      const newNote = await noteService.createNote({
        title: t('untitled'),
        content: '',
      });
      setNotes((prev) => [newNote, ...prev]);
      setSelectedNote(newNote);
      setEditTitle(newNote.title);
      setEditContent(newNote.content);
      setHasUnsavedChanges(false);
      setIsEditing(true);
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

  const handleSaveNote = async () => {
    if (!selectedNote) return;

    try {
      setIsSaving(true);
      const updatedNote = await noteService.updateNote(selectedNote.id, {
        title: editTitle,
        content: editContent,
      });
      setSelectedNote(updatedNote);
      setNotes((prev) =>
        prev.map((note) => (note.id === updatedNote.id ? updatedNote : note))
      );
      setHasUnsavedChanges(false);
      setIsEditing(false);
      removeDraft(selectedNote.id);
      showToast({
        title: t('noteSaved'),
        description: t('noteSavedDescription'),
      });
    } catch (error) {
      showToast({
        title: t('failedToSave'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteModal = (note: Note) => {
    setNoteToDelete(note);
    setDeleteModalOpen(true);
  };

  const handleToggleMode = () => {
    setIsEditing(!isEditing);
  };

  const handleDiscard = () => {
    if (!selectedNote) return;
    removeDraft(selectedNote.id);
    setEditTitle(selectedNote.title);
    setEditContent(selectedNote.content);
    setHasUnsavedChanges(false);
  };

  const handleDeleteNote = async () => {
    if (!noteToDelete) return;

    await noteService.deleteNote(noteToDelete.id);
    removeDraft(noteToDelete.id);
    setNotes((prev) => prev.filter((note) => note.id !== noteToDelete.id));
    if (selectedNote?.id === noteToDelete.id) {
      setSelectedNote(null);
      setEditTitle('');
      setEditContent('');
      setHasUnsavedChanges(false);
      setIsEditing(false);
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
      <div className="h-[calc(100vh-4rem)] lg:h-screen flex flex-col">
        <PageHeader title={t('title')} description={t('description')} />

        <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
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
                onEditNote={(note) => {
                  handleSelectNote(note);
                  setIsEditing(true);
                }}
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
                  <Input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder={t('titlePlaceholder')}
                    className="flex-1 text-xl font-semibold border-none shadow-none focus-visible:ring-0 px-0 h-auto"
                  />
                  <NoteToolbar
                    isEditing={isEditing}
                    onToggleMode={handleToggleMode}
                    onSave={handleSaveNote}
                    onDiscard={handleDiscard}
                    canSave={hasUnsavedChanges}
                    isSaving={isSaving}
                  />
                </div>
                <div className="flex-1 min-h-0 p-4">
                  {isEditing ? (
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder={t('contentPlaceholder')}
                      className="w-full h-full resize-none border-none shadow-none focus-visible:ring-0 text-base leading-relaxed"
                    />
                  ) : (
                    <MarkdownView
                      content={editContent}
                      className="h-full overflow-y-auto"
                    />
                  )}
                </div>
                <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
                  {t('lastEdited', {
                    date: formatDate(selectedNote.editedAt),
                  })}
                  {hasUnsavedChanges && (
                    <span className="ml-2 text-amber-500">
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
