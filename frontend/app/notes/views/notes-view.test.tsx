import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Note, NoteGroup } from '@shared/types/note';
import { noteService } from '@shared/services/note-service';
import { noteGroupService } from '@shared/services/note-group-service';
import { showToast } from '@/lib/toast';

vi.mock('@shared/services/note-service', () => ({
  noteService: {
    getNotes: vi.fn(),
    searchNotes: vi.fn(),
    createNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
    reorderNotes: vi.fn(),
    uploadImage: vi.fn(),
  },
}));

vi.mock('@shared/services/note-group-service', () => ({
  noteGroupService: {
    getNoteGroups: vi.fn(),
    createNoteGroup: vi.fn(),
    updateNoteGroup: vi.fn(),
    deleteNoteGroup: vi.fn(),
    reorderNoteGroups: vi.fn(),
  },
}));

vi.mock('@/lib/toast', () => ({
  showToast: vi.fn(),
}));

// The real editor drags in CodeMirror; a controlled stub keeps this view
// test on the page's own logic (the editor itself has its own test file).
vi.mock('@/components/notes/live-markdown-editor', () => ({
  LiveMarkdownEditor: ({
    value,
    onChange,
    ariaLabel,
  }: {
    value: string;
    onChange: (value: string) => void;
    ariaLabel?: string;
  }) => (
    <textarea
      aria-label={ariaLabel ?? 'Note content'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

// Memoized per namespace: the real useTranslations wraps its result in
// useCallback, and views key callbacks/effects off its identity.
vi.mock('@shared/contexts/language-context', () => {
  const dicts: Record<string, Record<string, string>> = {
    notes: {
      title: 'Notes',
      description: 'Notes description',
      tabNotes: 'Notes',
      tabSticky: 'Sticky notes',
      search: 'Search notes',
      addGroup: 'Add group',
      newNote: 'New note',
      untitled: 'Untitled',
      selectNote: 'Select a note',
      selectNoteDescription: 'Pick a note from the sidebar',
      titlePlaceholder: 'Title',
      contentPlaceholder: 'Note content',
      saving: 'Saving...',
      unsavedChanges: 'Unsaved changes',
      titleRequired: 'Title required',
      lastEdited: 'Last edited {date}',
      back: 'Back',
      noteCreated: 'Note created',
      startWriting: 'Start writing',
      failedToCreate: 'Failed to create note',
      noteDeleted: 'Note deleted',
      noteDeletedDescription: 'The note is gone',
      deleteNote: 'Delete note',
      failedToLoad: 'Failed to load notes',
      failedToSave: 'Failed to save',
      groupDeleted: 'Group deleted',
      failedToDeleteGroup: 'Failed to delete group',
      deleteGroupConfirmTitle: 'Delete group?',
      deleteGroupConfirmMessage: 'Notes return to the sidebar',
      deleteGroup: 'Delete group',
      groupCreated: 'Group created',
      failedToCreateGroup: 'Failed to create group',
      groupName: 'Group name',
      createGroup: 'Create group',
      loading: 'Loading...',
      noNotesFound: 'No notes found',
      noNotesYet: 'No notes yet',
      dropToUngroup: 'Drop to ungroup',
      renameGroup: 'Group actions',
      rename: 'Rename',
      imageUploadingAlt: 'Uploading image...',
      imageAlt: 'Pasted image',
      imageUploadFailed: 'Image upload failed',
    },
    common: {
      cancel: 'Cancel',
      creating: 'Creating...',
      deleting: 'Deleting...',
      loading: 'Loading...',
      error: 'Error',
      delete: 'Delete',
      save: 'Save',
    },
    deleteModal: {
      cannotBeUndone: 'This cannot be undone',
      areYouSure: 'Delete {name}?',
      deleting: 'Deleting...',
    },
  };
  const cache = new Map<
    string,
    (key: string, vars?: Record<string, string | number>) => string
  >();
  return {
    useTranslations: (namespace: string) => {
      if (!cache.has(namespace)) {
        cache.set(
          namespace,
          (key: string, vars?: Record<string, string | number>) => {
            let str = dicts[namespace]?.[key] ?? key;
            if (vars) {
              for (const [k, v] of Object.entries(vars)) {
                str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
              }
            }
            return str;
          }
        );
      }
      return cache.get(namespace)!;
    },
  };
});

import { NotesView } from './notesView';

const mockNoteService = vi.mocked(noteService);
const mockNoteGroupService = vi.mocked(noteGroupService);

function makeNote(overrides: Partial<Note> & { id: number }): Note {
  return {
    userId: 1,
    title: `Note ${overrides.id}`,
    content: `body ${overrides.id}`,
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

const notes = [
  makeNote({ id: 1, position: 1, editedAt: '2026-02-01T10:00:00Z' }),
  makeNote({ id: 2, position: 0, editedAt: '2026-02-02T10:00:00Z' }),
];
const groups = [makeGroup({ id: 10, name: 'Later', position: 0 })];

function draftStorage(): Record<number, { title: string; content: string }> {
  return JSON.parse(localStorage.getItem('notes_drafts') ?? '{}');
}

async function renderLoadedView() {
  const user = userEvent.setup();
  render(<NotesView />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'New note' })).toBeEnabled()
  );
  await waitFor(() => expect(screen.getByText('Note 2')).toBeInTheDocument());
  return { user };
}

/** Fires the visibilitychange flush the view listens to (autosave safety). */
function hideTab() {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'hidden',
  });
  document.dispatchEvent(new Event('visibilitychange'));
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockNoteService.getNotes.mockResolvedValue(notes);
  mockNoteService.searchNotes.mockResolvedValue([notes[0]]);
  mockNoteGroupService.getNoteGroups.mockResolvedValue(groups);
  mockNoteService.updateNote.mockImplementation(
    async (id, data) =>
      ({
        ...makeNote({ id }),
        ...data,
      }) as Note
  );
});

describe('NotesView — loading', () => {
  it('loads notes and groups on mount and shows the empty editor pane', async () => {
    await renderLoadedView();

    expect(mockNoteService.getNotes).toHaveBeenCalled();
    expect(mockNoteGroupService.getNoteGroups).toHaveBeenCalled();
    expect(screen.getByText('Note 1')).toBeInTheDocument();
    expect(screen.getByText('Later')).toBeInTheDocument();
    expect(screen.getByText('Select a note')).toBeInTheDocument();
  });

  it('toasts a destructive error when loading fails', async () => {
    mockNoteService.getNotes.mockRejectedValue(new Error('boom'));
    render(<NotesView />);

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        title: 'Failed to load notes',
        description: 'boom',
        variant: 'destructive',
      })
    );
  });

  it('searches through the service as the query changes', async () => {
    const { user } = await renderLoadedView();

    await user.type(screen.getByPlaceholderText('Search notes'), 'foo');

    await waitFor(() =>
      expect(mockNoteService.searchNotes).toHaveBeenLastCalledWith('foo')
    );
  });
});

describe('NotesView — editor and autosave', () => {
  it('creates a note, selects it and toasts', async () => {
    const { user } = await renderLoadedView();
    const created = makeNote({ id: 3, title: 'Untitled', content: '' });
    mockNoteService.createNote.mockResolvedValue(created);

    await user.click(screen.getByRole('button', { name: 'New note' }));

    await waitFor(() =>
      expect(mockNoteService.createNote).toHaveBeenCalledWith({
        title: 'Untitled',
        content: '',
      })
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Title')).toHaveValue('Untitled')
    );
    expect(screen.getByLabelText('Note content')).toHaveValue('');
    expect(showToast).toHaveBeenCalledWith({
      title: 'Note created',
      description: 'Start writing',
    });
  });

  it('shows a create failure toast', async () => {
    const { user } = await renderLoadedView();
    mockNoteService.createNote.mockRejectedValue(new Error('quota'));

    await user.click(screen.getByRole('button', { name: 'New note' }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        title: 'Failed to create note',
        description: 'quota',
        variant: 'destructive',
      })
    );
  });

  it('opens a note in the editor with its stored values', async () => {
    const { user } = await renderLoadedView();

    await user.click(screen.getByText('Note 1'));

    expect(screen.getByLabelText('Title')).toHaveValue('Note 1');
    expect(screen.getByLabelText('Note content')).toHaveValue('body 1');
  });

  it('persists a draft locally and marks the note unsaved while typing', async () => {
    const { user } = await renderLoadedView();

    await user.click(screen.getByText('Note 1'));
    const title = screen.getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Renamed');

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(draftStorage()[1]).toEqual({ title: 'Renamed', content: 'body 1' });
    expect(mockNoteService.updateNote).not.toHaveBeenCalled();
  });

  it('flushes the open note on tab hide and clears the draft on success', async () => {
    const { user } = await renderLoadedView();

    await user.click(screen.getByText('Note 1'));
    const title = screen.getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Renamed');

    hideTab();

    await waitFor(() =>
      expect(mockNoteService.updateNote).toHaveBeenCalledWith(1, {
        title: 'Renamed',
        content: 'body 1',
      })
    );
    await waitFor(() => expect(draftStorage()[1]).toBeUndefined());
    // The sidebar row reflects the server response.
    await waitFor(() =>
      expect(screen.getByText('Renamed')).toBeInTheDocument()
    );
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });

  it('sends content only when the title is emptied (server keeps the title)', async () => {
    const { user } = await renderLoadedView();

    await user.click(screen.getByText('Note 1'));
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Note content'), 'more words');

    hideTab();

    await waitFor(() =>
      expect(mockNoteService.updateNote).toHaveBeenCalledWith(1, {
        content: 'body 1more words',
      })
    );
    expect(screen.getByText('Title required')).toBeInTheDocument();
  });

  it('does not flush when the open note has no changes', async () => {
    const { user } = await renderLoadedView();

    await user.click(screen.getByText('Note 1'));

    hideTab();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockNoteService.updateNote).not.toHaveBeenCalled();
  });
});

describe('NotesView — note deletion', () => {
  it('deletes a note after confirming in the modal', async () => {
    const { user } = await renderLoadedView();
    mockNoteService.deleteNote.mockResolvedValue(undefined);

    await user.click(
      screen.getByText('Note 1').closest('li')!.querySelector('button')!
    );
    expect(await screen.findByText('Delete Note 1?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete note' }));

    await waitFor(() =>
      expect(mockNoteService.deleteNote).toHaveBeenCalledWith(1)
    );
    await waitFor(() =>
      expect(screen.queryByText('Note 1')).not.toBeInTheDocument()
    );
    expect(showToast).toHaveBeenCalledWith({
      title: 'Note deleted',
      description: 'The note is gone',
    });
  });
});

describe('NotesView — groups', () => {
  it('creates a group through the modal and shows it first', async () => {
    const { user } = await renderLoadedView();
    const created = makeGroup({ id: 20, name: 'Recipes', position: 0 });
    mockNoteGroupService.createNoteGroup.mockResolvedValue(created);

    await user.click(screen.getByRole('button', { name: 'Add group' }));
    await user.type(screen.getByLabelText('Group name'), 'Recipes');
    await user.click(screen.getByRole('button', { name: 'Create group' }));

    await waitFor(() =>
      expect(mockNoteGroupService.createNoteGroup).toHaveBeenCalledWith({
        name: 'Recipes',
      })
    );
    await waitFor(() =>
      expect(screen.getByText('Recipes')).toBeInTheDocument()
    );
    expect(showToast).toHaveBeenCalledWith({ title: 'Group created' });
  });

  it('renames a group through the sidebar menu', async () => {
    const { user } = await renderLoadedView();
    mockNoteGroupService.updateNoteGroup.mockResolvedValue(undefined);

    await user.click(screen.getByRole('button', { name: 'Group actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const input = screen.getByLabelText('Group name');
    await user.clear(input);
    await user.type(input, 'Someday');
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(mockNoteGroupService.updateNoteGroup).toHaveBeenCalledWith(10, {
        name: 'Someday',
      })
    );
    await waitFor(() =>
      expect(screen.getByText('Someday')).toBeInTheDocument()
    );
  });

  it('deletes a group and reloads notes and groups', async () => {
    const { user } = await renderLoadedView();
    mockNoteGroupService.deleteNoteGroup.mockResolvedValue(undefined);

    await user.click(screen.getByRole('button', { name: 'Group actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete group' }));
    expect(await screen.findByText('Delete group?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete group' }));

    await waitFor(() =>
      expect(mockNoteGroupService.deleteNoteGroup).toHaveBeenCalledWith(10)
    );
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({ title: 'Group deleted' })
    );
    // Reload after delete: groups are fetched again.
    await waitFor(() =>
      expect(mockNoteGroupService.getNoteGroups).toHaveBeenCalled()
    );
  });
});
