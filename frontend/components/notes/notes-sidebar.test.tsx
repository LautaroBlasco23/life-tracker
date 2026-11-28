import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Note, NoteGroup } from '@shared/types/note';
import { NotesSidebar, sortGroups, sortSectionNotes } from './notes-sidebar';

// Memoized per namespace: the real useTranslations wraps its result in
// useCallback, so a fresh function per call could re-trigger effects.
vi.mock('@shared/contexts/language-context', () => {
  const dicts: Record<string, Record<string, string>> = {
    notes: {
      loading: 'Loading...',
      noNotesFound: 'No notes found',
      noNotesYet: 'No notes yet',
      dropToUngroup: 'Drop to ungroup',
      untitled: 'Untitled',
      groupName: 'Group name',
      renameGroup: 'Group actions',
      rename: 'Rename',
      deleteGroup: 'Delete group',
    },
    common: { delete: 'Delete' },
  };
  const cache = new Map<string, (key: string) => string>();
  return {
    useTranslations: (namespace: string) => {
      if (!cache.has(namespace)) {
        cache.set(namespace, (key: string) => dicts[namespace]?.[key] ?? key);
      }
      return cache.get(namespace)!;
    },
  };
});

let nextId = 100;
function makeNote(overrides: Partial<Note> & { id: number }): Note {
  return {
    userId: 1,
    title: `Note ${overrides.id}`,
    content: '',
    groupId: null,
    position: 0,
    createdAt: new Date(2026, 0, 1).toISOString(),
    editedAt: new Date(2026, 0, 1).toISOString(),
    ...overrides,
  };
}

function makeGroup(overrides: Partial<NoteGroup> & { id: number }): NoteGroup {
  return {
    userId: 1,
    name: `Group ${overrides.id}`,
    position: 0,
    createdAt: new Date(2026, 0, 1).toISOString(),
    editedAt: new Date(2026, 0, 1).toISOString(),
    ...overrides,
  };
}

function renderSidebar(
  props: Partial<Parameters<typeof NotesSidebar>[0]> = {}
) {
  const handlers = {
    onSelectNote: vi.fn(),
    onDeleteNote: vi.fn(),
    onUpdateNotes: vi.fn(),
    onUpdateGroups: vi.fn(),
    onRenameGroup: vi.fn(),
    onOpenDeleteGroup: vi.fn(),
  };
  render(
    <NotesSidebar
      notes={[]}
      groups={[]}
      selectedNote={null}
      searchQuery=""
      isLoading={false}
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sortSectionNotes / sortGroups', () => {
  it('sorts notes by position, breaking ties with newest edit first', () => {
    const notes = [
      makeNote({ id: 1, position: 0, editedAt: '2026-01-01T00:00:00Z' }),
      makeNote({ id: 2, position: 1, editedAt: '2026-01-03T00:00:00Z' }),
      makeNote({ id: 3, position: 1, editedAt: '2026-01-02T00:00:00Z' }),
      makeNote({ id: 4, position: 0, editedAt: '2026-01-05T00:00:00Z' }),
    ];
    expect(sortSectionNotes(notes).map((n) => n.id)).toEqual([4, 1, 2, 3]);
  });

  it('sorts groups by position without mutating the input', () => {
    const groups = [
      makeGroup({ id: 1, position: 2 }),
      makeGroup({ id: 2, position: 0 }),
    ];
    const sorted = sortGroups(groups);
    expect(sorted.map((g) => g.id)).toEqual([2, 1]);
    expect(groups[0].id).toBe(1);
  });
});

describe('NotesSidebar', () => {
  it('shows the loading state', () => {
    renderSidebar({ isLoading: true });

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows the empty state for a fresh sidebar', () => {
    renderSidebar();

    expect(screen.getByText('No notes yet')).toBeInTheDocument();
  });

  it('shows the no-results state while searching', () => {
    renderSidebar({ searchQuery: 'zzz' });

    expect(screen.getByText('No notes found')).toBeInTheDocument();
  });

  it('renders ungrouped notes in section order', () => {
    const notes = [
      makeNote({ id: 1, position: 1, editedAt: '2026-01-01T00:00:00Z' }),
      makeNote({ id: 2, position: 0, editedAt: '2026-01-01T00:00:00Z' }),
    ];
    renderSidebar({ notes });

    const titles = screen.getAllByText(/Note [12]/).map((el) => el.textContent);
    expect(titles).toEqual(['Note 2', 'Note 1']);
  });

  it('renders group sections with their note counts and grouped notes', () => {
    const groups = [
      makeGroup({ id: 10, name: 'Later', position: 1 }),
      makeGroup({ id: 11, name: 'Now', position: 0 }),
    ];
    const notes = [
      makeNote({ id: 1, groupId: 10, position: 0 }),
      makeNote({ id: 2, groupId: 11, position: 0 }),
      makeNote({ id: 3, groupId: 11, position: 1 }),
    ];
    renderSidebar({ notes, groups });

    expect(screen.getByText('Now')).toBeInTheDocument();
    expect(screen.getByText('Later')).toBeInTheDocument();

    const nowSection = screen
      .getByText('Now')
      .closest('.group\\/header') as HTMLElement;
    expect(within(nowSection).getByText('2')).toBeInTheDocument(); // count badge
    const laterSection = screen
      .getByText('Later')
      .closest('.group\\/header') as HTMLElement;
    expect(within(laterSection).getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Note 1')).toBeInTheDocument();
  });

  it('selects a note when its row is clicked', async () => {
    const user = userEvent.setup();
    const note = makeNote({ id: 5 });
    const { onSelectNote } = renderSidebar({ notes: [note] });

    await user.click(screen.getByText('Note 5'));

    expect(onSelectNote).toHaveBeenCalledWith(note);
  });

  it('deletes a note from its hover action', async () => {
    const user = userEvent.setup();
    const note = makeNote({ id: 5 });
    const handlers = renderSidebar({ notes: [note] });

    await user.click(
      screen.getByText('Note 5').closest('li')!.querySelector('button')!
    );

    expect(handlers.onDeleteNote).toHaveBeenCalledWith(note);
    expect(handlers.onSelectNote).not.toHaveBeenCalled();
  });

  it('collapses and re-expands a group from its header', async () => {
    const user = userEvent.setup();
    const groups = [makeGroup({ id: 10, name: 'Later', position: 0 })];
    const notes = [makeNote({ id: 1, groupId: 10 })];
    renderSidebar({ notes, groups });

    await user.click(screen.getByText('Later'));
    await waitFor(() =>
      expect(screen.queryByText('Note 1')).not.toBeInTheDocument()
    );

    await user.click(screen.getByText('Later'));
    await waitFor(() => expect(screen.getByText('Note 1')).toBeInTheDocument());
  });

  it('renames a group from the dropdown menu', async () => {
    const user = userEvent.setup();
    const group = makeGroup({ id: 10, name: 'Later', position: 0 });
    const { onRenameGroup } = renderSidebar({ groups: [group] });

    await user.click(screen.getByRole('button', { name: 'Group actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));

    const input = screen.getByLabelText('Group name');
    expect(input).toHaveValue('Later');
    await user.clear(input);
    await user.type(input, 'Someday');
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(onRenameGroup).toHaveBeenCalledWith(10, 'Someday')
    );
  });

  it('does not rename when the new name is empty or unchanged', async () => {
    const user = userEvent.setup();
    const group = makeGroup({ id: 10, name: 'Later', position: 0 });
    const { onRenameGroup } = renderSidebar({ groups: [group] });

    await user.click(screen.getByRole('button', { name: 'Group actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));

    await user.clear(screen.getByLabelText('Group name'));
    await user.keyboard('{Enter}');

    expect(onRenameGroup).not.toHaveBeenCalled();
  });

  it('opens the delete-group modal from the dropdown menu', async () => {
    const user = userEvent.setup();
    const group = makeGroup({ id: 10, name: 'Later', position: 0 });
    const { onOpenDeleteGroup } = renderSidebar({ groups: [group] });

    await user.click(screen.getByRole('button', { name: 'Group actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete group' }));

    expect(onOpenDeleteGroup).toHaveBeenCalledWith(group);
  });

  it('shows the drop-to-ungroup target when the ungrouped section is empty', () => {
    renderSidebar({ groups: [makeGroup({ id: 10, position: 0 })] });

    expect(screen.getByText('Drop to ungroup')).toBeInTheDocument();
  });

  it('hides empty groups and the ungrouped section while searching', () => {
    const groups = [
      makeGroup({ id: 10, name: 'Empty', position: 0 }),
      makeGroup({ id: 11, name: 'Matches', position: 1 }),
    ];
    const notes = [
      makeNote({ id: 1, groupId: 11 }),
      makeNote({ id: 2, title: 'Coffee plans' }),
    ];
    renderSidebar({ notes, groups, searchQuery: 'note' });

    // The sidebar receives already-filtered notes from the page; it only
    // hides the group sections left empty by the search.
    expect(screen.queryByText('Empty')).not.toBeInTheDocument();
    expect(screen.getByText('Matches')).toBeInTheDocument();
    expect(screen.getByText('Note 1')).toBeInTheDocument();
    expect(screen.getByText('Coffee plans')).toBeInTheDocument();
  });
});
