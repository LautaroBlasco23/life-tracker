import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StickyNote } from '@shared/types/sticky-note';
import { StickyNoteCard } from './sticky-note-card';

// Pure presentational component: no services to mock, only the translations.
// Memoized per namespace: the real useTranslations wraps its result in
// useCallback, so a fresh function per call could re-trigger effects.
vi.mock('@shared/contexts/language-context', () => {
  const dicts: Record<string, Record<string, string>> = {
    stickyNotes: {
      titlePlaceholder: 'Title',
      descriptionPlaceholder: 'Take a note...',
      save: 'Save',
      delete: 'Delete note',
    },
    common: {
      cancel: 'Cancel',
    },
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

const note: StickyNote = {
  id: 3,
  userId: 1,
  title: 'Groceries',
  description: 'Milk, eggs',
  createdAt: new Date(2026, 1, 1).toISOString(),
  editedAt: new Date(2026, 1, 2).toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StickyNoteCard', () => {
  it('renders the note title and description in display mode', () => {
    render(<StickyNoteCard note={note} onSave={vi.fn()} />);

    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('Milk, eggs')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('starts the draft variant (no note) in edit mode', () => {
    render(<StickyNoteCard autoEdit onSave={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByPlaceholderText('Title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Take a note...')).toBeInTheDocument();
  });

  it('shows the empty hint for a note without content', () => {
    render(
      <StickyNoteCard
        note={{ ...note, title: '', description: '' }}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText('Take a note...')).toBeInTheDocument();
  });

  it('enters edit mode when the card body is clicked and restores values', async () => {
    const user = userEvent.setup();
    render(<StickyNoteCard note={note} onSave={vi.fn()} />);

    await user.click(screen.getByText('Groceries'));

    const title = screen.getByPlaceholderText('Title');
    expect(title).toHaveValue('Groceries');
    expect(screen.getByPlaceholderText('Take a note...')).toHaveValue(
      'Milk, eggs'
    );
  });

  it('saves trimmed values and leaves edit mode', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<StickyNoteCard note={note} onSave={onSave} />);

    await user.click(screen.getByText('Groceries'));
    await user.clear(screen.getByPlaceholderText('Title'));
    await user.type(screen.getByPlaceholderText('Title'), '  Shopping  ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        title: 'Shopping',
        description: 'Milk, eggs',
      })
    );
    // Back to display mode after a successful save: the card reflects the
    // (parent-owned) note prop, not the edited draft.
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Title')).not.toBeInTheDocument()
    );
    expect(screen.getByText('Groceries')).toBeInTheDocument();
  });

  it('disables the actions and stays in edit mode while the save is in flight', async () => {
    const user = userEvent.setup();
    let resolveSave!: () => void;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        })
    );
    render(<StickyNoteCard note={note} onSave={onSave} />);

    await user.click(screen.getByText('Groceries'));
    await user.type(screen.getByPlaceholderText('Title'), '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    // The editor stays open until the save resolves.
    expect(screen.getByPlaceholderText('Title')).toHaveValue('Groceries!');

    resolveSave();
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Title')).not.toBeInTheDocument()
    );
  });

  it('treats saving an all-empty card as a cancel that restores the note', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<StickyNoteCard note={note} onSave={onSave} />);

    await user.click(screen.getByText('Groceries'));
    await user.clear(screen.getByPlaceholderText('Title'));
    await user.clear(screen.getByPlaceholderText('Take a note...'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText('Title')).not.toBeInTheDocument();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
  });

  it('treats saving an all-empty draft as a discard', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onSave = vi.fn();
    render(<StickyNoteCard autoEdit onSave={onSave} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('cancels editing with Escape and restores the original note', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<StickyNoteCard note={note} onSave={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByText('Groceries'));
    await user.type(screen.getByPlaceholderText('Title'), ' changed');
    await user.type(screen.getByPlaceholderText('Title'), '{Escape}');

    expect(screen.queryByPlaceholderText('Title')).not.toBeInTheDocument();
    // The original values come back.
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('saves with Ctrl+Enter from the keyboard', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<StickyNoteCard note={note} onSave={onSave} />);

    await user.click(screen.getByText('Groceries'));
    await user.type(
      screen.getByPlaceholderText('Title'),
      '{Control>}{Enter}{/Control}'
    );

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it('calls onDelete from the corner cross', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<StickyNoteCard note={note} onSave={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: 'Delete note' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('does not render the delete cross without onDelete', () => {
    render(<StickyNoteCard note={note} onSave={vi.fn()} />);

    expect(
      screen.queryByRole('button', { name: 'Delete note' })
    ).not.toBeInTheDocument();
  });
});
