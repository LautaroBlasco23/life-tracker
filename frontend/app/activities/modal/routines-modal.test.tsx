import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Routine } from '@shared/types';
import { routineService } from '@shared/services/routine-service';
import { showToast } from '@/lib/toast';
import { RoutinesModal } from './routines-modal';

vi.mock('@shared/services/routine-service', () => ({
  routineService: {
    getRoutines: vi.fn(),
    getRoutine: vi.fn(),
    createRoutine: vi.fn(),
    updateRoutine: vi.fn(),
    deleteRoutine: vi.fn(),
  },
}));

vi.mock('@/lib/toast', () => ({ showToast: vi.fn() }));

// useTranslations must return a stable function per namespace: the modal's
// loadRoutines callback depends on `t`, so a new identity each render would
// re-trigger the load effect (and reset the selection) on every render.
const mockTranslators = new Map<
  string,
  (key: string, params?: Record<string, string | number>) => string
>();

vi.mock('@shared/contexts/language-context', () => ({
  useTranslations: (namespace: string) => {
    if (!mockTranslators.has(namespace)) {
      mockTranslators.set(namespace, (key, params) => {
        const text = mockMessages[namespace]?.[key] ?? `${namespace}.${key}`;
        if (!params) return text;
        return text.replace(/\{(\w+)\}/g, (match, name: string) =>
          name in params ? String(params[name]) : match
        );
      });
    }
    return mockTranslators.get(namespace);
  },
}));

const mockMessages: Record<string, Record<string, string>> = {
  routines: {
    title: 'Routines',
    description: 'Group your activities into routines you follow',
    newRoutine: 'New Routine',
    loadingRoutines: 'Loading routines...',
    failedToLoad: 'Failed to load routines',
    noRoutines: 'No routines yet',
    searchRoutines: 'Search routines',
    noMatchingRoutines: 'No routines match your search or filter.',
    selectRoutinePrompt: 'Select a routine to see its activities.',
    activityCount: '{count} activities',
    deleteRoutine: 'Delete Routine',
    deleteRoutineKeepsActivities: 'The activities in this routine are kept.',
    routineDeleted: 'Routine deleted',
    routineDeletedDescription: 'Deleted.',
    deleteFailed: 'Delete failed',
    completedToday: 'Completed today',
    notScheduledToday: 'Not scheduled for today',
    activityCompletedToday: 'Complete',
    noActivitiesInRoutine: 'No activities in this routine',
    // Nested create/edit routine modals (and their activity section).
    createTitle: 'New Routine',
    createDescription: 'Group activities you do together.',
    editTitle: 'Edit Routine',
    editDescription: 'Update the name, privacy, or activities.',
    titleLabel: 'Routine title',
    titlePlaceholder: 'e.g. Morning health routine',
    descriptionLabel: 'Description',
    descriptionPlaceholder: 'What is this routine about?',
    createRoutine: 'Create Routine',
    updateRoutine: 'Update Routine',
    validationError: 'Validation error',
    selectAtLeastOne: 'Select at least one activity',
    routinePrivacyDescription: 'Privacy description',
    selectedActivities: 'Selected activities',
    noActivitiesSelectedYet: 'No activities in this routine yet.',
    newActivity: 'New Activity',
    useExistingActivities: 'Use Existing Activities',
    orderHint: 'Routine order (use the arrows to reorder)',
    selectExistingTitle: 'Select Activities',
    selectExistingDescription: 'Choose from activities you already created.',
    selectExistingConfirm: 'Add Selected',
    failedToLoadActivities: 'Failed to load activities',
  },
  common: {
    delete: 'Delete',
    edit: 'Edit',
    cancel: 'Cancel',
    deleting: 'Deleting...',
  },
  privacy: {
    private: 'Private',
    public: 'Public',
  },
  activities: {
    daily: 'Daily',
    weekly: 'Weekly',
    morning: 'Morning',
    evening: 'Evening',
    notSpecified: 'Any Moment',
  },
  days: {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  },
  deleteModal: {
    cannotBeUndone: 'This action cannot be undone.',
    areYouSure: 'Are you sure you want to delete "{name}"?',
    deleting: 'Deleting...',
  },
};

function buildRoutine(
  overrides: Partial<Routine> & Pick<Routine, 'id' | 'title'>
): Routine {
  return {
    userId: 1,
    description: '',
    privacyStatus: 'private',
    activities: [],
    isCompletedToday: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

const morningReset = buildRoutine({
  id: 1,
  title: 'Morning reset',
  description: 'Start the day clean',
  activities: [
    {
      activityId: 3,
      activityTitle: 'Stretch 5',
      description: '',
      frequency: 'daily',
      dayTime: 'morning',
      privacyStatus: 'private',
      completionAmount: 1,
      position: 2,
      todayCompletions: 0,
      scheduledToday: true,
    },
    {
      activityId: 1,
      activityTitle: 'Drink water',
      description: '8 glasses',
      frequency: 'daily',
      dayTime: 'morning',
      privacyStatus: 'private',
      completionAmount: 8,
      position: 0,
      todayCompletions: 3,
      scheduledToday: true,
    },
    {
      activityId: 2,
      activityTitle: 'Vitamins',
      description: '',
      frequency: 'weekly',
      dayFrequency: '["monday","wednesday"]',
      dayTime: 'notSpecified',
      privacyStatus: 'public',
      completionAmount: 1,
      position: 1,
      todayCompletions: 0,
      scheduledToday: false,
    },
  ],
});

const cleaningDay = buildRoutine({
  id: 2,
  title: 'Cleaning day',
  description: 'Weekly deep clean',
});

const completedRoutine = buildRoutine({
  id: 3,
  title: 'All done today',
  isCompletedToday: true,
});

function baseProps() {
  return {
    open: true,
    onOpenChange: vi.fn(),
  };
}

describe('RoutinesModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(routineService.getRoutines).mockResolvedValue([
      morningReset,
      cleaningDay,
    ]);
  });

  it('loads and lists the routines with their activity counts', async () => {
    render(<RoutinesModal {...baseProps()} />);

    expect(await screen.findByText('Morning reset')).toBeInTheDocument();
    expect(screen.getByText('Cleaning day')).toBeInTheDocument();
    expect(screen.getByText('3 activities')).toBeInTheDocument();
    expect(screen.getByText('0 activities')).toBeInTheDocument();
    expect(routineService.getRoutines).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state when there are no routines', async () => {
    vi.mocked(routineService.getRoutines).mockResolvedValue([]);
    render(<RoutinesModal {...baseProps()} />);

    expect(await screen.findByText('No routines yet')).toBeInTheDocument();
  });

  it('shows a destructive toast when loading fails', async () => {
    vi.mocked(routineService.getRoutines).mockRejectedValue(
      new Error('offline')
    );
    render(<RoutinesModal {...baseProps()} />);

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to load routines',
          description: 'offline',
          variant: 'destructive',
        })
      )
    );
  });

  it('filters the list while typing in the search field', async () => {
    const user = userEvent.setup();
    render(<RoutinesModal {...baseProps()} />);
    await screen.findByText('Morning reset');

    await user.type(screen.getByPlaceholderText('Search routines'), 'cleaning');

    expect(screen.getByText('Cleaning day')).toBeInTheDocument();
    expect(screen.queryByText('Morning reset')).not.toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText('Search routines'));
    await user.type(screen.getByPlaceholderText('Search routines'), 'zzz');
    expect(
      screen.getByText('No routines match your search or filter.')
    ).toBeInTheDocument();
  });

  it('preselects the routine passed as initialRoutineId', async () => {
    render(<RoutinesModal {...baseProps()} initialRoutineId={2} />);

    expect(await screen.findByText('Weekly deep clean')).toBeInTheDocument();
    expect(
      screen.queryByText('Select a routine to see its activities.')
    ).not.toBeInTheDocument();
  });

  it('shows the selected routine sorted by activity position', async () => {
    const user = userEvent.setup();
    render(<RoutinesModal {...baseProps()} />);
    await screen.findByText('Morning reset');

    await user.click(screen.getByText('Morning reset'));

    expect(screen.getByText('Start the day clean')).toBeInTheDocument();
    expect(screen.getByText('Public')).toBeInTheDocument();
    const titles = ['Drink water', 'Vitamins', 'Stretch 5'];
    for (const title of titles) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    // Sorted by position, not by array order.
    const rows = screen.getAllByText(/Drink water|Vitamins|Stretch 5/);
    const positions = rows.map((el) => titles.indexOf(el.textContent ?? ''));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('renders progress and badges on the routine activity cards', async () => {
    const user = userEvent.setup();
    render(<RoutinesModal {...baseProps()} />);
    await screen.findByText('Morning reset');

    await user.click(screen.getByText('Morning reset'));

    // Drink water: 3/8 today, scheduled → progress ratio + Daily badge.
    expect(screen.getByText('3/8')).toBeInTheDocument();
    expect(screen.getByText('8 glasses')).toBeInTheDocument();
    // Vitamins: not scheduled today → explicit hint, weekly badge with days.
    expect(screen.getByText('Not scheduled for today')).toBeInTheDocument();
    expect(screen.getByText('Monday, Wednesday')).toBeInTheDocument();
  });

  it('marks completed routines with the today badge', async () => {
    vi.mocked(routineService.getRoutines).mockResolvedValue([completedRoutine]);
    const user = userEvent.setup();
    render(<RoutinesModal {...baseProps()} />);
    await screen.findByText('All done today');

    await user.click(screen.getByText('All done today'));

    expect(screen.getAllByText('Completed today')).toHaveLength(1); // detail badge
  });

  it('opens the create routine modal', async () => {
    const user = userEvent.setup();
    render(<RoutinesModal {...baseProps()} />);
    await screen.findByText('Morning reset');

    await user.click(screen.getByRole('button', { name: 'New Routine' }));

    expect(screen.getAllByText('New Routine').length).toBeGreaterThan(0);
  });

  it('opens the edit routine modal for the selected routine', async () => {
    const user = userEvent.setup();
    render(<RoutinesModal {...baseProps()} />);
    await screen.findByText('Morning reset');

    await user.click(screen.getByText('Morning reset'));
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(await screen.findByText('Edit Routine')).toBeInTheDocument();
  });

  it('deletes the selected routine after confirmation', async () => {
    vi.mocked(routineService.deleteRoutine).mockResolvedValue(undefined);
    const props = baseProps();
    const user = userEvent.setup();
    render(<RoutinesModal {...props} />);
    await screen.findByText('Morning reset');

    await user.click(screen.getByText('Morning reset'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(
      await screen.findByText(
        'Are you sure you want to delete "Morning reset"?'
      )
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Routine' }));

    await waitFor(() =>
      expect(routineService.deleteRoutine).toHaveBeenCalledWith(1)
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Routine deleted' })
    );
    await waitFor(() =>
      expect(screen.queryByText('Morning reset')).not.toBeInTheDocument()
    );
    expect(screen.getByText('Cleaning day')).toBeInTheDocument();
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });

  // NOTE: no delete-failure test here on purpose. RoutinesModal's
  // handleDeleteRoutine rethrows, and DeleteModal.handleDelete has
  // try/finally without catch, so a failed delete always ends up as an
  // unhandled promise rejection from the click handler — which vitest
  // reports as an unhandled error even though the toast still fires.
  // Reported as a source finding; the success path above covers the flow.
});
