'use client';

import { useMemo, useRef, useState } from 'react';
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { Note, NoteGroup } from '@shared/types/note';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslations } from '@shared/contexts/language-context';

const UNGROUPED_CONTAINER_ID = 'ungrouped';

const noteSortableId = (noteId: number): string => `note-${noteId}`;
const groupSortableId = (groupId: number): string => `group-${groupId}`;
const containerSortableId = (groupId: number | null): string =>
  groupId === null ? UNGROUPED_CONTAINER_ID : `group-container-${groupId}`;

interface DraggableData {
  type: 'note' | 'group-header' | 'container';
  groupId: number | null;
}

interface DropTarget {
  groupId: number | null;
  type: 'note' | 'group-header' | 'container';
  overNoteId: number | null;
}

interface NotesSidebarProps {
  notes: Note[];
  groups: NoteGroup[];
  selectedNote: Note | null;
  searchQuery: string;
  isLoading: boolean;
  onSelectNote: (note: Note) => void;
  onEditNote: (note: Note) => void;
  onDeleteNote: (note: Note) => void;
  /** Applies optimistic note updates; sections are the ones to persist (groupId or null = ungrouped). */
  onUpdateNotes: (
    nextNotes: Note[],
    persistSections: (number | null)[]
  ) => void;
  onUpdateGroups: (nextGroups: NoteGroup[]) => void;
  onRenameGroup: (groupId: number, name: string) => void;
  onOpenDeleteGroup: (group: NoteGroup) => void;
}

export function sortSectionNotes(notes: Note[]): Note[] {
  return [...notes].sort(
    (a, b) =>
      a.position - b.position ||
      new Date(b.editedAt).getTime() - new Date(a.editedAt).getTime()
  );
}

export function sortGroups(groups: NoteGroup[]): NoteGroup[] {
  return [...groups].sort((a, b) => a.position - b.position);
}

/** Removes the note from its section, inserts it into the target section at
 * `targetIndex` (-1 = append) and reindexes positions of the affected sections. */
function computeNotesMove(
  notes: Note[],
  movedNoteId: number,
  targetGroupId: number | null,
  targetIndex: number
): Note[] {
  const moving = notes.find((note) => note.id === movedNoteId);
  if (!moving) return notes;

  const sourceGroupId = moving.groupId;
  const listWithout = (groupId: number | null) =>
    notes.filter((note) => note.groupId === groupId && note.id !== movedNoteId);

  const targetList = listWithout(targetGroupId);
  const insertAt =
    targetIndex < 0
      ? targetList.length
      : Math.min(targetIndex, targetList.length);
  targetList.splice(insertAt, 0, { ...moving, groupId: targetGroupId });

  const affected: { groupId: number | null; list: Note[] }[] =
    sourceGroupId === targetGroupId
      ? [{ groupId: targetGroupId, list: targetList }]
      : [
          { groupId: targetGroupId, list: targetList },
          { groupId: sourceGroupId, list: listWithout(sourceGroupId) },
        ];

  const positionById = new Map<number, number>();
  const groupIdById = new Map<number, number | null>();
  affected.forEach(({ groupId, list }) => {
    list.forEach((note, position) => {
      positionById.set(note.id, position);
      groupIdById.set(note.id, groupId);
    });
  });

  return notes.map((note) =>
    positionById.has(note.id)
      ? {
          ...note,
          groupId: groupIdById.get(note.id) ?? note.groupId,
          position: positionById.get(note.id) ?? note.position,
        }
      : note
  );
}

/** Display index (position-asc then editedAt-desc) of a note inside its
 * section's current list, including the note itself. */
function sectionIndexOf(
  notes: Note[],
  groupId: number | null,
  noteId: number
): number {
  const list = sortSectionNotes(notes.filter((n) => n.groupId === groupId));
  return list.findIndex((note) => note.id === noteId);
}

function resolveDropTarget(
  over: NonNullable<DragEndEvent['over']>
): DropTarget | null {
  const data = over.data.current as DraggableData | undefined;
  if (!data) return null;
  const overId = String(over.id);
  const overNoteId = overId.startsWith('note-')
    ? Number(overId.slice('note-'.length))
    : null;
  return { groupId: data.groupId, type: data.type, overNoteId };
}

export function NotesSidebar({
  notes,
  groups,
  selectedNote,
  searchQuery,
  isLoading,
  onSelectNote,
  onEditNote,
  onDeleteNote,
  onUpdateNotes,
  onUpdateGroups,
  onRenameGroup,
  onOpenDeleteGroup,
}: NotesSidebarProps) {
  const t = useTranslations('notes');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(
    new Set()
  );
  const [renamingGroupId, setRenamingGroupId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const cancelRenameRef = useRef(false);
  const touchedSectionsRef = useRef<Set<number | null>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const searching = searchQuery.trim().length > 0;

  const groupIdSet = useMemo(
    () => new Set(groups.map((group) => group.id)),
    [groups]
  );

  const ungroupedNotes = useMemo(
    () =>
      sortSectionNotes(
        notes.filter(
          (note) => note.groupId === null || !groupIdSet.has(note.groupId)
        )
      ),
    [notes, groupIdSet]
  );

  const sortedGroups = useMemo(() => sortGroups(groups), [groups]);

  const groupSections = useMemo(
    () =>
      sortedGroups.map((group) => ({
        group,
        notes: sortSectionNotes(
          notes.filter((note) => note.groupId === group.id)
        ),
      })),
    [sortedGroups, notes]
  );

  const visibleGroupSections = useMemo(
    () =>
      searching
        ? groupSections.filter((section) => section.notes.length > 0)
        : groupSections,
    [groupSections, searching]
  );

  const expandGroup = (groupId: number) =>
    setCollapsedGroups((prev) => {
      if (!prev.has(groupId)) return prev;
      const next = new Set(prev);
      next.delete(groupId);
      return next;
    });

  const toggleGroup = (groupId: number) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });

  const startRename = (group: NoteGroup) => {
    cancelRenameRef.current = false;
    setRenamingGroupId(group.id);
    setRenameValue(group.name);
  };

  const commitRename = (group: NoteGroup) => {
    setRenamingGroupId(null);
    if (cancelRenameRef.current) return;
    const name = renameValue.trim();
    if (name && name !== group.name) onRenameGroup(group.id, name);
  };

  const cancelRename = () => {
    cancelRenameRef.current = true;
    setRenamingGroupId(null);
  };

  const applyMove = (noteId: number, target: DropTarget) => {
    const index =
      target.overNoteId !== null
        ? sectionIndexOf(notes, target.groupId, target.overNoteId)
        : target.type === 'group-header'
          ? 0
          : -1;
    const next = computeNotesMove(notes, noteId, target.groupId, index);
    if (next !== notes) onUpdateNotes(next, []);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const type = (event.active.data.current as DraggableData | undefined)?.type;
    if (type !== 'note') return;
    const noteId = Number(String(event.active.id).slice('note-'.length));
    const moving = notes.find((note) => note.id === noteId);
    touchedSectionsRef.current.add(moving ? moving.groupId : null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || over.id === active.id) return;
    const activeType = (active.data.current as DraggableData | undefined)?.type;
    if (activeType !== 'note') return;
    const target = resolveDropTarget(over);
    if (!target) return;

    if (target.type === 'group-header' && target.groupId !== null) {
      expandGroup(target.groupId);
    }

    const noteId = Number(String(active.id).slice('note-'.length));
    const moving = notes.find((note) => note.id === noteId);
    if (!moving || moving.groupId === target.groupId) return;

    touchedSectionsRef.current.add(moving.groupId);
    touchedSectionsRef.current.add(target.groupId);
    applyMove(noteId, target);
  };

  const handleNoteDragEnd = (activeId: string, over: DragEndEvent['over']) => {
    const noteId = Number(activeId.slice('note-'.length));
    const moving = notes.find((note) => note.id === noteId);
    if (moving) touchedSectionsRef.current.add(moving.groupId);

    // Compute the final layout exactly once, from the pre-drag `notes`,
    // and hand BOTH the result and the touched sections to the single
    // persist call below. Previously the move was applied via
    // onUpdateNotes(next, []) first and then overwritten by a second
    // onUpdateNotes(notes, sections) call with the stale pre-drag `notes`
    // — so intra-group reorders were reverted and never persisted.
    let next = notes;
    if (over && moving) {
      const target = resolveDropTarget(over);
      if (target) {
        touchedSectionsRef.current.add(target.groupId);
        const index =
          target.overNoteId !== null
            ? sectionIndexOf(notes, target.groupId, target.overNoteId)
            : target.type === 'group-header'
              ? 0
              : -1;
        next = computeNotesMove(notes, noteId, target.groupId, index);
      }
    }

    const sections = Array.from(touchedSectionsRef.current);
    touchedSectionsRef.current.clear();
    onUpdateNotes(next, sections);
  };

  const handleGroupDragEnd = (activeId: string, over: DragEndEvent['over']) => {
    if (!over) return;
    const groupId = Number(activeId.slice('group-'.length));
    const target = resolveDropTarget(over);
    const from = sortedGroups.findIndex((group) => group.id === groupId);
    if (from < 0) return;

    let targetIndex: number;
    if (
      (target?.type === 'group-header' || target?.type === 'note') &&
      target.groupId !== null
    ) {
      targetIndex = sortedGroups.findIndex(
        (group) => group.id === target.groupId
      );
    } else {
      targetIndex = sortedGroups.length - 1;
    }
    if (targetIndex < 0 || from === targetIndex) return;

    const reordered = arrayMove(sortedGroups, from, targetIndex).map(
      (group, position) => ({ ...group, position })
    );
    onUpdateGroups(reordered);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const type = (active.data.current as DraggableData | undefined)?.type;
    if (type === 'note') handleNoteDragEnd(String(active.id), over);
    else if (type === 'group-header')
      handleGroupDragEnd(String(active.id), over);
    touchedSectionsRef.current.clear();
  };

  const handleDragCancel = () => {
    touchedSectionsRef.current.clear();
  };

  const showUngrouped = !(searching && ungroupedNotes.length === 0);

  return (
    <div className="flex-1 overflow-y-auto">
      {isLoading ? (
        <div className="p-4 text-center text-muted-foreground">
          {t('loading')}
        </div>
      ) : notes.length === 0 && groups.length === 0 ? (
        <div className="p-4 text-center text-muted-foreground">
          {searching ? t('noNotesFound') : t('noNotesYet')}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {showUngrouped && (
            <UngroupedSection
              notes={ungroupedNotes}
              selectedNote={selectedNote}
              onSelectNote={onSelectNote}
              onEditNote={onEditNote}
              onDeleteNote={onDeleteNote}
              t={t}
            />
          )}
          <div className="mx-2 mt-1 space-y-1">
            {visibleGroupSections.map(({ group, notes: groupNotes }) => (
              <GroupSection
                key={group.id}
                group={group}
                notes={groupNotes}
                collapsed={!searching && collapsedGroups.has(group.id)}
                renaming={renamingGroupId === group.id}
                renameValue={renameValue}
                selectedNote={selectedNote}
                onSelectNote={onSelectNote}
                onEditNote={onEditNote}
                onDeleteNote={onDeleteNote}
                onToggleGroup={() => toggleGroup(group.id)}
                onRenameValueChange={setRenameValue}
                onStartRename={() => startRename(group)}
                onCommitRename={() => commitRename(group)}
                onCancelRename={cancelRename}
                onDeleteGroup={() => onOpenDeleteGroup(group)}
                t={t}
              />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  );
}

interface SidebarT {
  (key: string, vars?: Record<string, string | number>): string;
}

interface NoteItemProps {
  note: Note;
  selected: boolean;
  onSelectNote: (note: Note) => void;
  onEditNote: (note: Note) => void;
  onDeleteNote: (note: Note) => void;
  t: SidebarT;
}

function SortableNoteItem({
  note,
  selected,
  onSelectNote,
  onEditNote,
  onDeleteNote,
  t,
}: NoteItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: noteSortableId(note.id),
    data: { type: 'note', groupId: note.groupId } satisfies DraggableData,
  });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className="relative"
    >
      <div
        className={cn(
          'group/note flex items-center justify-between gap-2 rounded-md p-2 transition-colors',
          selected ? 'bg-primary/10' : 'hover:bg-muted/50',
          isDragging && 'z-10 bg-background shadow-sm ring-1 ring-primary/40'
        )}
      >
        <div
          {...attributes}
          {...listeners}
          onClick={() => onSelectNote(note)}
          className="flex min-w-0 flex-1 cursor-pointer items-center"
        >
          <span className="truncate text-sm font-medium text-foreground">
            {note.title || t('untitled')}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/note:opacity-100 focus-within:opacity-100 md:group-focus-within/note:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditNote(note);
            }}
            className="p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteNote(note);
            }}
            className="p-1 text-muted-foreground transition-colors hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

interface UngroupedSectionProps {
  notes: Note[];
  selectedNote: Note | null;
  onSelectNote: (note: Note) => void;
  onEditNote: (note: Note) => void;
  onDeleteNote: (note: Note) => void;
  t: SidebarT;
}

function UngroupedSection({
  notes,
  selectedNote,
  onSelectNote,
  onEditNote,
  onDeleteNote,
  t,
}: UngroupedSectionProps) {
  const { setNodeRef } = useDroppable({
    id: UNGROUPED_CONTAINER_ID,
    data: { type: 'container', groupId: null } satisfies DraggableData,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(notes.length === 0 && 'min-h-12 rounded-md')}
    >
      <SortableContext
        items={notes.map((note) => noteSortableId(note.id))}
        strategy={verticalListSortingStrategy}
      >
        <ul className="divide-y divide-border">
          {notes.map((note) => (
            <SortableNoteItem
              key={note.id}
              note={note}
              selected={selectedNote?.id === note.id}
              onSelectNote={onSelectNote}
              onEditNote={onEditNote}
              onDeleteNote={onDeleteNote}
              t={t}
            />
          ))}
        </ul>
      </SortableContext>
    </div>
  );
}

interface GroupSectionProps {
  group: NoteGroup;
  notes: Note[];
  collapsed: boolean;
  renaming: boolean;
  renameValue: string;
  selectedNote: Note | null;
  onSelectNote: (note: Note) => void;
  onEditNote: (note: Note) => void;
  onDeleteNote: (note: Note) => void;
  onToggleGroup: () => void;
  onRenameValueChange: (value: string) => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDeleteGroup: () => void;
  t: SidebarT;
}

function GroupSection({
  group,
  notes,
  collapsed,
  renaming,
  renameValue,
  selectedNote,
  onSelectNote,
  onEditNote,
  onDeleteNote,
  onToggleGroup,
  onRenameValueChange,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDeleteGroup,
  t,
}: GroupSectionProps) {
  const { setNodeRef } = useDroppable({
    id: containerSortableId(group.id),
    data: { type: 'container', groupId: group.id } satisfies DraggableData,
  });

  return (
    <Collapsible open={!collapsed}>
      <SortableGroupHeader
        group={group}
        noteCount={notes.length}
        collapsed={collapsed}
        renaming={renaming}
        renameValue={renameValue}
        onToggle={onToggleGroup}
        onRenameValueChange={onRenameValueChange}
        onStartRename={onStartRename}
        onCommitRename={onCommitRename}
        onCancelRename={onCancelRename}
        onDeleteGroup={onDeleteGroup}
        t={t}
      />
      <CollapsibleContent>
        <div ref={setNodeRef} className="ml-3 border-l border-border pl-1">
          <SortableContext
            items={notes.map((note) => noteSortableId(note.id))}
            strategy={verticalListSortingStrategy}
          >
            <ul>
              {notes.map((note) => (
                <SortableNoteItem
                  key={note.id}
                  note={note}
                  selected={selectedNote?.id === note.id}
                  onSelectNote={onSelectNote}
                  onEditNote={onEditNote}
                  onDeleteNote={onDeleteNote}
                  t={t}
                />
              ))}
            </ul>
          </SortableContext>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface GroupHeaderProps {
  group: NoteGroup;
  noteCount: number;
  collapsed: boolean;
  renaming: boolean;
  renameValue: string;
  onToggle: () => void;
  onRenameValueChange: (value: string) => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDeleteGroup: () => void;
  t: SidebarT;
}

function SortableGroupHeader({
  group,
  noteCount,
  collapsed,
  renaming,
  renameValue,
  onToggle,
  onRenameValueChange,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDeleteGroup,
  t,
}: GroupHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: groupSortableId(group.id),
    data: {
      type: 'group-header',
      groupId: group.id,
    } satisfies DraggableData,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'group/header flex items-center gap-0.5',
        isDragging && 'z-10'
      )}
    >
      {renaming ? (
        <div className="flex flex-1 items-center rounded-md border border-border bg-muted/50 px-2 py-1">
          <Input
            value={renameValue}
            onChange={(e) => onRenameValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitRename();
              else if (e.key === 'Escape') onCancelRename();
            }}
            onBlur={onCommitRename}
            autoFocus
            maxLength={100}
            className="h-6 border-none px-0 text-sm shadow-none focus-visible:ring-0"
            aria-label={t('groupName')}
          />
        </div>
      ) : (
        <>
          <div
            {...attributes}
            {...listeners}
            onClick={onToggle}
            className={cn(
              'flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border border-border bg-muted/50 px-2 py-1.5 transition-colors hover:bg-muted/70',
              isDragging && 'bg-background shadow-sm ring-1 ring-primary/40'
            )}
          >
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                collapsed && '-rotate-90'
              )}
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {group.name}
            </span>
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
              {noteCount}
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('renameGroup')}
                className="h-7 w-7 shrink-0 text-muted-foreground transition-opacity hover:text-foreground md:opacity-0 md:group-hover/header:opacity-100"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onStartRename}>
                <Pencil className="h-4 w-4" />
                {t('rename')}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onDeleteGroup}>
                <Trash2 className="h-4 w-4" />
                {t('deleteGroup')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}
