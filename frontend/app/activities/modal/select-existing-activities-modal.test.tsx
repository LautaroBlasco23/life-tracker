import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Activity } from '@shared/types/activity';
import { activityService } from '@shared/services/activity-service';
import { showToast } from '@/lib/toast';
import {
  SelectExistingActivitiesModal,
  type SelectedActivityRef,
} from './select-existing-activities-modal';

vi.mock('@shared/services/activity-service', () => ({
  activityService: {
    getActivities: vi.fn(),
  },
}));

vi.mock('@/lib/toast', () => ({ showToast: vi.fn() }));

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
  routines: {
    selectExistingTitle: 'Select Activities',
    selectExistingDescription: 'Choose from activities you already created.',
    selectExistingConfirm: 'Add Selected',
    noExistingToSelect: "You don't have any activities yet.",
    failedToLoadActivities: 'Failed to load activities',
  },
  activities: {
    daily: 'Daily',
    morning: 'Morning',
    notSpecified: 'Any Moment',
  },
  common: { cancel: 'Cancel', loading: 'Loading...' },
};

function buildActivity(
  overrides: Partial<Activity> & { id: number }
): Activity {
  return {
    userId: 1,
    title: `Activity ${overrides.id}`,
    description: '',
    completionAmount: 1,
    frequency: 'daily',
    dayTime: 'notSpecified',
    isActive: true,
    createdAt: '',
    updatedAt: '',
    todayCompletions: 0,
    isCompletedToday: false,
    ...overrides,
  };
}

const availableActivities = [
  buildActivity({ id: 1, title: 'Morning run', dayTime: 'morning' }),
  buildActivity({ id: 2, title: 'Read a book' }),
  buildActivity({ id: 3, title: 'Evening walk' }),
];

function baseProps() {
  return {
    open: true,
    onOpenChange: vi.fn(),
    selectedIds: [] as number[],
    onConfirm: vi.fn() as (activities: SelectedActivityRef[]) => void,
  };
}

describe('SelectExistingActivitiesModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(activityService.getActivities).mockResolvedValue(
      availableActivities
    );
  });

  it('shows a loading state before the activities arrive', async () => {
    vi.mocked(activityService.getActivities).mockReturnValue(
      new Promise(() => undefined)
    );
    render(<SelectExistingActivitiesModal {...baseProps()} />);

    expect(await screen.findByText('Loading...')).toBeInTheDocument();
  });

  it('loads the activities and pre-checks the passed ids', async () => {
    render(
      <SelectExistingActivitiesModal {...baseProps()} selectedIds={[2]} />
    );

    expect(await screen.findByText('Morning run')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Read a book/ })).toBeChecked();
    expect(activityService.getActivities).toHaveBeenCalled();
  });

  it('toggles checkboxes and confirms with the full checked set', async () => {
    const props = baseProps();
    const user = userEvent.setup();
    render(<SelectExistingActivitiesModal {...props} selectedIds={[2]} />);

    const first = await screen.findByRole('checkbox', { name: /Morning run/ });
    const third = screen.getByRole('checkbox', { name: /Evening walk/ });
    await user.click(first);
    await user.click(third);

    expect(first).toBeChecked();
    expect(third).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Add Selected' }));

    // The confirm set keeps the activities' original order.
    expect(props.onConfirm).toHaveBeenCalledWith([
      { id: 1, title: 'Morning run' },
      { id: 2, title: 'Read a book' },
      { id: 3, title: 'Evening walk' },
    ]);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('confirms an empty selection without pre-checked ids', async () => {
    const props = baseProps();
    const user = userEvent.setup();
    render(<SelectExistingActivitiesModal {...props} />);

    await user.click(
      await screen.findByRole('button', { name: 'Add Selected' })
    );

    expect(props.onConfirm).toHaveBeenCalledWith([]);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows a destructive toast when loading fails', async () => {
    vi.mocked(activityService.getActivities).mockRejectedValue(
      new Error('boom')
    );
    render(<SelectExistingActivitiesModal {...baseProps()} />);

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to load activities',
          description: 'boom',
          variant: 'destructive',
        })
      )
    );
  });

  it('shows the empty state when there is nothing to select', async () => {
    vi.mocked(activityService.getActivities).mockResolvedValue([]);
    render(<SelectExistingActivitiesModal {...baseProps()} />);

    expect(
      await screen.findByText("You don't have any activities yet.")
    ).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('closes with the cancel button without confirming', async () => {
    const props = baseProps();
    const user = userEvent.setup();
    render(<SelectExistingActivitiesModal {...props} />);

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });
});
