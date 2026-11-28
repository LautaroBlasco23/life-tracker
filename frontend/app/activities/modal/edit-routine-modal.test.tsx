import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Routine } from '@shared/types';
import { routineService } from '@shared/services/routine-service';
import { showToast } from '@/lib/toast';
import { EditRoutineModal } from './edit-routine-modal';

vi.mock('@shared/services/routine-service', () => ({
  routineService: {
    updateRoutine: vi.fn(),
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
    editTitle: 'Edit Routine',
    editDescription: 'Update the name, privacy, or activities.',
    titleLabel: 'Routine title',
    titlePlaceholder: 'e.g. Morning health routine',
    descriptionLabel: 'Description',
    updateRoutine: 'Update Routine',
    routineUpdated: 'Routine updated',
    routineUpdatedDescription: 'Saved.',
    updateFailed: 'Failed to update routine',
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
  common: { cancel: 'Cancel', updating: 'Updating...', loading: 'Loading...' },
  privacy: {
    privacyStatus: 'Privacy Status',
    private: 'Private',
    public: 'Public',
  },
};

const routine: Routine = {
  id: 12,
  userId: 1,
  title: 'Evening wind-down',
  description: 'Slow end of the day',
  privacyStatus: 'public',
  activities: [
    {
      activityId: 3,
      activityTitle: 'Read a book',
      description: '',
      frequency: 'daily',
      dayTime: 'evening',
      privacyStatus: 'private',
      completionAmount: 1,
      position: 1,
      todayCompletions: 0,
      scheduledToday: true,
    },
    {
      activityId: 1,
      activityTitle: 'Morning run',
      description: '',
      frequency: 'daily',
      dayTime: 'morning',
      privacyStatus: 'private',
      completionAmount: 1,
      position: 0,
      todayCompletions: 0,
      scheduledToday: true,
    },
  ],
  isCompletedToday: false,
  createdAt: '',
  updatedAt: '',
};

function baseProps() {
  return {
    open: true,
    onOpenChange: vi.fn(),
    onRoutineUpdated: vi.fn(),
  };
}

describe('EditRoutineModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(routineService.updateRoutine).mockResolvedValue(routine);
  });

  it('renders nothing without a routine', () => {
    const { container } = render(
      <EditRoutineModal {...baseProps()} routine={null} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('seeds the form from the routine with activities sorted by position', () => {
    render(<EditRoutineModal {...baseProps()} routine={routine} />);

    expect(screen.getByText('Edit Routine')).toBeInTheDocument();
    expect(screen.getByLabelText('Routine title')).toHaveValue(
      'Evening wind-down'
    );
    expect(screen.getByLabelText('Description')).toHaveValue(
      'Slow end of the day'
    );

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Morning run');
    expect(rows[1]).toHaveTextContent('Read a book');
  });

  it('updates the routine with positional activity ids', async () => {
    const props = baseProps();
    const user = userEvent.setup();
    render(<EditRoutineModal {...props} routine={routine} />);

    await user.clear(screen.getByLabelText('Routine title'));
    await user.type(screen.getByLabelText('Routine title'), 'Night routine');
    await user.click(screen.getByRole('button', { name: 'Update Routine' }));

    await waitFor(() =>
      expect(routineService.updateRoutine).toHaveBeenCalledWith(12, {
        title: 'Night routine',
        description: 'Slow end of the day',
        privacyStatus: 'public',
        activityIds: [
          { activityId: 1, position: 0 },
          { activityId: 3, position: 1 },
        ],
      })
    );
    expect(props.onRoutineUpdated).toHaveBeenCalledWith(routine);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Routine updated' })
    );
  });

  it('shows a destructive toast when updating fails', async () => {
    vi.mocked(routineService.updateRoutine).mockRejectedValue(
      new Error('conflict')
    );
    const props = baseProps();
    const user = userEvent.setup();
    render(<EditRoutineModal {...props} routine={routine} />);

    await user.click(screen.getByRole('button', { name: 'Update Routine' }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to update routine',
          description: 'conflict',
          variant: 'destructive',
        })
      )
    );
    expect(props.onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
