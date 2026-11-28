import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Activity } from '@shared/types/activity';
import type { Reminder as ReminderType } from '@shared/types/reminder';
import { buildDateTime, formatTimeInput } from '@shared/lib/datetime';
import { activityService } from '@shared/services/activity-service';
import { reminderService } from '@shared/services/reminder-service';
import { showToast } from '@/lib/toast';
import { ActivityFormModal } from './activity-form-modal';
import en from '@shared/messages/en.json';
import es from '@shared/messages/es.json';

vi.mock('@shared/services/activity-service', () => ({
  activityService: {
    createActivity: vi.fn(),
    updateActivity: vi.fn(),
  },
}));

vi.mock('@shared/services/reminder-service', () => ({
  reminderService: {
    createReminder: vi.fn(),
    updateReminder: vi.fn(),
  },
}));

vi.mock('@/lib/toast', () => ({ showToast: vi.fn() }));

// The workspace root can hold a second React copy (shared package peer dep),
// so tests that render this dialog mock the i18n context — same approach as
// calendar-event-modal.test. English reads from `mockMessages` (keeps these
// tests independent of copy tweaks) and falls back to the real `en.json` for
// keys it does not pin; Spanish always reads the real `es.json`, so a missing
// key or a raw enum value leaks through as the key itself.
vi.mock('@shared/contexts/language-context', async () => {
  const enCatalog = (await import('@shared/messages/en.json')).default;
  const esCatalog = (await import('@shared/messages/es.json')).default;
  type Catalog = Record<string, Record<string, string>>;

  return {
    useTranslations: (namespace: string) => {
      const isSpanish = localStorage.getItem('locale') === 'es';
      const catalog = (isSpanish ? esCatalog : enCatalog) as Catalog;
      return (key: string, params?: Record<string, string | number>) => {
        const override = isSpanish ? undefined : mockMessages[namespace]?.[key];
        let text =
          override ?? catalog[namespace]?.[key] ?? `${namespace}.${key}`;
        for (const [name, value] of Object.entries(params ?? {})) {
          text = text.replaceAll(`{${name}}`, String(value));
        }
        return text;
      };
    },
  };
});

const mockMessages: Record<string, Record<string, string>> = {
  activities: {
    editActivity: 'Edit Activity',
    updateActivity: 'Update Activity',
    activityUpdated: 'Activity updated',
    activityUpdatedDescription: 'Saved.',
    timeOfDay: 'Time of Day',
    frequency: 'Frequency',
    modeReminder: 'Reminder mode',
    modeHint: 'One-time deadline.',
  },
  createActivity: {
    title: 'Create New Activity',
    description: 'Add a new activity.',
    titleLabel: 'Title',
    titlePlaceholder: 'e.g., Morning Workout',
    descriptionLabel: 'Description',
    targetAmount: 'Target Amount',
    daysOfWeek: 'Days of the week',
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
    anyMoment: 'Any Moment',
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    createActivity: 'Create Activity',
    activityCreated: 'Activity created',
    activityCreatedDescription: 'Created.',
    selectDayError: 'Please select at least one day.',
    validationError: 'Validation error',
    creationFailed: 'Creation failed',
  },
  createReminder: {
    title: 'Create New Reminder',
    description: 'Set a one-time reminder.',
    titleLabel: 'Title',
    titlePlaceholder: 'e.g., Go to the supermarket',
    descriptionLabel: 'Description',
    dueDate: 'Deadline',
    dueDatePlaceholder: 'Pick a date',
    pickDateError: 'Please pick a deadline date.',
    activeWindow: 'Active window',
    activeWindowHint: 'Window hint',
    windowStartTime: 'Start time',
    windowEndTime: 'End time',
    windowBeforeDeadlineError: 'The window must open before the deadline.',
    createReminder: 'Create Reminder',
    reminderCreated: 'Reminder created',
    reminderCreatedDescription: 'Created.',
    updateReminder: 'Update Reminder',
    reminderUpdated: 'Reminder updated',
    reminderUpdatedDescription: 'Saved.',
    updateFailed: 'Update failed',
    creationFailed: 'Creation failed',
    validationError: 'Validation error',
  },
  common: {
    cancel: 'Cancel',
    creating: 'Creating...',
    updating: 'Updating...',
  },
  privacy: {
    privacyStatus: 'Privacy Status',
    private: 'Private',
    public: 'Public',
    activityPrivacyDescription: 'Visibility.',
  },
};

const createdActivity = { id: 1, title: 'Created' } as Activity;

function renderModal() {
  return render(<ActivityFormModal open onOpenChange={() => {}} />);
}

/** Field order in the modal: Time of Day (0), Frequency (1), Privacy (2). */
function combobox(index: number) {
  return within(screen.getByRole('dialog')).getAllByRole('combobox')[index];
}

function baseProps() {
  return {
    open: true,
    onOpenChange: vi.fn(),
    onActivityCreated: vi.fn(),
    onActivityUpdated: vi.fn(),
    onReminderCreated: vi.fn(),
    onReminderUpdated: vi.fn(),
  };
}

const activityFixture: Activity = {
  id: 7,
  userId: 1,
  title: 'Yoga class',
  description: 'Stretch and breathe',
  completionAmount: 3,
  frequency: 'weekly',
  dayFrequency: '["monday","friday"]',
  dayTime: 'morning',
  isActive: true,
  createdAt: '',
  updatedAt: '',
  todayCompletions: 0,
  isCompletedToday: false,
};

const reminderFixture: ReminderType = {
  id: 9,
  userId: 1,
  title: 'Pick up the package',
  description: 'Before 6pm',
  dueAt: new Date(2026, 9, 25, 17, 30).toISOString(),
  activeFrom: new Date(2026, 9, 25, 8, 0).toISOString(),
  completedAt: null,
  createdAt: '',
  updatedAt: '',
};

describe('ActivityFormModal', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(activityService.createActivity).mockResolvedValue(
      createdActivity
    );
    vi.mocked(activityService.updateActivity).mockResolvedValue(
      activityFixture
    );
    vi.mocked(reminderService.createReminder).mockResolvedValue(
      reminderFixture
    );
    vi.mocked(reminderService.updateReminder).mockResolvedValue(
      reminderFixture
    );
  });

  it('renders the create-activity form with defaults', () => {
    render(<ActivityFormModal {...baseProps()} />);

    expect(screen.getByText('Create New Activity')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.getByLabelText('Target Amount')).toHaveValue(1);
    expect(
      screen.getByRole('button', { name: 'Create Activity' })
    ).toBeInTheDocument();
  });

  it('requires at least one day for weekly activities', async () => {
    const props = baseProps();
    const user = userEvent.setup();
    render(<ActivityFormModal {...props} />);

    // The frequency trigger has no wired label; Radix renders a hidden native
    // select too. Drive the select with the keyboard for determinism.
    const frequencyTrigger = screen
      .getAllByText('Daily')
      .find((el) => el.closest('[data-slot="select-trigger"]'))!
      .closest<HTMLButtonElement>('[data-slot="select-trigger"]')!;
    frequencyTrigger.focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(screen.getByText('Days of the week')).toBeInTheDocument()
    );
    // Radix Select's scroll lock leaves body with pointer-events: none in
    // jsdom after keyboard interaction, so submit the form directly.
    fireEvent.submit(
      screen.getByRole('button', { name: 'Create Activity' }).closest('form')!
    );

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Validation error',
        description: 'Please select at least one day.',
        variant: 'destructive',
      })
    );
    expect(activityService.createActivity).not.toHaveBeenCalled();
    expect(props.onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('creates an activity with the entered payload', async () => {
    const props = baseProps();
    const user = userEvent.setup();
    render(<ActivityFormModal {...props} />);

    await user.type(screen.getByLabelText('Title'), 'Stretching');
    await user.type(screen.getByLabelText('Description'), 'After work');
    await user.click(screen.getByRole('button', { name: 'Create Activity' }));

    expect(activityService.createActivity).toHaveBeenCalledWith({
      title: 'Stretching',
      description: 'After work',
      completionAmount: 1,
      frequency: 'daily',
      dayTime: 'notSpecified',
      dayFrequency: undefined,
      privacyStatus: 'private',
    });
    expect(props.onActivityCreated).toHaveBeenCalledWith(createdActivity);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Activity created' })
    );
  });

  it('shows a destructive toast when creating fails', async () => {
    vi.mocked(activityService.createActivity).mockRejectedValue(
      new Error('server error')
    );
    const props = baseProps();
    const user = userEvent.setup();
    render(<ActivityFormModal {...props} />);

    await user.type(screen.getByLabelText('Title'), 'Stretching');
    await user.click(screen.getByRole('button', { name: 'Create Activity' }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Creation failed',
          description: 'server error',
          variant: 'destructive',
        })
      )
    );
    expect(props.onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('seeds the form from the edited activity and updates it', async () => {
    const props = baseProps();
    const user = userEvent.setup();
    render(<ActivityFormModal {...props} activity={activityFixture} />);

    expect(screen.getByText('Edit Activity')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Yoga class');
    expect(screen.getByLabelText('Target Amount')).toHaveValue(3);
    expect(screen.getByRole('checkbox', { name: 'Monday' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Friday' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Wednesday' })
    ).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Update Activity' }));

    expect(activityService.updateActivity).toHaveBeenCalledWith(7, {
      title: 'Yoga class',
      description: 'Stretch and breathe',
      completionAmount: 3,
      frequency: 'weekly',
      dayTime: 'morning',
      dayFrequency: ['monday', 'friday'],
      privacyStatus: 'private',
    });
    expect(props.onActivityUpdated).toHaveBeenCalledWith(activityFixture);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('toggles week days when editing a weekly activity', async () => {
    const props = baseProps();
    const user = userEvent.setup();
    render(<ActivityFormModal {...props} activity={activityFixture} />);

    await user.click(screen.getByRole('checkbox', { name: 'Wednesday' }));
    await user.click(screen.getByRole('checkbox', { name: 'Friday' }));

    expect(screen.getByRole('checkbox', { name: 'Wednesday' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Friday' })).not.toBeChecked();
  });

  it('ignores a malformed dayFrequency JSON in edit mode', () => {
    render(
      <ActivityFormModal
        {...baseProps()}
        activity={{
          ...activityFixture,
          dayFrequency: 'not-json',
        }}
      />
    );

    expect(screen.getByRole('checkbox', { name: 'Monday' })).not.toBeChecked();
  });

  it('switches to reminder mode and requires a deadline date', async () => {
    const props = baseProps();
    const user = userEvent.setup();
    render(<ActivityFormModal {...props} />);

    await user.click(screen.getByLabelText('Reminder mode'));
    expect(screen.getByText('Create New Reminder')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Title'), 'Take the trash out');
    await user.click(screen.getByRole('button', { name: 'Create Reminder' }));

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Validation error',
        description: 'Please pick a deadline date.',
        variant: 'destructive',
      })
    );
    expect(reminderService.createReminder).not.toHaveBeenCalled();
  });

  it('creates a reminder for a picked deadline day', async () => {
    const props = baseProps();
    const user = userEvent.setup();
    render(<ActivityFormModal {...props} />);

    await user.click(screen.getByLabelText('Reminder mode'));
    await user.type(screen.getByLabelText('Title'), 'Take the trash out');

    // Open the calendar popover and pick day 25 of the visible month.
    await user.click(screen.getByRole('button', { name: 'Pick a date' }));
    const cell = await screen.findByRole('gridcell', { name: '25' });
    await user.click(within(cell).getByRole('button'));

    await user.click(screen.getByRole('button', { name: 'Create Reminder' }));

    const pickedDate = new Date();
    pickedDate.setDate(25);
    const dueAt = buildDateTime(pickedDate, '23:59');
    const activeFrom = buildDateTime(pickedDate, '00:00');
    await waitFor(() =>
      expect(reminderService.createReminder).toHaveBeenCalledWith({
        title: 'Take the trash out',
        description: '',
        dueAt: dueAt.toISOString(),
        activeFrom: activeFrom.toISOString(),
      })
    );
    expect(props.onReminderCreated).toHaveBeenCalledWith(reminderFixture);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('seeds the reminder edit form and updates the reminder', async () => {
    const props = baseProps();
    const user = userEvent.setup();
    render(<ActivityFormModal {...props} reminder={reminderFixture} />);

    expect(
      screen.getByRole('button', { name: 'Update Reminder' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Pick up the package');
    expect(screen.getByLabelText('Active window')).toBeChecked();
    expect(screen.getByLabelText('Start time')).toHaveValue('08:00');
    expect(screen.getByLabelText('End time')).toHaveValue('17:30');

    await user.click(screen.getByRole('button', { name: 'Update Reminder' }));

    expect(reminderService.updateReminder).toHaveBeenCalledWith(9, {
      title: 'Pick up the package',
      description: 'Before 6pm',
      dueAt: buildDateTime(new Date(2026, 9, 25), '17:30').toISOString(),
      activeFrom: buildDateTime(new Date(2026, 9, 25), '08:00').toISOString(),
    });
    expect(props.onReminderUpdated).toHaveBeenCalledWith(reminderFixture);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('rejects an active window that opens after the deadline', async () => {
    const props = baseProps();
    const user = userEvent.setup();
    render(<ActivityFormModal {...props} reminder={reminderFixture} />);

    const start = screen.getByLabelText('Start time');
    await user.clear(start);
    await user.type(start, '18:00');

    await user.click(screen.getByRole('button', { name: 'Update Reminder' }));

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Validation error',
        description: 'The window must open before the deadline.',
        variant: 'destructive',
      })
    );
    expect(reminderService.updateReminder).not.toHaveBeenCalled();
  });

  it('completes an edit-reminder without an active window for the whole day', async () => {
    const props = baseProps();
    const user = userEvent.setup();
    render(
      <ActivityFormModal
        {...props}
        reminder={{ ...reminderFixture, activeFrom: null }}
      />
    );

    expect(screen.getByLabelText('Active window')).not.toBeChecked();
    expect(screen.queryByLabelText('Start time')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Update Reminder' }));

    expect(reminderService.updateReminder).toHaveBeenCalledWith(9, {
      title: 'Pick up the package',
      description: 'Before 6pm',
      dueAt: buildDateTime(new Date(2026, 9, 25), '23:59').toISOString(),
      activeFrom: buildDateTime(new Date(2026, 9, 25), '00:00').toISOString(),
    });
  });

  it('shows a destructive toast when updating a reminder fails', async () => {
    vi.mocked(reminderService.updateReminder).mockRejectedValue(
      new Error('conflict')
    );
    const props = baseProps();
    const user = userEvent.setup();
    render(<ActivityFormModal {...props} reminder={reminderFixture} />);

    await user.click(screen.getByRole('button', { name: 'Update Reminder' }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Update failed',
          description: 'conflict',
          variant: 'destructive',
        })
      )
    );
  });

  it('resets the form when cancelled', async () => {
    const props = baseProps();
    const user = userEvent.setup();
    render(<ActivityFormModal {...props} />);

    await user.type(screen.getByLabelText('Title'), 'Something');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    // Reopen: the title must be back to the default.
    const second = baseProps();
    render(<ActivityFormModal {...second} />);
    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(formatTimeInput(new Date(2026, 9, 25, 17, 30))).toBe('17:30');
  });

  // Enum labels are regression coverage for the label-translation fix: the
  // selects must show activity-filter copy, never the raw wire values.
  it('shows translated Time of Day labels instead of raw enum values', async () => {
    const user = userEvent.setup();
    renderModal();

    const timeOfDay = combobox(0);
    expect(timeOfDay).toHaveTextContent(en.activities.anyMoment);

    await user.click(timeOfDay);

    for (const label of [
      en.activities.anyMoment,
      en.activities.morning,
      en.activities.afternoon,
      en.activities.evening,
    ]) {
      expect(screen.getByRole('option', { name: label })).toBeVisible();
    }

    // Raw enum values must not leak into the menu.
    expect(screen.queryByRole('option', { name: 'anyMoment' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'morning' })).toBeNull();
  });

  it('shows translated Frequency labels instead of raw enum values', async () => {
    const user = userEvent.setup();
    renderModal();

    const frequency = combobox(1);
    expect(frequency).toHaveTextContent(en.activities.daily);

    await user.click(frequency);

    for (const label of [
      en.activities.daily,
      en.activities.weekly,
      en.activities.monthly,
    ]) {
      expect(screen.getByRole('option', { name: label })).toBeVisible();
    }

    expect(screen.queryByRole('option', { name: 'daily' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'weekly' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'monthly' })).toBeNull();
  });

  it('labels Time of Day, Frequency and weekdays in Spanish', async () => {
    localStorage.setItem('locale', 'es');
    const user = userEvent.setup();
    renderModal();

    expect(combobox(0)).toHaveTextContent(es.activities.anyMoment);
    expect(combobox(1)).toHaveTextContent(es.activities.daily);

    // Weekly exposes the day checkboxes; their labels must be translated too.
    await user.click(combobox(1));
    await user.click(
      screen.getByRole('option', { name: es.activities.weekly })
    );

    expect(screen.getByLabelText(es.days.monday)).toBeVisible();
    expect(screen.getByLabelText(es.days.sunday)).toBeVisible();
    expect(screen.queryByLabelText('monday')).toBeNull();
  });
});
