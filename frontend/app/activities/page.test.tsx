import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Activity } from '@shared/types/activity';
import type { Reminder } from '@shared/types/reminder';
import type { StreakInfo } from '@shared/types/activity';
import { activityService } from '@shared/services/activity-service';
import { reminderService } from '@shared/services/reminder-service';
import { authService } from '@shared/services/auth-service';
import { showToast } from '@/lib/toast';
import { ACTIVITY_TEMPLATES } from '@shared/lib/activity-templates';
import ActivitiesPage from './page';

// Page-level tests: services, auth and heavy shell components are mocked so
// the test focuses on the page's own state orchestration. The three modals
// are stubbed with prop-capturing drivers (they have dedicated test files).

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@shared/services/activity-service', () => ({
  activityService: {
    getTodayActivities: vi.fn(),
    getActivities: vi.fn(),
    createActivity: vi.fn(),
    updateActivity: vi.fn(),
    deleteActivity: vi.fn(),
    recordActivity: vi.fn(),
    revertLastCompletion: vi.fn(),
    getGlobalStreak: vi.fn(),
  },
}));

vi.mock('@shared/services/reminder-service', () => ({
  reminderService: {
    getReminders: vi.fn(),
    createReminder: vi.fn(),
    updateReminder: vi.fn(),
    completeReminder: vi.fn(),
    revertCompletion: vi.fn(),
    deleteReminder: vi.fn(),
  },
}));

vi.mock('@shared/services/auth-service', () => ({
  authService: {
    isAuthenticated: vi.fn(),
    onAuthChange: vi.fn(() => () => undefined),
  },
}));

vi.mock('@/lib/toast', () => ({ showToast: vi.fn() }));

vi.mock('@/components/navigation', () => ({
  Navigation: () => <nav data-testid="navigation" />,
}));

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

vi.mock('@/components/ui/filterModal/filterSidebar', () => ({
  FilterSidebar: (props: {
    open?: boolean;
    onApplyFilter?: (filter: Record<string, string | undefined>) => void;
  }) => {
    if (!props.open) return null;
    return (
      <div data-testid="filter-sidebar">
        <button onClick={() => props.onApplyFilter?.({ frequency: 'weekly' })}>
          apply-frequency
        </button>
        <button
          onClick={() => props.onApplyFilter?.({ scheduledFor: '2026-10-15' })}
        >
          apply-date
        </button>
        <button onClick={() => props.onApplyFilter?.({})}>apply-empty</button>
      </div>
    );
  },
}));

vi.mock('./modal/activity-form-modal', () => ({
  ActivityFormModal: (props: {
    open?: boolean;
    activity?: { id: number } | null;
    reminder?: { id: number } | null;
    initialValues?: { title?: string } | null;
    onActivityCreated?: (activity: Activity) => void;
    onActivityUpdated?: (activity: Activity) => void;
    onOpenChange?: (open: boolean) => void;
  }) => {
    mockFormProps.push(props);
    if (!props.open) return null;
    return (
      <div data-testid="activity-form-modal">
        <span data-testid="form-activity-id">{props.activity?.id ?? ''}</span>
        <span data-testid="form-reminder-id">{props.reminder?.id ?? ''}</span>
        <span data-testid="form-initial-title">
          {props.initialValues?.title ?? ''}
        </span>
        <button onClick={() => props.onActivityCreated?.(mockCreatedActivity)}>
          trigger-create
        </button>
        <button onClick={() => props.onActivityUpdated?.(mockCreatedActivity)}>
          trigger-update
        </button>
      </div>
    );
  },
}));

vi.mock('./modal/routines-modal', () => ({
  RoutinesModal: (props: { open?: boolean }) => {
    mockRoutinesProps.push(props);
    return props.open ? (
      <div data-testid="routines-modal-open" />
    ) : (
      <div data-testid="routines-modal-closed" />
    );
  },
}));

vi.mock('./modal/templates-modal', () => ({
  TemplatesModal: (props: {
    open?: boolean;
    onCustomize?: (template: unknown) => void;
  }) => {
    mockTemplatesProps.push(props);
    if (!props.open) return null;
    return (
      <button onClick={() => props.onCustomize?.(mockTemplate)}>
        trigger-customize
      </button>
    );
  },
}));

const mockMessages: Record<string, Record<string, string>> = {
  activities: {
    title: "Today's Activities",
    titleFiltered: 'Filtered Activities',
    titleForDate: 'Activities for {date}',
    description: 'Track and complete your activities for today',
    descriptionFiltered: 'All activities',
    descriptionShowing: 'Showing: {parts}',
    newActivity: 'New Activity',
    loadingActivities: 'Loading activities...',
    failedToLoad: 'Failed to load activities',
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
    anyMoment: 'Any Moment',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    noActivitiesForToday: 'No activities for today',
    noActivitiesMatch: 'No activities match your filters',
    createToSeeHere: 'Create activities to see them appear here',
    tryAdjustingFilters: 'Try adjusting your filters',
    createFirstActivity: 'Create your first activity',
    activityComplete: 'Activity Complete',
    activityAlreadyCompleted: 'Already completed for {date}!',
    activityCompleted: 'Activity Completed!',
    greatJob: 'Great job with {title} for {date}',
    progressUpdated: 'Progress Updated',
    progress: 'Progress: {current}/{total}',
    completionReverted: 'Completion Reverted',
    revertedDescription: 'Removed one completion from {title} for {date}',
    activityDeleted: 'Activity deleted',
    activityDeletedDescription: 'Removed',
    deleteFailed: 'Delete failed',
    deleteActivity: 'Delete Activity',
    revertLast: 'Revert Last',
    complete: 'Complete',
    tapToComplete: 'Tap to complete',
    target: 'Target:',
    frequency: 'Frequency',
    timeOfDay: 'Time of Day',
    scheduledFor: 'Scheduled For Date',
    showForDate: 'Show for a date',
    allFrequencies: 'All frequencies',
    allTimes: 'All times',
    globalStreakTitle: 'All activities streak',
    globalStreak: '{count} day(s) in a row',
    globalStreakLongest: 'Longest streak: {count} days',
    filterActivities: 'Filter Activities',
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
  routines: {
    title: 'Routines',
    failedToLoad: 'Failed to load routines',
  },
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
    reminderComplete: 'Reminder completed',
    reminderCompletedDescription: '"{title}" is done.',
    completionReverted: 'Completion reverted',
    revertDescription: '"{title}" is pending again.',
    reminderDeleted: 'Reminder deleted',
    reminderDeletedDescription: 'Removed.',
    deleteFailed: 'Delete failed',
  },
  common: {
    filters: 'Filters',
    clearAll: 'Clear all',
    clearFilters: 'Clear filters',
    activeFilters: 'Active filters:',
    error: 'Error',
    total: 'Total',
    delete: 'Delete',
    edit: 'Edit',
    cancel: 'Cancel',
    loading: 'Loading...',
  },
  activityTemplates: {
    button: 'Templates',
    template_drinkWater: 'Drink water',
    created: 'Created',
    createdDescription: '{count} items were added.',
    partialFailure: 'Some failed',
    partialFailureDescription: '{created} created, {failed} failed.',
  },
  deleteModal: {
    cannotBeUndone: 'This action cannot be undone.',
    areYouSure: 'Are you sure you want to delete "{name}"?',
    deleting: 'Deleting...',
  },
};

const mockRouter = vi.mocked(useRouter);

const mockCreatedActivity = buildActivity({
  id: 99,
  title: 'Created activity',
});
const mockTemplate = ACTIVITY_TEMPLATES[0];

const mockFormProps: Array<Record<string, unknown>> = [];
const mockRoutinesProps: Array<Record<string, unknown>> = [];
const mockTemplatesProps: Array<Record<string, unknown>> = [];

const streak: StreakInfo = { current: 3, longest: 5 };

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

const morningActivity = buildActivity({
  id: 1,
  title: 'Morning run',
  description: '5k around the park',
  completionAmount: 2,
  dayTime: 'morning',
  streak,
});
const eveningActivity = buildActivity({
  id: 2,
  title: 'Read a book',
  completionAmount: 1,
  frequency: 'weekly',
  dayFrequency: '["monday","friday"]',
  dayTime: 'evening',
  routines: [{ id: 5, title: 'Evening wind-down' }],
});

// Computed against the real clock because visibility depends on "today".
const todayAt = (hours: number) => {
  const nowDate = new Date();
  return new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate(),
    hours
  ).toISOString();
};

const pendingReminder: Reminder = {
  id: 11,
  userId: 1,
  title: 'Call mom',
  description: '',
  dueAt: todayAt(23),
  activeFrom: null,
  completedAt: null,
  createdAt: '',
  updatedAt: '',
};

async function renderPage() {
  const user = userEvent.setup();
  render(<ActivitiesPage />);
  // Wait past the initial loading state.
  await screen.findByText(/Today's Activities|Filtered Activities/);
  return user;
}

async function openCardMenu(
  title: string,
  user: Awaited<ReturnType<typeof renderPage>>
) {
  await user.click(screen.getByRole('button', { name: 'Open menu' }));
  // The only rendered card menu belongs to the activity with `title`.
  expect(screen.getByText(title)).toBeInTheDocument();
  return screen.getByText(title);
}

const recordFixture = {
  id: 'record-1',
  activityId: 1,
  userId: 1,
  completionDate: '',
  createdAt: '',
} as const;

describe('ActivitiesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFormProps.length = 0;
    mockRoutinesProps.length = 0;
    mockTemplatesProps.length = 0;
    mockRouter.mockReturnValue({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
      // Required by the AppRouterInstance type introduced in Next 16.
      bfcacheId: 'mock-bfcache-id',
    } as ReturnType<typeof useRouter>);
    vi.mocked(authService.isAuthenticated).mockReturnValue(true);
    vi.mocked(activityService.getGlobalStreak).mockResolvedValue({
      current: 0,
      longest: 0,
    });
    vi.mocked(reminderService.getReminders).mockResolvedValue([]);
  });

  it('shows the loading state while activities are being fetched', () => {
    vi.mocked(activityService.getTodayActivities).mockReturnValue(
      new Promise(() => undefined)
    );
    render(<ActivitiesPage />);
    expect(screen.getByText('Loading activities...')).toBeInTheDocument();
  });

  it('shows a destructive toast when loading fails', async () => {
    vi.mocked(activityService.getTodayActivities).mockRejectedValue(
      new Error('network down')
    );
    const user = userEvent.setup();
    render(<ActivitiesPage />);

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to load activities',
          description: 'network down',
          variant: 'destructive',
        })
      )
    );
    expect(
      await screen.findByText('No activities for today')
    ).toBeInTheDocument();
    expect(user).toBeDefined();
  });

  it('renders activities grouped by time-of-day category', async () => {
    vi.mocked(activityService.getTodayActivities).mockResolvedValue([
      morningActivity,
      eveningActivity,
    ]);
    await renderPage();

    expect(screen.getByText('Morning run')).toBeInTheDocument();
    expect(screen.getByText('Read a book')).toBeInTheDocument();
    expect(screen.getByText('Morning')).toBeInTheDocument();
    expect(screen.getByText('Evening')).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
    expect(screen.getByText('Monday, Friday')).toBeInTheDocument();
    expect(screen.getByText('0/2')).toBeInTheDocument();
  });

  it('opens the routines modal from the routine badge on a card', async () => {
    vi.mocked(activityService.getTodayActivities).mockResolvedValue([
      eveningActivity,
    ]);
    const user = await renderPage();

    await user.click(screen.getByText('Evening wind-down'));

    expect(mockRoutinesProps.at(-1)).toMatchObject({ open: true });
  });

  it('shows the empty state for the today view', async () => {
    vi.mocked(activityService.getTodayActivities).mockResolvedValue([]);
    await renderPage();

    expect(screen.getByText('No activities for today')).toBeInTheDocument();
    expect(
      screen.getByText('Create activities to see them appear here')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create your first activity' })
    ).toBeInTheDocument();
  });

  it('records a completion optimistically when a card is clicked', async () => {
    vi.mocked(activityService.getTodayActivities).mockResolvedValue([
      morningActivity,
    ]);
    vi.mocked(activityService.recordActivity).mockResolvedValue(recordFixture);
    const user = await renderPage();

    await user.click(screen.getByText('Morning run'));

    await waitFor(() =>
      expect(activityService.recordActivity).toHaveBeenCalledWith(1, {
        completionDate: undefined,
      })
    );
    expect(await screen.findByText('1/2')).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Progress Updated' })
    );
  });

  it('does not record again when the activity is already completed', async () => {
    vi.mocked(activityService.getTodayActivities).mockResolvedValue([
      buildActivity({
        id: 3,
        title: 'Done activity',
        completionAmount: 1,
        isCompletedToday: true,
        todayCompletions: 1,
      }),
    ]);
    const user = await renderPage();

    await user.click(screen.getByText('Done activity'));

    expect(activityService.recordActivity).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Activity Complete',
        description: expect.stringContaining('Already completed'),
      })
    );
  });

  it('restores the previous state when recording fails', async () => {
    vi.mocked(activityService.getTodayActivities).mockResolvedValue([
      morningActivity,
    ]);
    vi.mocked(activityService.recordActivity).mockRejectedValue(
      new Error('offline')
    );
    const user = await renderPage();

    await user.click(screen.getByText('Morning run'));

    await waitFor(() => expect(showToast).toHaveBeenCalled());
    expect(await screen.findByText('0/2')).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        description: 'offline',
        variant: 'destructive',
      })
    );
  });

  it('reverts the last completion from the card menu', async () => {
    vi.mocked(activityService.getTodayActivities).mockResolvedValue([
      buildActivity({
        id: 4,
        title: 'Recorded activity',
        todayCompletions: 1,
      }),
    ]);
    vi.mocked(activityService.revertLastCompletion).mockResolvedValue(
      undefined
    );
    const user = await renderPage();

    await openCardMenu('Recorded activity', user);
    await user.click(screen.getByText('Revert Last'));

    await waitFor(() =>
      expect(activityService.revertLastCompletion).toHaveBeenCalledWith(
        4,
        undefined
      )
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Completion Reverted' })
    );
  });

  it('deletes an activity through the confirm modal', async () => {
    vi.mocked(activityService.getTodayActivities).mockResolvedValue([
      morningActivity,
    ]);
    vi.mocked(activityService.deleteActivity).mockResolvedValue(undefined);
    const user = await renderPage();

    await openCardMenu('Morning run', user);
    await user.click(screen.getByText('Delete'));
    await user.click(
      await screen.findByRole('button', { name: 'Delete Activity' })
    );

    await waitFor(() =>
      expect(activityService.deleteActivity).toHaveBeenCalledWith(1)
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Activity deleted' })
    );
    expect(screen.queryByText('Morning run')).not.toBeInTheDocument();
  });

  it('shows the global streak banner only with a positive streak', async () => {
    vi.mocked(activityService.getTodayActivities).mockResolvedValue([]);
    vi.mocked(activityService.getGlobalStreak).mockResolvedValue({
      current: 4,
      longest: 9,
    });
    await renderPage();

    expect(screen.getByText('All activities streak')).toBeInTheDocument();
    expect(screen.getByText('4 day(s) in a row')).toBeInTheDocument();
    expect(screen.getByText('Longest streak: 9 days')).toBeInTheDocument();
  });

  it('hides the global streak banner when the streak is zero', async () => {
    vi.mocked(activityService.getTodayActivities).mockResolvedValue([]);
    await renderPage();

    expect(screen.queryByText('All activities streak')).not.toBeInTheDocument();
  });

  it('reloads today list after a creation in today mode', async () => {
    vi.mocked(activityService.getTodayActivities).mockResolvedValue([]);
    const user = await renderPage();

    await user.click(screen.getByRole('button', { name: 'New Activity' }));
    expect(screen.getByTestId('activity-form-modal')).toBeInTheDocument();

    await user.click(screen.getByText('trigger-create'));

    expect(showToast).not.toHaveBeenCalled(); // modal handles its own toast
    await waitFor(() =>
      expect(
        vi.mocked(activityService.getTodayActivities).mock.calls.length
      ).toBeGreaterThanOrEqual(2)
    );
    expect(screen.queryByTestId('activity-form-modal')).not.toBeInTheDocument();
  });

  it('appends the created activity when in filtered mode', async () => {
    vi.mocked(activityService.getTodayActivities).mockResolvedValue([]);
    vi.mocked(activityService.getActivities).mockResolvedValue([]);
    const user = await renderPage();

    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.click(screen.getByText('apply-frequency')); // → filtered view
    await user.click(screen.getByRole('button', { name: 'New Activity' }));
    await user.click(screen.getByText('trigger-create'));

    expect(await screen.findByText('Created activity')).toBeInTheDocument();
  });

  it('passes the clicked activity to the edit modal', async () => {
    vi.mocked(activityService.getTodayActivities).mockResolvedValue([
      morningActivity,
    ]);
    const user = await renderPage();

    await openCardMenu('Morning run', user);
    await user.click(screen.getByText('Edit'));

    expect(screen.getByTestId('form-activity-id')).toHaveTextContent('1');
  });

  it('switches to the filtered view and applies the filter to the service', async () => {
    vi.mocked(activityService.getTodayActivities).mockResolvedValue([]);
    vi.mocked(activityService.getActivities).mockResolvedValue([]);
    const user = await renderPage();

    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.click(screen.getByText('apply-frequency'));

    await waitFor(() =>
      expect(activityService.getActivities).toHaveBeenCalledWith({
        frequency: 'weekly',
      })
    );
    expect(screen.getByText('Filtered Activities')).toBeInTheDocument();
    expect(screen.getByText('Active filters:')).toBeInTheDocument();
    expect(screen.getByText('Weekly')).toBeInTheDocument();
  });

  it('shows the date title and clears the filters back to today', async () => {
    vi.mocked(activityService.getActivities).mockResolvedValue([]);
    const user = await renderPage();

    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.click(screen.getByText('apply-date'));

    expect(await screen.findByText(/Activities for/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(await screen.findByText("Today's Activities")).toBeInTheDocument();
    expect(activityService.getTodayActivities).toHaveBeenCalledTimes(2);
  });

  it('completes a pending reminder and refreshes its card', async () => {
    vi.mocked(activityService.getTodayActivities).mockResolvedValue([]);
    vi.mocked(reminderService.getReminders).mockResolvedValue([
      pendingReminder,
    ]);
    vi.mocked(reminderService.completeReminder).mockResolvedValue({
      ...pendingReminder,
      completedAt: new Date().toISOString(),
    });
    const user = await renderPage();

    expect(screen.getByText('Call mom')).toBeInTheDocument();
    await user.click(screen.getByText('Call mom'));

    await waitFor(() =>
      expect(reminderService.completeReminder).toHaveBeenCalledWith(11)
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Reminder completed' })
    );
  });

  it('pre-fills the create modal when customizing a template', async () => {
    vi.mocked(activityService.getTodayActivities).mockResolvedValue([]);
    const user = await renderPage();

    await user.click(screen.getByRole('button', { name: 'Templates' }));
    expect(mockTemplatesProps.at(-1)).toMatchObject({ open: true });

    await user.click(screen.getByText('trigger-customize'));

    expect(screen.getByTestId('activity-form-modal')).toBeInTheDocument();
    expect(screen.getByTestId('form-initial-title')).toHaveTextContent(
      'Drink water'
    );
    expect(screen.queryByText('trigger-customize')).not.toBeInTheDocument();
  });
});
