import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Activity } from '@shared/types/activity';
import { DeleteActivityModal } from './delete-activity-modal';

vi.mock('@shared/contexts/language-context', () => ({
  useTranslations:
    (namespace: string) =>
    (key: string, params?: Record<string, string | number>) => {
      const text = mockMessages[namespace]?.[key] ?? `${namespace}.${key}`;
      if (!params) return text;
      return text.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in params ? String(params[name]) : match
      );
    },
}));

const mockMessages: Record<string, Record<string, string>> = {
  activities: {
    deleteActivity: 'Delete Activity',
    daily: 'Daily',
    morning: 'Morning',
    target: 'Target:',
  },
  common: {
    cancel: 'Cancel',
    deleting: 'Deleting...',
    cannotBeUndone: 'This action cannot be undone.',
    areYouSure: 'Are you sure you want to delete "{name}"?',
  },
};

const activity: Activity = {
  id: 4,
  userId: 1,
  title: 'Morning run',
  description: '5k around the park',
  completionAmount: 2,
  frequency: 'daily',
  dayTime: 'morning',
  isActive: true,
  createdAt: '',
  updatedAt: '',
  todayCompletions: 0,
  isCompletedToday: false,
};

function renderModal(
  onConfirmDelete: () => Promise<void> = vi.fn().mockResolvedValue(undefined)
) {
  const onOpenChange = vi.fn();
  render(
    <DeleteActivityModal
      open
      onOpenChange={onOpenChange}
      activity={activity}
      onConfirmDelete={onConfirmDelete}
    />
  );
  return { onOpenChange, onConfirmDelete };
}

describe('DeleteActivityModal', () => {
  it('renders nothing without an activity', () => {
    const { container } = render(
      <DeleteActivityModal
        open
        onOpenChange={vi.fn()}
        activity={null}
        onConfirmDelete={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the activity details and the confirmation copy', () => {
    renderModal();

    expect(screen.getByRole('dialog')).toHaveTextContent('Delete Activity');
    expect(
      screen.getByText('This action cannot be undone.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Are you sure you want to delete "Morning run"?')
    ).toBeInTheDocument();
    expect(screen.getByText('5k around the park')).toBeInTheDocument();
    expect(screen.getByText(/Daily • Morning • .*Target:/)).toBeInTheDocument();
    expect(screen.getByText(/2$/)).toBeInTheDocument();
  });

  it('confirms the deletion and closes', async () => {
    const user = userEvent.setup();
    const { onOpenChange, onConfirmDelete } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Delete Activity' }));

    expect(onConfirmDelete).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('stays open and keeps the state when the deletion fails', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal(
      vi.fn().mockRejectedValue(new Error('failed'))
    );

    await user.click(screen.getByRole('button', { name: 'Delete Activity' }));

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('closes on cancel without confirming', async () => {
    const user = userEvent.setup();
    const { onOpenChange, onConfirmDelete } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirmDelete).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
