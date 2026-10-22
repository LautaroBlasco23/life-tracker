import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ChevronDown,
  ChevronUp,
  FolderPlus,
  GripVertical,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react-native';
import DragList, {
  ScaleDecorator,
  type DragEndParams,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import Markdown from 'react-native-markdown-display';
import { useFocusEffect } from 'expo-router';
import { noteGroupService, noteService, storage, useTranslations } from '@shared';
import type {
  Note,
  NoteGroup,
  ReorderNoteGroupsRequestItem,
  ReorderNotesRequestItem,
} from '@shared/types/note';
import { Button } from '../../components/ui/button';
import { DeleteModal } from '../../components/ui/delete-modal';
import { FormField } from '../../components/ui/form-field';
import { showToast } from '../../components/ui/toast';
import { useColors } from '../../lib/use-colors';
import { Navigation } from '../../components/navigation';

const DRAFT_STORAGE_KEY = 'notes_drafts';

interface NoteDrafts {
  [noteId: number]: { title: string; content: string };
}

// Flattened rows rendered by the draggable list: ungrouped notes first, then
// one group header row per group (position order) followed by that group's
// notes (hidden while the group is collapsed).
type NoteRow = { type: 'note'; note: Note; indented: boolean };
type GroupRow = { type: 'group'; group: NoteGroup; noteCount: number };
type ListRow = NoteRow | GroupRow;

// Same draft semantics as web's notes page: unsaved edits are persisted per
// note through the shared storage adapter and restored on reopen.
function getDrafts(): NoteDrafts {
  const stored = storage.getItem(DRAFT_STORAGE_KEY);
  if (!stored) return {};
  try {
    return JSON.parse(stored) as NoteDrafts;
  } catch {
    storage.removeItem(DRAFT_STORAGE_KEY);
    return {};
  }
}

function saveDraft(noteId: number, title: string, content: string): void {
  const drafts = getDrafts();
  drafts[noteId] = { title, content };
  storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
}

function removeDraft(noteId: number): void {
  const drafts = getDrafts();
  delete drafts[noteId];
  storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
}

function loadDraft(noteId: number): { title: string; content: string } | null {
  return getDrafts()[noteId] ?? null;
}

function formatEditedAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotesScreen() {
  const t = useTranslations('notes');
  const tCommon = useTranslations('common');
  const colors = useColors();

  const [notes, setNotes] = useState<Note[]>([]);
  const [groups, setGroups] = useState<NoteGroup[]>([]);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [menuGroupId, setMenuGroupId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  // Group form (create/rename) + delete confirmation state.
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [renamingGroup, setRenamingGroup] = useState<NoteGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [isGroupSaving, setIsGroupSaving] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<NoteGroup | null>(null);

  // Latest state snapshots so persistence handlers can revert on failure.
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  const loadNotes = useCallback(async (q?: string) => {
    try {
      setIsLoading(true);
      const data = q ? await noteService.searchNotes(q) : await noteService.getNotes();
      setNotes(data);
    } catch (error) {
      showToast({
        title: t('failedToLoad'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const loadGroups = useCallback(async () => {
    try {
      setGroups(await noteGroupService.getNoteGroups());
    } catch (error) {
      showToast({
        title: t('failedToLoad'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      loadNotes();
      loadGroups();
    }, [loadNotes, loadGroups])
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadNotes(query.trim() || undefined);
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [query, loadNotes]);

  // Persist the draft while the editor has unsaved changes (web parity).
  useEffect(() => {
    if (!editing || !showForm) return;
    const titleChanged = title !== editing.title;
    const contentChanged = content !== editing.content;
    const unsaved = titleChanged || contentChanged;
    setHasUnsavedChanges(unsaved);
    if (unsaved) {
      saveDraft(editing.id, title, content);
    } else {
      removeDraft(editing.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, editing, showForm]);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setContent('');
    setHasUnsavedChanges(false);
    setShowPreview(false);
    setShowForm(true);
  };

  const openEdit = (note: Note) => {
    const draft = loadDraft(note.id);
    setEditing(note);
    if (draft) {
      setTitle(draft.title);
      setContent(draft.content);
      setHasUnsavedChanges(draft.title !== note.title || draft.content !== note.content);
      showToast({
        title: t('draftRestored'),
        description: t('draftRestoredDescription'),
      });
    } else {
      setTitle(note.title);
      setContent(note.content);
      setHasUnsavedChanges(false);
    }
    setShowPreview(false);
    setShowForm(true);
  };

  const handleDiscard = () => {
    if (!editing) return;
    removeDraft(editing.id);
    setTitle(editing.title);
    setContent(editing.content);
    setHasUnsavedChanges(false);
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      let saved: Note;
      if (editing) {
        saved = await noteService.updateNote(editing.id, { title, content });
      } else {
        saved = await noteService.createNote({ title, content });
      }
      setNotes((prev) => {
        const exists = prev.some((n) => n.id === saved.id);
        return exists ? prev.map((n) => (n.id === saved.id ? saved : n)) : [saved, ...prev];
      });
      if (editing) removeDraft(editing.id);
      setEditing(null);
      setShowForm(false);
      showToast({
        title: editing ? t('noteSaved') : t('noteCreated'),
        description: editing ? t('noteSavedDescription') : t('startWriting'),
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

  const handleDeleteNote = async () => {
    if (!noteToDelete) return;
    const note = noteToDelete;
    try {
      await noteService.deleteNote(note.id);
      removeDraft(note.id);
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
      showToast({
        title: t('noteDeleted'),
        description: t('noteDeletedDescription'),
      });
    } catch (error) {
      showToast({
        title: tCommon('error'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
      throw error instanceof Error ? error : new Error('delete failed');
    }
  };

  // --- Groups -------------------------------------------------------------

  const openCreateGroup = () => {
    setRenamingGroup(null);
    setGroupName('');
    setShowGroupForm(true);
  };

  const openRenameGroup = (group: NoteGroup) => {
    setMenuGroupId(null);
    setRenamingGroup(group);
    setGroupName(group.name);
    setShowGroupForm(true);
  };

  const toggleCollapse = (groupId: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleGroupSubmit = async () => {
    const name = groupName.trim();
    if (!name) return;
    setIsGroupSaving(true);
    const group = renamingGroup;
    const prevGroups = groupsRef.current;
    try {
      if (group) {
        setGroups((gs) => gs.map((g) => (g.id === group.id ? { ...g, name } : g)));
        await noteGroupService.updateNoteGroup(group.id, { name });
      } else {
        const created = await noteGroupService.createNoteGroup({ name });
        setGroups((gs) => [created, ...gs]);
        showToast({ title: t('groupCreated') });
      }
      setShowGroupForm(false);
      setRenamingGroup(null);
      setGroupName('');
    } catch (error) {
      if (group) setGroups(prevGroups);
      showToast({
        title: group ? tCommon('error') : t('failedToCreateGroup'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsGroupSaving(false);
    }
  };

  // Deleting a group keeps its notes and moves them back to the ungrouped
  // section; both lists are refetched afterwards.
  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    const group = groupToDelete;
    const prevNotes = notesRef.current;
    const prevGroups = groupsRef.current;
    try {
      setNotes((ns) =>
        ns.map((n) => (n.groupId === group.id ? { ...n, groupId: null } : n))
      );
      setGroups((gs) => gs.filter((g) => g.id !== group.id));
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(group.id);
        return next;
      });
      await noteGroupService.deleteNoteGroup(group.id);
      setGroupToDelete(null);
      showToast({ title: t('groupDeleted') });
      await Promise.all([loadNotes(), loadGroups()]);
    } catch (error) {
      setNotes(prevNotes);
      setGroups(prevGroups);
      showToast({
        title: t('failedToDeleteGroup'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
      throw error instanceof Error ? error : new Error('delete failed');
    }
  };

  // --- Drag & drop --------------------------------------------------------

  const isSearching = query.trim().length > 0;

  // Rendering order mirrors the backend: groups position asc; within a
  // section, notes position asc then editedAt desc.
  const sortedNotes = useMemo(() => {
    return [...notes].sort(
      (a, b) => a.position - b.position || b.editedAt.localeCompare(a.editedAt)
    );
  }, [notes]);

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.position - b.position),
    [groups]
  );

  const rows = useMemo<ListRow[]>(() => {
    const q = query.trim().toLowerCase();
    const matches = (n: Note) =>
      !q ||
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q);
    const sectionNotes = (gid: number | null) =>
      sortedNotes.filter((n) => (n.groupId ?? null) === gid);

    const out: ListRow[] = [];

    // Ungrouped notes first; hidden while searching if nothing matches.
    const ungrouped = sectionNotes(null).filter(matches);
    if (!q || ungrouped.length > 0) {
      out.push(
        ...ungrouped.map((note) => ({
          type: 'note' as const,
          note,
          indented: false,
        }))
      );
    }

    for (const group of sortedGroups) {
      const all = sectionNotes(group.id);
      // While searching: groups with no matches are hidden and matching
      // groups are temporarily expanded.
      const visible = q ? all.filter(matches) : all;
      if (q && visible.length === 0) continue;
      out.push({ type: 'group', group, noteCount: visible.length });
      const expanded = q ? true : !collapsed.has(group.id);
      if (expanded) {
        out.push(
          ...visible.map((note) => ({
            type: 'note' as const,
            note,
            indented: true,
          }))
        );
      }
    }

    return out;
  }, [sortedNotes, sortedGroups, query, collapsed]);

  const handleDragEnd = useCallback(
    ({ data, from, to }: DragEndParams<ListRow>) => {
      const moved = data[to];
      if (from === to || !moved) return;
      setMenuGroupId(null);

      // The final flattened order defines membership: notes between two
      // group headers belong to the first header's group; notes before the
      // first header are ungrouped.
      let currentGroup: number | null = null;
      const membership = new Map<number, number | null>();
      const sectionOrder: { section: number | null; noteIds: number[] }[] = [
        { section: null, noteIds: [] },
      ];
      let currentSection = sectionOrder[0];
      for (const row of data) {
        if (row.type === 'group') {
          currentGroup = row.group.id;
          currentSection = { section: currentGroup, noteIds: [] };
          sectionOrder.push(currentSection);
        } else {
          currentSection.noteIds.push(row.note.id);
          membership.set(row.note.id, currentGroup);
        }
      }

      if (moved.type === 'group') {
        // Group reorder: reindex the full list 0..n-1.
        const groupRows = data.filter(
          (row): row is GroupRow => row.type === 'group'
        );
        const prevGroups = groupsRef.current;
        const prevOrder = [...prevGroups]
          .sort((a, b) => a.position - b.position)
          .map((g) => g.id)
          .join(',');
        const nextOrder = groupRows.map((r) => r.group.id).join(',');
        if (prevOrder === nextOrder) return;

        const nextGroups = groupRows.map((r, i) => ({
          ...groupsRef.current.find((g) => g.id === r.group.id)!,
          position: i,
        }));
        setGroups(nextGroups);

        const items: ReorderNoteGroupsRequestItem[] = nextGroups.map(
          (g, i) => ({ id: g.id, position: i })
        );
        noteGroupService.reorderNoteGroups(items).catch((error) => {
          setGroups(prevGroups);
          showToast({
            title: tCommon('error'),
            description:
              error instanceof Error ? error.message : 'An error occurred',
            variant: 'destructive',
          });
        });
        return;
      }

      // Note moved: possibly a reorder and/or a cross-group move.
      const prevNotes = notesRef.current;
      const draggedNote = prevNotes.find((n) => n.id === moved.note.id);
      if (!draggedNote) return;
      const oldGroup = draggedNote.groupId ?? null;
      const newGroup = membership.get(draggedNote.id) ?? null;

      // Stored per-section note order (position asc, editedAt desc).
      const prevSections = new Map<number | null, Note[]>();
      for (const n of prevNotes) {
        const key = n.groupId ?? null;
        const arr = prevSections.get(key);
        if (arr) arr.push(n);
        else prevSections.set(key, [n]);
      }
      for (const [, arr] of prevSections) {
        arr.sort(
          (a, b) =>
            a.position - b.position || b.editedAt.localeCompare(a.editedAt)
        );
      }

      // Rebuild the destination section: untouched notes keep their stored
      // order; the dragged note is anchored between its visible neighbours.
      const destSiblings =
        sectionOrder.find((s) => s.section === newGroup)?.noteIds ?? [];
      const others = (prevSections.get(newGroup) ?? []).filter(
        (n) => n.id !== draggedNote.id
      );
      const at = destSiblings.indexOf(draggedNote.id);
      let destOrder: Note[];
      const prevSiblingId = at > 0 ? destSiblings[at - 1] : null;
      const prevSiblingIdx =
        prevSiblingId != null
          ? others.findIndex((n) => n.id === prevSiblingId)
          : -1;
      const nextSiblingIdx =
        at + 1 < destSiblings.length
          ? others.findIndex((n) => n.id === destSiblings[at + 1])
          : -1;
      if (prevSiblingIdx >= 0) {
        destOrder = [
          ...others.slice(0, prevSiblingIdx + 1),
          draggedNote,
          ...others.slice(prevSiblingIdx + 1),
        ];
      } else if (nextSiblingIdx >= 0) {
        destOrder = [
          ...others.slice(0, nextSiblingIdx),
          draggedNote,
          ...others.slice(nextSiblingIdx),
        ];
      } else {
        // No visible sibling in the section (e.g. dropped right after a
        // collapsed group header): becomes the first note of the group.
        destOrder = [draggedNote, ...others];
      }

      const changedSections: { section: number | null; order: Note[] }[] = [
        { section: newGroup, order: destOrder },
      ];
      if (oldGroup !== newGroup) {
        changedSections.push({
          section: oldGroup,
          order: (prevSections.get(oldGroup) ?? []).filter(
            (n) => n.id !== draggedNote.id
          ),
        });
      }

      // Reindex only the touched sections (0..n-1) and persist them.
      const updates = new Map<
        number,
        { groupId: number | null; position: number }
      >();
      for (const { section, order } of changedSections) {
        order.forEach((n, i) => {
          if (n.groupId !== section || n.position !== i) {
            updates.set(n.id, { groupId: section, position: i });
          }
        });
      }
      if (updates.size === 0) return;

      const items: ReorderNotesRequestItem[] = [];
      for (const { section, order } of changedSections) {
        order.forEach((n, i) =>
          items.push({ id: n.id, groupId: section, position: i })
        );
      }

      setNotes((prev) =>
        prev.map((n) => {
          const update = updates.get(n.id);
          return update ? { ...n, ...update } : n;
        })
      );

      noteService.reorderNotes(items).catch((error) => {
        setNotes(prevNotes);
        showToast({
          title: tCommon('error'),
          description:
            error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        });
      });
    },
    [tCommon]
  );

  // --- Render -------------------------------------------------------------

  const renderNoteCard = (note: Note, indented: boolean, drag: () => void) => {
    const hasDraft = getDrafts()[note.id] !== undefined;
    const margins = indented ? 'ml-8 mr-4' : 'mx-4';
    return (
      <Pressable
        onPress={() => openEdit(note)}
        onLongPress={() => setNoteToDelete(note)}
        className={`${margins} mb-1.5 rounded-xl border border-border dark:border-dark-border p-3 bg-surface dark:bg-dark-surface`}
      >
        <View className="flex-row items-center">
          {!isSearching ? (
            <Pressable
              onLongPress={drag}
              delayLongPress={200}
              hitSlop={8}
              className="-ml-1 py-1 pr-2"
            >
              <GripVertical size={14} color={colors.textMuted} />
            </Pressable>
          ) : null}
          <Text
            numberOfLines={1}
            className="flex-1 text-sm font-medium text-foreground dark:text-dark-foreground mr-2"
          >
            {note.title || t('untitled')}
          </Text>
          {hasDraft ? (
            <Text className="text-xs text-warning dark:text-dark-warning mr-1">
              •
            </Text>
          ) : null}
          <Pressable
            onPress={() => setNoteToDelete(note)}
            hitSlop={8}
            className="p-1"
          >
            <Trash2 size={15} color={colors.textMuted} />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  const renderGroupHeader = (row: GroupRow, drag: () => void) => {
    const group = row.group;
    const expanded = isSearching ? true : !collapsed.has(group.id);
    const menuOpen = menuGroupId === group.id;
    return (
      <View className="mx-4 mb-2">
        <Pressable
          onPress={() => {
            if (menuOpen) setMenuGroupId(null);
            else toggleCollapse(group.id);
          }}
          className="flex-row items-center rounded-xl border border-border dark:border-dark-border bg-muted/10 dark:bg-dark-surface px-2 py-2"
        >
          {!isSearching ? (
            <Pressable
              onLongPress={drag}
              delayLongPress={200}
              hitSlop={8}
              className="py-1 pr-2"
            >
              <GripVertical size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
          <Text
            numberOfLines={1}
            className="flex-1 text-sm font-semibold text-foreground dark:text-dark-foreground mr-2"
          >
            {group.name}
          </Text>
          <View className="mr-2 rounded-full bg-surface dark:bg-dark-border px-2 py-0.5">
            <Text className="text-[11px] font-medium text-muted dark:text-dark-muted">
              {row.noteCount}
            </Text>
          </View>
          {expanded ? (
            <ChevronUp size={16} color={colors.textMuted} />
          ) : (
            <ChevronDown size={16} color={colors.textMuted} />
          )}
          <Pressable
            onPress={() => setMenuGroupId(menuOpen ? null : group.id)}
            hitSlop={8}
            className="ml-2 p-1"
          >
            <MoreVertical size={16} color={colors.textMuted} />
          </Pressable>
        </Pressable>
        {menuOpen ? (
          <View className="mt-1 rounded-xl border border-border dark:border-dark-border bg-background dark:bg-dark-background overflow-hidden flex-row">
            <Pressable
              onPress={() => openRenameGroup(group)}
              className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5"
            >
              <Pencil size={14} color={colors.textMuted} />
              <Text className="text-sm text-foreground dark:text-dark-foreground">
                {t('rename')}
              </Text>
            </Pressable>
            <View className="w-px bg-border dark:bg-dark-border" />
            <Pressable
              onPress={() => {
                setMenuGroupId(null);
                setGroupToDelete(group);
              }}
              className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5"
            >
              <Trash2 size={14} color={colors.danger} />
              <Text className="text-sm text-danger dark:text-dark-danger">
                {t('deleteGroup')}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  const renderItem = useCallback(
    ({ item, drag }: RenderItemParams<ListRow>) => {
      if (item.type === 'group') {
        return (
          <ScaleDecorator>
            <View>{renderGroupHeader(item, drag)}</View>
          </ScaleDecorator>
        );
      }
      return (
        <ScaleDecorator>
          {renderNoteCard(item.note, item.indented, drag)}
        </ScaleDecorator>
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [menuGroupId, collapsed, isSearching, colors, t, notes]
  );

  const listHeader = (
    <View className="p-4">
      <Text className="text-2xl font-semibold text-foreground dark:text-dark-foreground">
        {t('title')}
      </Text>
      <Button variant="outline" className="mt-3" onPress={openCreateGroup}>
        <View className="flex-row items-center gap-2">
          <FolderPlus size={16} color={colors.primary} />
          <Text className="text-sm font-medium text-primary dark:text-dark-primary">
            {t('addGroup')}
          </Text>
        </View>
      </Button>
      <View className="mt-3 flex-row items-center rounded-lg border border-border dark:border-dark-border px-3">
        <Search size={16} color={colors.textMuted} />
        <TextInput
          className="flex-1 h-10 ml-2 text-foreground dark:text-dark-foreground"
          placeholder={t('search')}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
      </View>
      {notes.length === 0 && !isLoading ? (
        <View className="mt-8 items-center">
          <Text className="text-lg font-medium text-foreground dark:text-dark-foreground">
            {query ? t('noNotesFound') : t('noNotesYet')}
          </Text>
          <Text className="text-sm text-muted dark:text-dark-muted mt-2 text-center">
            {t('startWriting')}
          </Text>
          {!query ? (
            <Button className="mt-4" onPress={openCreate}>
              {t('newNote')}
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 relative bg-background dark:bg-dark-background">
      <Navigation />
      <DragList
        data={rows}
        keyExtractor={(row) =>
          row.type === 'note' ? `note-${row.note.id}` : `group-${row.group.id}`
        }
        renderItem={renderItem}
        onDragEnd={handleDragEnd}
        onDragBegin={() => setMenuGroupId(null)}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          isLoading ? (
            <View className="py-10 items-center">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : undefined
        }
        contentContainerClassName="pb-24"
      />

      <Pressable
        onPress={openCreate}
        className="absolute bottom-6 right-5 h-14 w-14 rounded-full bg-primary dark:bg-dark-primary items-center justify-center shadow-lg"
      >
        <Plus size={26} color={colors.primaryForeground} />
      </Pressable>

      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowForm(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 justify-end bg-black/50"
        >
          <View className="max-h-[90%] rounded-t-2xl bg-background dark:bg-dark-background p-5">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-semibold text-foreground dark:text-dark-foreground">
                {editing ? t('editNote') : t('newNote')}
              </Text>
              {editing && hasUnsavedChanges ? (
                <Pressable onPress={handleDiscard} hitSlop={6} className="p-1">
                  <Text className="text-sm text-warning dark:text-dark-warning">
                    {t('discard')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <View className="gap-4">
              <FormField
                label={t('titlePlaceholder')}
                placeholder={t('titlePlaceholder')}
                value={title}
                onChangeText={setTitle}
              />
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-foreground dark:text-dark-foreground">
                  {t('contentPlaceholder')}
                </Text>
                <Pressable
                  onPress={() => setShowPreview((s) => !s)}
                  className="p-1"
                >
                  <Text className="text-sm text-primary dark:text-dark-primary">
                    {showPreview ? t('edit') : t('preview')}
                  </Text>
                </Pressable>
              </View>
              {showPreview ? (
                <ScrollView
                  className="min-h-[160px] rounded-lg border border-border dark:border-dark-border p-3"
                  nestedScrollEnabled
                >
                  <Markdown
                    style={{
                      body: { color: colors.foreground },
                      heading1: { color: colors.foreground },
                      heading2: { color: colors.foreground },
                      heading3: { color: colors.foreground },
                      link: { color: colors.primary },
                      strong: { color: colors.foreground },
                      blockquote: {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                      code_inline: {
                        color: colors.foreground,
                        backgroundColor: colors.surface,
                      },
                      hr: { backgroundColor: colors.border },
                    }}
                  >
                    {content || ''}
                  </Markdown>
                </ScrollView>
              ) : (
                <TextInput
                  className="min-h-[160px] rounded-lg border border-border dark:border-dark-border p-3 text-foreground dark:text-dark-foreground"
                  placeholder={t('contentPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={content}
                  onChangeText={setContent}
                  multiline
                  textAlignVertical="top"
                />
              )}
              {editing ? (
                <Text className="text-xs text-muted dark:text-dark-muted">
                  {t('lastEdited', { date: formatEditedAt(editing.editedAt) })}
                  {hasUnsavedChanges ? ` • ${t('unsavedChanges')}` : ''}
                </Text>
              ) : null}
              <View className="flex-row gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onPress={() => setShowForm(false)}
                >
                  {tCommon('cancel')}
                </Button>
                <Button className="flex-1" onPress={handleSubmit} loading={isSaving}>
                  {t('save')}
                </Button>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showGroupForm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowGroupForm(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 justify-end bg-black/50"
        >
          <View className="rounded-t-2xl bg-background dark:bg-dark-background p-5">
            <Text className="text-xl font-semibold text-foreground dark:text-dark-foreground mb-4">
              {renamingGroup ? t('renameGroup') : t('createGroup')}
            </Text>
            <FormField
              label={t('groupName')}
              placeholder={t('groupName')}
              value={groupName}
              onChangeText={setGroupName}
              maxLength={100}
            />
            <View className="flex-row gap-3 mt-5">
              <Button
                variant="outline"
                className="flex-1"
                onPress={() => setShowGroupForm(false)}
                disabled={isGroupSaving}
              >
                {tCommon('cancel')}
              </Button>
              <Button
                className="flex-1"
                onPress={handleGroupSubmit}
                loading={isGroupSaving}
                disabled={!groupName.trim()}
              >
                {renamingGroup ? t('rename') : t('createGroup')}
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <DeleteModal
        visible={noteToDelete !== null}
        onClose={() => setNoteToDelete(null)}
        title={t('deleteNote')}
        itemName={noteToDelete?.title || t('untitled')}
        confirmLabel={t('deleteNote')}
        onConfirm={handleDeleteNote}
      />

      <DeleteModal
        visible={groupToDelete !== null}
        onClose={() => setGroupToDelete(null)}
        title={t('deleteGroupConfirmTitle')}
        itemName={groupToDelete?.name ?? ''}
        itemDetails={<Text className="text-sm text-muted dark:text-dark-muted">{t('deleteGroupConfirmMessage')}</Text>}
        confirmLabel={t('deleteGroup')}
        onConfirm={handleDeleteGroup}
      />
    </View>
  );
}
