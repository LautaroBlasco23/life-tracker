import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Activity, Routine } from '@shared/types';
import { activityService } from '@shared/services/activity-service';
import { routineService } from '@shared/services/routine-service';
import { showToast } from '@/lib/toast';
import { ACTIVITY_TEMPLATES } from '@shared/lib/activity-templates';
import { TemplatesModal } from './templates-modal';

vi.mock('@shared/services/activity-service', () => ({
  activityService: {
    createActivity: vi.fn(),
  },
}));

vi.mock('@shared/services/routine-service', () => ({
  routineService: {
    createRoutine: vi.fn(),
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
  activityTemplates: {
    title: 'Templates',
    description: 'Pick predefined activities and routines to clone.',
    kind_activity: 'Activities',
    kind_routine: 'Routines',
    activitiesCount: '{count} activities',
    selectedCount: '{count} selected',
    createSelected: 'Create {count} selected',
    creating: 'Creating...',
    created: 'Created',
    createdDescription: '{count} items were added to your list.',
    partialFailure: 'Some activities failed',
    partialFailureDescription: '{created} created, {failed} failed.',
    customize: 'Customize before creating',
    category_health: 'Health',
    category_study: 'Study',
    category_home: 'Home',
    category_homeTraining: 'Home Training',
    template_drinkWater: 'Drink water',
    template_walk10k: 'Walk 10k steps',
    template_morningReset: 'Morning reset',
    template_cleaningDay: 'Cleaning day',
    template_homeWorkout: 'Home workout circuit',
    template_dishes: 'Wash the dishes',
    template_laundry: 'Do the laundry',
    template_vacuum: 'Vacuum',
    template_trash: 'Take out the trash',
    template_pushups20: '20 push-ups',
    template_squats30: '30 squats',
    template_plank1: '1-minute plank',
  },
  activities: {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    morning: 'Morning',
    evening: 'Evening',
    afternoon: 'Afternoon',
    notSpecified: 'Any Moment',
  },
  createActivity: {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  },
  common: { creating: 'Creating...' },
};

function baseProps() {
  return {
    open: true,
    onOpenChange: vi.fn(),
    onCreated: vi.fn(),
    onCustomize: vi.fn(),
  };
}

/** Clicks the visible Radix select trigger that shows the given label. */
async function chooseSelectOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: string
) {
  const trigger = screen
    .getAllByText(label)
    .find((el) => el.closest('[data-slot="select-trigger"]'))!
    .closest<HTMLButtonElement>('[data-slot="select-trigger"]')!;
  await user.click(trigger);
  await user.click(screen.getByRole('option', { name: option }));
}

/** Returns the selectable template row containing the given title. */
function rowOf(title: string): HTMLElement {
  return screen.getByText(title).closest<HTMLElement>('[role="checkbox"]')!;
}

let nextActivityId = 100;

describe('TemplatesModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nextActivityId = 100;
    vi.mocked(activityService.createActivity).mockImplementation(
      async () => ({ id: nextActivityId++, title: 'Cloned' }) as Activity
    );
    vi.mocked(routineService.createRoutine).mockImplementation(
      async () => ({ id: 999, title: 'Cloned routine' }) as Routine
    );
  });

  it('renders the activity templates of the default category', () => {
    render(<TemplatesModal {...baseProps()} />);

    expect(screen.getByText('Templates')).toBeInTheDocument();
    // Health category: 7 templates rendered with their frequency badges.
    expect(screen.getByText('Drink water')).toBeInTheDocument();
    expect(screen.getByText('Walk 10k steps')).toBeInTheDocument();
    expect(screen.getAllByText('Daily')).toHaveLength(6);
    expect(screen.getByText('Weekly')).toBeInTheDocument();
    expect(screen.getByText('Sunday')).toBeInTheDocument(); // mealPrep weekly day
    expect(
      screen.getByRole('button', { name: 'Create 0 selected' })
    ).toBeDisabled();
  });

  it('filters templates by the selected category', async () => {
    const user = userEvent.setup();
    render(<TemplatesModal {...baseProps()} />);

    await chooseSelectOption(user, 'Health', 'Study');

    expect(screen.queryByText('Drink water')).not.toBeInTheDocument();
  });

  it('switches to routine templates and lists their activities', async () => {
    const user = userEvent.setup();
    render(<TemplatesModal {...baseProps()} />);

    await chooseSelectOption(user, 'Activities', 'Routines');

    expect(screen.getByText('Morning reset')).toBeInTheDocument();
    expect(screen.getByText('Cleaning day')).toBeInTheDocument();
    expect(screen.getAllByText('4 activities')).toHaveLength(3); // home routines
    expect(screen.getByText('Wash the dishes')).toBeInTheDocument();
  });

  it('toggles the selection and updates the counter', async () => {
    const user = userEvent.setup();
    render(<TemplatesModal {...baseProps()} />);

    const firstRow = rowOf('Drink water');
    expect(firstRow).toHaveAttribute('aria-checked', 'false');

    await user.click(firstRow);
    expect(firstRow).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create 1 selected' })
    ).toBeEnabled();

    await user.click(firstRow);
    expect(firstRow).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('0 selected')).toBeInTheDocument();
  });

  it('creates the selected activity templates and reloads', async () => {
    const props = baseProps();
    const user = userEvent.setup();
    render(<TemplatesModal {...props} />);

    const walkRow = rowOf('Walk 10k steps');
    await user.click(walkRow);
    await user.click(screen.getByRole('button', { name: 'Create 1 selected' }));

    await waitFor(() =>
      expect(activityService.createActivity).toHaveBeenCalledWith({
        title: 'Walk 10k steps',
        description: '',
        completionAmount: 1,
        frequency: 'daily',
        dayFrequency: undefined,
        dayTime: 'notSpecified',
        privacyStatus: 'private',
      })
    );
    expect(props.onCreated).toHaveBeenCalledTimes(1);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Created',
        description: '1 items were added to your list.',
      })
    );
  });

  it('creates a routine template with its child activities in order', async () => {
    const props = baseProps();
    const user = userEvent.setup();
    render(<TemplatesModal {...props} />);

    await chooseSelectOption(user, 'Activities', 'Routines');
    await user.click(rowOf('Cleaning day'));
    await user.click(screen.getByRole('button', { name: 'Create 1 selected' }));

    // dishes, laundry, vacuum, trash — four child activities, then the routine.
    await waitFor(() =>
      expect(activityService.createActivity).toHaveBeenCalledTimes(4)
    );
    expect(routineService.createRoutine).toHaveBeenCalledWith({
      title: 'Cleaning day',
      description: '',
      privacyStatus: 'private',
      activityIds: [
        { activityId: 100, position: 0 },
        { activityId: 101, position: 1 },
        { activityId: 102, position: 2 },
        { activityId: 103, position: 3 },
      ],
    });
    expect(props.onCreated).toHaveBeenCalledTimes(1);
  });

  it('reports a partial failure and keeps the modal open', async () => {
    vi.mocked(activityService.createActivity).mockRejectedValue(
      new Error('quota')
    );
    const props = baseProps();
    const user = userEvent.setup();
    render(<TemplatesModal {...props} />);

    await user.click(rowOf('Walk 10k steps'));
    await user.click(screen.getByRole('button', { name: 'Create 1 selected' }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Some activities failed',
          description: '0 created, 1 failed.',
          variant: 'destructive',
        })
      )
    );
    expect(props.onCreated).not.toHaveBeenCalled();
    expect(props.onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('opens the customize flow for a template', async () => {
    const props = baseProps();
    const user = userEvent.setup();
    render(<TemplatesModal {...props} />);

    const drinkRow = rowOf('Drink water');
    await user.click(
      within(drinkRow).getByRole('button', {
        name: 'Customize before creating',
      })
    );

    expect(props.onCustomize).toHaveBeenCalledWith(ACTIVITY_TEMPLATES[0]);
  });

  it('toggles a template with the keyboard', async () => {
    const user = userEvent.setup();
    render(<TemplatesModal {...baseProps()} />);

    const row = rowOf('Drink water');
    row.focus();
    await user.keyboard('{Enter}');

    expect(row).toHaveAttribute('aria-checked', 'true');
  });
});
