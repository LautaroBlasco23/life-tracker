import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StickyNote } from '@shared/types/sticky-note';
import { stickyNoteService } from '@shared/services/sticky-note-service';
import { showToast } from '@/lib/toast';

vi.mock('@shared/services/sticky-note-service', () => ({
  stickyNoteService: {
    getStickyNotes: vi.fn(),
    createStickyNote: vi.fn(),
    updateStickyNote: vi.fn(),
    deleteStickyNote: vi.fn(),
  },
}));

vi.mock('@/lib/toast', () => ({
  showToast: vi.fn(),
}));

// Returns one memoized translator per namespace: the real useTranslations
// wraps its result in useCallback, and views key effects off its identity —
// a fresh function per call would re-trigger them every render.
vi.mock('@shared/contexts/language-context', () => {
  const dicts: Record<string, Record<string, string>> = {
    stickyNotes: {
      newNote: 'New note',
      empty: 'No sticky notes',
      emptyDescription: 'Ideas land here',
      failedToLoad: 'Failed to load sticky notes',
      failedToDelete: 'Failed to delete sticky note',
      deleted: 'Sticky note deleted',
      titlePlaceholder: 'Title',
      descriptionPlaceholder: 'Take a note...',
      save: 'Save',
      delete: 'Delete note',
    },
    common: {
      loading: 'Loading...',
      cancel: 'Cancel',
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

import { StickyNotesView } from './stickyNotesView';

const mockStickyNoteService = vi.mocked(stickyNoteService);

function makeNote(overrides: Partial<StickyNote> & { id: number }): StickyNote {
  return {
    userId: 1,
    title: `Sticky ${overrides.id}`,
    description: 'body',
    createdAt: new Date(2026, 0, 1).toISOString(),
    editedAt: new Date(2026, 0, 1).toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStickyNoteService.getStickyNotes.mockResolvedValue([]);
});

describe('StickyNotesView', () => {
  it('shows the loading state, then the empty state', async () => {
    render(<StickyNotesView />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText('No sticky notes')).toBeInTheDocument()
    );
    expect(mockStickyNoteService.getStickyNotes).toHaveBeenCalled();
  });

  it('toasts a destructive error when loading fails', async () => {
    mockStickyNoteService.getStickyNotes.mockRejectedValue(
      new Error('offline')
    );
    render(<StickyNotesView />);

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        title: 'Failed to load sticky notes',
        description: 'offline',
        variant: 'destructive',
      })
    );
  });

  it('renders the loaded notes as cards', async () => {
    mockStickyNoteService.getStickyNotes.mockResolvedValue([
      makeNote({ id: 1, title: 'First idea' }),
      makeNote({ id: 2, title: 'Second idea' }),
    ]);
    render(<StickyNotesView />);

    await waitFor(() =>
      expect(screen.getByText('First idea')).toBeInTheDocument()
    );
    expect(screen.getByText('Second idea')).toBeInTheDocument();
    expect(screen.queryByText('No sticky notes')).not.toBeInTheDocument();
  });

  it('creates a note from the draft card', async () => {
    const user = userEvent.setup();
    const created = makeNote({ id: 9, title: 'New idea', description: '' });
    mockStickyNoteService.createStickyNote.mockResolvedValue(created);
    render(<StickyNotesView />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'New note' })).toBeEnabled()
    );

    await user.click(screen.getByRole('button', { name: 'New note' }));
    await user.type(screen.getByPlaceholderText('Title'), 'New idea');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockStickyNoteService.createStickyNote).toHaveBeenCalledWith({
        title: 'New idea',
        description: '',
      })
    );
    // The draft card closes and the created note joins the grid.
    await waitFor(() =>
      expect(screen.getByText('New idea')).toBeInTheDocument()
    );
    expect(screen.queryByPlaceholderText('Title')).not.toBeInTheDocument();
  });

  it('discards the draft card on cancel', async () => {
    const user = userEvent.setup();
    render(<StickyNotesView />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'New note' })).toBeEnabled()
    );

    await user.click(screen.getByRole('button', { name: 'New note' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockStickyNoteService.createStickyNote).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText('Title')).not.toBeInTheDocument();
  });

  it('saves edits to an existing note', async () => {
    const user = userEvent.setup();
    const updated = makeNote({ id: 1, title: 'Updated idea' });
    mockStickyNoteService.updateStickyNote.mockResolvedValue(updated);
    mockStickyNoteService.getStickyNotes.mockResolvedValue([
      makeNote({ id: 1, title: 'First idea' }),
    ]);
    render(<StickyNotesView />);
    await waitFor(() =>
      expect(screen.getByText('First idea')).toBeInTheDocument()
    );

    await user.click(screen.getByText('First idea'));
    const title = screen.getByPlaceholderText('Title');
    await user.clear(title);
    await user.type(title, 'Updated idea');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockStickyNoteService.updateStickyNote).toHaveBeenCalledWith(1, {
        title: 'Updated idea',
        description: 'body',
      })
    );
    await waitFor(() =>
      expect(screen.getByText('Updated idea')).toBeInTheDocument()
    );
  });

  it('removes a note optimistically and shows a confirmation toast', async () => {
    const user = userEvent.setup();
    mockStickyNoteService.getStickyNotes.mockResolvedValue([
      makeNote({ id: 1, title: 'First idea' }),
    ]);
    mockStickyNoteService.deleteStickyNote.mockResolvedValue(undefined);
    render(<StickyNotesView />);
    await waitFor(() =>
      expect(screen.getByText('First idea')).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: 'Delete note' }));

    await waitFor(() =>
      expect(screen.queryByText('First idea')).not.toBeInTheDocument()
    );
    expect(mockStickyNoteService.deleteStickyNote).toHaveBeenCalledWith(1);
    expect(showToast).toHaveBeenCalledWith({ title: 'Sticky note deleted' });
  });

  it('restores the note and toasts when the delete fails', async () => {
    const user = userEvent.setup();
    mockStickyNoteService.getStickyNotes.mockResolvedValue([
      makeNote({ id: 1, title: 'First idea' }),
    ]);
    mockStickyNoteService.deleteStickyNote.mockRejectedValue(
      new Error('offline')
    );
    render(<StickyNotesView />);
    await waitFor(() =>
      expect(screen.getByText('First idea')).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: 'Delete note' }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        title: 'Failed to delete sticky note',
        description: 'offline',
        variant: 'destructive',
      })
    );
    // The optimistic removal is rolled back from the snapshot.
    await waitFor(() =>
      expect(screen.getByText('First idea')).toBeInTheDocument()
    );
  });
});
