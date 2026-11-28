import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Activity, Routine } from '@shared/types';
import { activityService } from '@shared/services/activity-service';
import { routineService } from '@shared/services/routine-service';
import { showToast } from '@/lib/toast';
import { CreateRoutineModal } from './create-routine-modal';

vi.mock('@shared/services/routine-service', () => ({
  routineService: {
    createRoutine: vi.fn(),
  },
}));

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
    createTitle: 'New Routine',
    createDescription: 'Group activities you do together.',
    titleLabel: 'Routine title',
    titlePlaceholder: 'e.g. Morning health routine',
    descriptionLabel: 'Description',
    createRoutine: 'Create Routine',
    routineCreated: 'Routine created',
    routineCreatedDescription: 'Created.',
    createFailed: 'Failed to create routine',
    validationError: 'Validation error',
    selectAtLeastOne: 'Select at least one activity',
    routinePrivacyDescription: 'Privacy description',
    selectedActivities: 'Selected activities',
    noActivitiesSelectedYet: 'No activities in this routine yet.',
    newActivity: 'New Activity',
    useExistingActivities: 'Use Existing Activities',
    selectExistingTitle: 'Select Activities',
    selectExistingDescription: 'Choose from activities you already created.',
    selectExistingConfirm: 'Add Selected',
    orderHint: 'Routine order (use the arrows to reorder)',
  },
  activities: {
    daily: 'Daily',
    notSpecified: 'Any Moment',
    titleLabel: 'Title',
  },
  createActivity: {
    titleLabel: 'Title',
    titlePlaceholder: 'e.g., Morning Workout',
    createActivity: 'Create Activity',
    daily: 'Daily',
    anyMoment: 'Any Moment',
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
    creating: 'Creating...',
  },
  common: { cancel: 'Cancel', creating: 'Creating...', loading: 'Loading...' },
  privacy: {
    privacyStatus: 'Privacy Status',
    private: 'Private',
    public: 'Public',
  },
};

const createdRoutine = {
  id: 30,
  userId: 1,
  title: 'Morning health routine',
  description: '',
  privacyStatus: 'private',
  activities: [],
  isCompletedToday: false,
  createdAt: '',
  updatedAt: '',
} as Routine;

describe('CreateRoutineModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(routineService.createRoutine).mockResolvedValue(createdRoutine);
    vi.mocked(activityService.getActivities).mockResolvedValue([
      {
        id: 1,
        userId: 1,
        title: 'Morning run',
        description: '',
        completionAmount: 1,
        frequency: 'daily',
        dayTime: 'morning',
        isActive: true,
        createdAt: '',
        updatedAt: '',
        todayCompletions: 0,
        isCompletedToday: false,
      } as Activity,
      {
        ...({
          id: 2,
          title: 'Read a book',
        } as Activity),
      },
    ]);
  });

  it('renders the create form with the privacy select', () => {
    render(
      <CreateRoutineModal
        open
        onOpenChange={vi.fn()}
        onRoutineCreated={vi.fn()}
      />
    );

    expect(screen.getByText('New Routine')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('e.g. Morning health routine')
    ).toBeInTheDocument();
    expect(screen.getByText('Privacy description')).toBeInTheDocument();
  });

  it('requires at least one selected activity', async () => {
    const props = { onOpenChange: vi.fn(), onRoutineCreated: vi.fn() };
    const user = userEvent.setup();
    render(<CreateRoutineModal open {...props} />);

    await user.type(screen.getByLabelText('Routine title'), 'My routine');
    await user.click(screen.getByRole('button', { name: 'Create Routine' }));

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Validation error',
        description: 'Select at least one activity',
        variant: 'destructive',
      })
    );
    expect(routineService.createRoutine).not.toHaveBeenCalled();
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });

  it('creates the routine with the picked activities in order', async () => {
    const props = { onOpenChange: vi.fn(), onRoutineCreated: vi.fn() };
    const user = userEvent.setup();
    render(<CreateRoutineModal open {...props} />);

    await user.type(screen.getByLabelText('Routine title'), 'Morning health');
    await user.type(screen.getByLabelText('Description'), 'Kick off the day');

    // Pick two existing activities (returned in the activities list order).
    await user.click(screen.getByText('Use Existing Activities'));
    const readBook = await screen.findByRole('checkbox', {
      name: /Read a book/,
    });
    const morningRun = screen.getByRole('checkbox', { name: /Morning run/ });
    await user.click(readBook);
    await user.click(morningRun);
    await user.click(screen.getByRole('button', { name: 'Add Selected' }));

    await user.click(screen.getByRole('button', { name: 'Create Routine' }));

    await waitFor(() =>
      expect(routineService.createRoutine).toHaveBeenCalledWith({
        title: 'Morning health',
        description: 'Kick off the day',
        privacyStatus: 'private',
        activityIds: [
          { activityId: 1, position: 0 },
          { activityId: 2, position: 1 },
        ],
      })
    );
    expect(props.onRoutineCreated).toHaveBeenCalledWith(createdRoutine);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Routine created' })
    );
    // The form resets after a successful creation.
    expect(screen.getByLabelText('Routine title')).toHaveValue('');
  });

  it('shows a destructive toast when creating fails', async () => {
    vi.mocked(routineService.createRoutine).mockRejectedValue(
      new Error('duplicate')
    );
    const props = { onOpenChange: vi.fn(), onRoutineCreated: vi.fn() };
    const user = userEvent.setup();
    render(<CreateRoutineModal open {...props} />);

    await user.type(screen.getByLabelText('Routine title'), 'Morning health');
    await user.click(screen.getByText('Use Existing Activities'));
    await user.click(
      await screen.findByRole('checkbox', { name: /Read a book/ })
    );
    await user.click(screen.getByRole('button', { name: 'Add Selected' }));
    await user.click(screen.getByRole('button', { name: 'Create Routine' }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to create routine',
          description: 'duplicate',
          variant: 'destructive',
        })
      )
    );
    expect(props.onRoutineCreated).not.toHaveBeenCalled();
  });

  it('closes on cancel without creating', async () => {
    const props = { onOpenChange: vi.fn(), onRoutineCreated: vi.fn() };
    const user = userEvent.setup();
    render(<CreateRoutineModal open {...props} />);

    await user.type(screen.getByLabelText('Routine title'), 'My routine');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(routineService.createRoutine).not.toHaveBeenCalled();
  });
});
