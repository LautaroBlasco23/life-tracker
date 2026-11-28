import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Reminder } from '@shared/types/reminder';
import { ReminderSection } from './reminder-section';

// Pure display component: only the i18n context is mocked (per the
// calendar-event-modal convention); it drives every rendered label.

const mockMessages: Record<string, Record<string, string>> = {
  reminders: {
    title: 'Reminders',
    description: 'One-time tasks',
    remindersTotal: 'reminders',
    statusMissed: 'Missed',
    statusLocked: 'Locked',
    completeNow: 'Mark as completed',
    revertCompletion: 'Undo completion',
    completedLate: 'Completed late',
    completedAt: 'Completed {date}',
    dueBy: 'Due {date}',
    opensAt: 'Opens {date}',
    expired: 'Expired {date}',
    deleteReminder: 'Delete reminder',
  },
  common: { total: 'Total', delete: 'Delete' },
  deleteModal: {
    cannotBeUndone: 'This action cannot be undone.',
    areYouSure: 'Are you sure you want to delete "{name}"?',
    deleting: 'Deleting...',
  },
};

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

// Fixed tick: Oct 21 2026, 12:00 local time.
const now = new Date(2026, 9, 21, 12, 0);

function buildReminder(
  overrides: Partial<Reminder> & { id: number }
): Reminder {
  return {
    userId: 1,
    title: `Reminder ${overrides.id}`,
    description: '',
    dueAt: new Date(2026, 9, 21, 15, 0).toISOString(),
    activeFrom: null,
    completedAt: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

const activeReminder = buildReminder({
  id: 1,
  title: 'Water the plants',
  description: 'They are thirsty',
});
const missedReminder = buildReminder({
  id: 2,
  title: 'Take out trash',
  dueAt: new Date(2026, 9, 21, 9, 0).toISOString(), // 3h before `now`
});
const lockedReminder = buildReminder({
  id: 3,
  title: 'Start laundry',
  dueAt: new Date(2026, 9, 21, 18, 0).toISOString(),
  activeFrom: new Date(2026, 9, 21, 14, 0).toISOString(), // unlocks in 2h
});
const completedReminder = buildReminder({
  id: 4,
  title: 'Call the bank',
  dueAt: new Date(2026, 9, 21, 10, 30).toISOString(),
  completedAt: new Date(2026, 9, 21, 10, 0).toISOString(), // same day, on time
});
const completedLateReminder = buildReminder({
  id: 5,
  title: 'Pay the rent',
  dueAt: new Date(2026, 9, 21, 10, 30).toISOString(),
  completedAt: new Date(2026, 9, 22, 10, 0).toISOString(), // next day → late
});

function renderSection(
  reminders: Reminder[],
  processingIds: Set<number> = new Set()
) {
  return render(
    <ReminderSection
      reminders={reminders}
      now={now}
      processingIds={processingIds}
      onComplete={vi.fn()}
      onRevert={vi.fn()}
      onDelete={vi.fn()}
      onEdit={vi.fn()}
    />
  );
}

describe('ReminderSection', () => {
  it('renders nothing when there are no reminders', () => {
    const { container } = renderSection([]);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the total and sorts cards by status (missed → active → locked → completed)', () => {
    const { container } = renderSection([
      completedReminder,
      lockedReminder,
      activeReminder,
      missedReminder,
    ]);

    // itemName is already plural, so CategoryHeader appends another "s".
    expect(screen.getByText('4 reminderss')).toBeInTheDocument();

    const titles = [
      'Take out trash',
      'Water the plants',
      'Start laundry',
      'Call the bank',
    ].map((title) => screen.getByText(title));

    for (let i = 0; i < titles.length - 1; i += 1) {
      expect(
        titles[i].compareDocumentPosition(titles[i + 1]) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
    expect(container).toBeDefined();
  });

  it('sorts completed cards by most recently completed first', () => {
    renderSection([completedReminder, completedLateReminder]);

    const titles = ['Pay the rent', 'Call the bank'].map((title) =>
      screen.getByText(title)
    );
    expect(
      titles[0].compareDocumentPosition(titles[1]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('shows the due badge and countdown for an active reminder', () => {
    renderSection([activeReminder]);

    expect(screen.getAllByText(/Due Oct 21, 3:00 PM/)).toHaveLength(2); // badge + countdown label
    expect(screen.getByText('3h 0m')).toBeInTheDocument(); // 12:00 → 15:00
    expect(screen.queryByText('Missed')).not.toBeInTheDocument();
    expect(screen.queryByText('Locked')).not.toBeInTheDocument();
  });

  it('shows the opens-at badge and countdown for a locked reminder', () => {
    renderSection([lockedReminder]);

    expect(screen.getAllByText(/Opens Oct 21, 2:00 PM/)).toHaveLength(2);
    expect(screen.getByText('2h 0m')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });

  it('shows the expired badge for a missed reminder', () => {
    renderSection([missedReminder]);

    expect(screen.getByText('Missed')).toBeInTheDocument();
    expect(screen.getByText(/Expired Oct 21, 9:00 AM/)).toBeInTheDocument();
    expect(screen.queryByText(/3h 0m/)).not.toBeInTheDocument();
  });

  it('shows the completed-at time and the late flag only for late completions', () => {
    const { unmount } = renderSection([completedReminder]);
    // Same day as the deadline → time only, and no "Completed late" flag.
    expect(screen.getByText(/Completed 10:00 AM/)).toBeInTheDocument();
    expect(screen.queryByText('Completed late')).not.toBeInTheDocument();
    unmount();

    renderSection([completedLateReminder]);
    // Completed on a later day → full date plus the late badge.
    expect(screen.getByText(/Completed Oct 22, 10:00 AM/)).toBeInTheDocument();
    expect(screen.getByText('Completed late')).toBeInTheDocument();
  });

  it('completes an active reminder when its card is clicked', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(
      <ReminderSection
        reminders={[activeReminder]}
        now={now}
        processingIds={new Set()}
        onComplete={onComplete}
        onRevert={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    await user.click(screen.getByText('Water the plants'));

    expect(onComplete).toHaveBeenCalledWith(activeReminder);
  });

  it('does not offer completing a locked reminder from the card', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(
      <ReminderSection
        reminders={[lockedReminder]}
        now={now}
        processingIds={new Set()}
        onComplete={onComplete}
        onRevert={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    await user.click(screen.getByText('Start laundry'));

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('offers "Mark as completed" in the menu of an active reminder', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(
      <ReminderSection
        reminders={[activeReminder]}
        now={now}
        processingIds={new Set()}
        onComplete={onComplete}
        onRevert={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByText('Mark as completed'));

    expect(onComplete).toHaveBeenCalledWith(activeReminder);
  });

  it('offers "Undo completion" only on completed reminders', async () => {
    const onRevert = vi.fn();
    const user = userEvent.setup();
    render(
      <ReminderSection
        reminders={[completedReminder]}
        now={now}
        processingIds={new Set()}
        onComplete={vi.fn()}
        onRevert={onRevert}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.queryByText('Mark as completed')).not.toBeInTheDocument();
    await user.click(screen.getByText('Undo completion'));

    expect(onRevert).toHaveBeenCalledWith(completedReminder);
  });

  it('disables menu actions while the reminder is processing', async () => {
    const user = userEvent.setup();
    renderSection([activeReminder], new Set([activeReminder.id]));

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    // Radix marks disabled menu items with aria-disabled, not the attribute.
    expect(
      screen.getByText('Mark as completed').closest('[role="menuitem"]')
    ).toHaveAttribute('aria-disabled', 'true');
  });

  it('edits a reminder from the card menu', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(
      <ReminderSection
        reminders={[activeReminder]}
        now={now}
        processingIds={new Set()}
        onComplete={vi.fn()}
        onRevert={vi.fn()}
        onDelete={vi.fn()}
        onEdit={onEdit}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByText('Edit'));

    expect(onEdit).toHaveBeenCalledWith(activeReminder);
  });

  it('deletes a reminder through the confirm modal', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <ReminderSection
        reminders={[activeReminder]}
        now={now}
        processingIds={new Set()}
        onComplete={vi.fn()}
        onRevert={vi.fn()}
        onDelete={onDelete}
        onEdit={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByText('Delete'));

    expect(
      await screen.findByText(
        'Are you sure you want to delete "Water the plants"?'
      )
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete reminder' }));

    expect(onDelete).toHaveBeenCalledWith(activeReminder.id);
  });
});
