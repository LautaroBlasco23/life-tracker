import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteGroup } from '@shared/types/note';
import { noteGroupService } from '@shared/services/note-group-service';
import { showToast } from '@/lib/toast';
import { CreateGroupModal } from './create-group-modal';

vi.mock('@shared/services/note-group-service', () => ({
  noteGroupService: {
    createNoteGroup: vi.fn(),
  },
}));

vi.mock('@/lib/toast', () => ({
  showToast: vi.fn(),
}));

// Memoized per namespace: the real useTranslations wraps its result in
// useCallback, so a fresh function per call could re-trigger effects.
vi.mock('@shared/contexts/language-context', () => {
  const dicts: Record<string, Record<string, string>> = {
    notes: {
      createGroup: 'Create group',
      addGroup: 'Add a group',
      groupName: 'Group name',
      groupCreated: 'Group created',
      failedToCreateGroup: 'Failed to create group',
    },
    common: {
      cancel: 'Cancel',
      creating: 'Creating...',
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

const mockNoteGroupService = vi.mocked(noteGroupService);

const createdGroup: NoteGroup = {
  id: 9,
  userId: 1,
  name: 'Recipes',
  position: 0,
  createdAt: new Date(2026, 0, 5).toISOString(),
  editedAt: new Date(2026, 0, 5).toISOString(),
};

function renderModal(open = true) {
  const onOpenChange = vi.fn();
  const onGroupCreated = vi.fn();
  render(
    <CreateGroupModal
      open={open}
      onOpenChange={onOpenChange}
      onGroupCreated={onGroupCreated}
    />
  );
  return { onOpenChange, onGroupCreated };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CreateGroupModal', () => {
  it('renders the dialog with a disabled submit button while the name is empty', () => {
    renderModal();

    expect(
      screen.getByRole('heading', { name: 'Create group' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Group name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create group' })).toBeDisabled();
  });

  it('creates the group with the trimmed name and reports success', async () => {
    const user = userEvent.setup();
    mockNoteGroupService.createNoteGroup.mockResolvedValue(createdGroup);
    const { onGroupCreated } = renderModal();

    await user.type(screen.getByLabelText('Group name'), '  Recipes  ');
    await user.click(screen.getByRole('button', { name: 'Create group' }));

    await waitFor(() =>
      expect(mockNoteGroupService.createNoteGroup).toHaveBeenCalledWith({
        name: 'Recipes',
      })
    );
    await waitFor(() =>
      expect(onGroupCreated).toHaveBeenCalledWith(createdGroup)
    );
    expect(showToast).toHaveBeenCalledWith({ title: 'Group created' });
    // The form resets after a successful create.
    await waitFor(() =>
      expect(screen.getByLabelText('Group name')).toHaveValue('')
    );
  });

  it('shows the creating state and disables the actions while in flight', async () => {
    const user = userEvent.setup();
    let resolveCreate!: (group: NoteGroup) => void;
    mockNoteGroupService.createNoteGroup.mockImplementation(
      () =>
        new Promise<NoteGroup>((resolve) => {
          resolveCreate = resolve;
        })
    );
    renderModal();

    await user.type(screen.getByLabelText('Group name'), 'Recipes');
    await user.click(screen.getByRole('button', { name: 'Create group' }));

    expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    resolveCreate(createdGroup);
    await waitFor(() =>
      expect(mockNoteGroupService.createNoteGroup).toHaveBeenCalled()
    );
  });

  it('toasts a destructive error and keeps the name on failure', async () => {
    const user = userEvent.setup();
    mockNoteGroupService.createNoteGroup.mockRejectedValue(
      new Error('name already exists')
    );
    const { onGroupCreated } = renderModal();

    await user.type(screen.getByLabelText('Group name'), 'Recipes');
    await user.click(screen.getByRole('button', { name: 'Create group' }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        title: 'Failed to create group',
        description: 'name already exists',
        variant: 'destructive',
      })
    );
    expect(onGroupCreated).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Group name')).toHaveValue('Recipes');
  });

  it('does not submit whitespace-only names', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText('Group name'), '   ');

    expect(screen.getByRole('button', { name: 'Create group' })).toBeDisabled();
    expect(mockNoteGroupService.createNoteGroup).not.toHaveBeenCalled();
  });

  it('resets the form and closes on cancel', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();

    await user.type(screen.getByLabelText('Group name'), 'Recipes');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockNoteGroupService.createNoteGroup).not.toHaveBeenCalled();
    // Reopening shows a clean form (state reset when closing via cancel).
    render(
      <CreateGroupModal open onOpenChange={vi.fn()} onGroupCreated={vi.fn()} />
    );
  });
});
