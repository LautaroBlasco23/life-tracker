import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Activity } from '@shared/types/activity';
import { activityService } from '@shared/services/activity-service';
import { showToast } from '@/lib/toast';
import type { SelectedActivityRef } from './select-existing-activities-modal';
import { RoutineActivitiesSection } from './routine-activities-section';

vi.mock('@shared/services/activity-service', () => ({
  activityService: {
    getActivities: vi.fn(),
    createActivity: vi.fn(),
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
    selectedActivities: 'Selected activities',
    noActivitiesSelectedYet:
      'No activities in this routine yet. Create a new one or use an existing one.',
    orderHint: 'Routine order (use the arrows to reorder)',
    newActivity: 'New Activity',
    useExistingActivities: 'Use Existing Activities',
    selectExistingTitle: 'Select Activities',
    selectExistingDescription: 'Choose from activities you already created.',
    selectExistingConfirm: 'Add Selected',
    failedToLoadActivities: 'Failed to load activities',
  },
  activities: {
    daily: 'Daily',
    morning: 'Morning',
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
  common: { delete: 'Delete', cancel: 'Cancel', loading: 'Loading...' },
  privacy: { private: 'Private', public: 'Public', privacyStatus: 'Privacy' },
};

const createdActivity = { id: 20, title: 'Inlined activity' } as Activity;

const availableActivities: Activity[] = [
  { ...createdActivity, id: 10, title: 'Existing A' },
  { ...createdActivity, id: 11, title: 'Existing B' },
  { ...createdActivity, id: 12, title: 'Existing C' },
];

/** Controlled harness: mirrors how the routine modals own the selection. */
function Harness({ initial = [] }: { initial?: SelectedActivityRef[] }) {
  const [selected, setSelected] = useState<SelectedActivityRef[]>(initial);
  return (
    <RoutineActivitiesSection
      selectedActivities={selected}
      onSelectedChange={setSelected}
    />
  );
}

describe('RoutineActivitiesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(activityService.getActivities).mockResolvedValue(
      availableActivities
    );
    vi.mocked(activityService.createActivity).mockResolvedValue(
      createdActivity
    );
  });

  it('shows the empty state without selected activities', () => {
    render(<Harness />);

    expect(
      screen.getByText(
        'No activities in this routine yet. Create a new one or use an existing one.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/Routine order/)).not.toBeInTheDocument();
  });

  it('lists the selected activities with their order and move buttons', () => {
    render(
      <Harness
        initial={[
          { id: 1, title: 'Stretching' },
          { id: 2, title: 'Running' },
          { id: 3, title: 'Reading' },
        ]}
      />
    );

    expect(screen.getByText(/Routine order/)).toBeInTheDocument();
    expect(screen.getByText('Stretching')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Reading')).toBeInTheDocument();

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('1Stretching');
    expect(rows[2]).toHaveTextContent('3Reading');
    // First row cannot move up, last row cannot move down.
    expect(
      rows[0].querySelector('button[aria-label="Move up"]')
    ).toBeDisabled();
    expect(
      rows[2].querySelector('button[aria-label="Move down"]')
    ).toBeDisabled();
  });

  it('reorders an activity with the move buttons', async () => {
    const onSelectedChange = vi.fn();
    const user = userEvent.setup();
    render(
      <RoutineActivitiesSection
        selectedActivities={[
          { id: 1, title: 'Stretching' },
          { id: 2, title: 'Running' },
        ]}
        onSelectedChange={onSelectedChange}
      />
    );

    await user.click(screen.getAllByRole('button', { name: 'Move down' })[0]);

    expect(onSelectedChange).toHaveBeenCalledWith([
      { id: 2, title: 'Running' },
      { id: 1, title: 'Stretching' },
    ]);
  });

  it('removes an activity with the delete button', async () => {
    const onSelectedChange = vi.fn();
    const user = userEvent.setup();
    render(
      <RoutineActivitiesSection
        selectedActivities={[
          { id: 1, title: 'Stretching' },
          { id: 2, title: 'Running' },
        ]}
        onSelectedChange={onSelectedChange}
      />
    );

    const rows = screen.getAllByRole('listitem');
    await user.click(
      rows[0].querySelector('button[aria-label="Delete"]') as HTMLElement
    );

    expect(onSelectedChange).toHaveBeenCalledWith([
      { id: 2, title: 'Running' },
    ]);
  });

  it('creates an activity inline and appends it to the selection', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[{ id: 1, title: 'Stretching' }]} />);

    await user.click(screen.getByText('New Activity'));
    expect(
      screen.getByPlaceholderText('e.g., Morning Workout')
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('Title'), 'Push ups');
    await user.click(screen.getByRole('button', { name: 'Create Activity' }));

    await waitFor(() =>
      expect(activityService.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Push ups', frequency: 'daily' })
      )
    );
    expect(await screen.findByText('Inlined activity')).toBeInTheDocument();
    expect(screen.getByText('Stretching')).toBeInTheDocument();
  });

  it('merges the selection when existing activities are confirmed', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={[
          { id: 10, title: 'Existing A' },
          { id: 11, title: 'Existing B' },
        ]}
      />
    );

    await user.click(screen.getByText('Use Existing Activities'));
    expect(await screen.findByText('Select Activities')).toBeInTheDocument();

    // Deselect Existing B, add Existing C; Existing A stays kept.
    const second = screen.getByRole('checkbox', { name: /Existing B/ });
    const third = screen.getByRole('checkbox', { name: /Existing C/ });
    await user.click(second);
    await user.click(third);
    await user.click(screen.getByRole('button', { name: 'Add Selected' }));

    expect(await screen.findByText('Existing C')).toBeInTheDocument();
    expect(screen.getByText('Existing A')).toBeInTheDocument();
    expect(screen.queryByText('Existing B')).not.toBeInTheDocument();
    expect(screen.queryByText('Select Activities')).not.toBeInTheDocument();
  });
});
