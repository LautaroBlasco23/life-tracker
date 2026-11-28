import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEvent } from '@shared/types/calendar';
import { calendarService } from '@shared/services/calendar-service';
import { showToast } from '@/lib/toast';
import { CalendarView } from './calendar-view';
import { getWeekStart } from '../calendar/lib/week';

vi.mock('@shared/services/calendar-service', () => ({
  calendarService: {
    getEvents: vi.fn(),
    getEvent: vi.fn(),
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
  },
}));

vi.mock('@/lib/toast', () => ({
  showToast: vi.fn(),
}));

vi.mock('@shared/contexts/language-context', () => {
  const dictionaries: Record<string, Record<string, string>> = {
    calendar: {
      tab: 'Calendar',
      recordsTab: 'Records',
      newEvent: 'New event',
      editEvent: 'Edit event',
      today: 'Today',
      previousWeek: 'Previous week',
      nextWeek: 'Next week',
      eventTitle: 'Title',
      titlePlaceholder: 'e.g. English class',
      date: 'Date',
      startTime: 'Start',
      endTime: 'End',
      category: 'Category',
      description: 'Description',
      descriptionPlaceholder: 'Optional notes',
      emptyWeek: 'No events this week. Click a slot to add one.',
      eventDeleted: 'Event deleted',
      eventDeletedDescription: 'The event was removed from your calendar.',
      deleteEvent: 'Delete event',
      deleteEventConfirm: 'Delete event',
      failedToLoad: 'Failed to load calendar',
      failedToSave: 'Failed to save event',
      failedToDelete: 'Failed to delete event',
      repeat: 'Repeat',
      repeatNone: 'None',
      repeatWeekly: 'Weekly',
      repeatUntil: 'Repeat until',
      repeatWeekdays: 'Repeats on',
      repeatLocked: 'The repeat rule is set when the event is created',
      applyTo: 'Apply to',
      applyToOccurrence: 'This event',
      applyToSeries: 'The whole series',
      deleteScope: 'Apply the deletion to',
      seriesEvent: 'Part of a weekly series',
      endsNextDay: 'Ends the next day',
    },
    common: {
      cancel: 'Cancel',
      delete: 'Delete',
      loading: 'Loading...',
      save: 'Save',
    },
    deleteModal: {
      cannotBeUndone: 'This action cannot be undone.',
      areYouSure: 'Are you sure you want to delete "{name}"?',
      deleting: 'Deleting...',
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
  };
  const cache = new Map<
    string,
    (key: string, vars?: Record<string, string | number>) => string
  >();
  return {
    useTranslations: (namespace: string) => {
      if (!cache.has(namespace)) {
        cache.set(namespace, (key, vars) => {
          let str = dictionaries[namespace]?.[key] ?? key;
          if (vars) {
            for (const [k, v] of Object.entries(vars)) {
              str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
            }
          }
          return str;
        });
      }
      return cache.get(namespace)!;
    },
  };
});

// The view anchors on the real current week; place events inside it but not
// on today (the mobile single-day grid mirrors the selected day, so an
// event on today would render twice).
const weekStart = getWeekStart(new Date());
const midWeek = new Date(weekStart);
midWeek.setDate(weekStart.getDate() + 3);

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 1,
    title: 'Math lecture',
    description: '',
    category: 'Study',
    startAt: new Date(
      midWeek.getFullYear(),
      midWeek.getMonth(),
      midWeek.getDate(),
      10,
      0
    ).toISOString(),
    endAt: new Date(
      midWeek.getFullYear(),
      midWeek.getMonth(),
      midWeek.getDate(),
      12,
      0
    ).toISOString(),
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('CalendarView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the toolbar, the loading state and then the week events', async () => {
    vi.mocked(calendarService.getEvents).mockResolvedValue([event()]);

    render(<CalendarView />);

    expect(
      screen.getByRole('button', { name: 'Previous week' })
    ).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: /Math lecture/ }).length
      ).toBeGreaterThan(0)
    );
  });

  it('shows the empty week message when there are no events', async () => {
    vi.mocked(calendarService.getEvents).mockResolvedValue([]);

    render(<CalendarView />);

    await waitFor(() =>
      expect(
        screen.getByText('No events this week. Click a slot to add one.')
      ).toBeInTheDocument()
    );
  });

  it('toasts and clears the week when loading fails', async () => {
    vi.mocked(calendarService.getEvents).mockRejectedValue(
      new Error('network down')
    );

    render(<CalendarView />);

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to load calendar',
          description: 'network down',
        })
      )
    );
    expect(
      screen.getByText('No events this week. Click a slot to add one.')
    ).toBeInTheDocument();
  });

  it('opens the create modal with slot defaults from New event', async () => {
    vi.mocked(calendarService.getEvents).mockResolvedValue([]);
    const user = userEvent.setup();

    render(<CalendarView />);
    await waitFor(() =>
      expect(
        screen.getByText('No events this week. Click a slot to add one.')
      ).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: 'New event' }));

    const title = screen.getByLabelText('Title');
    expect(title).toHaveValue('');
    expect(
      screen.getByRole('dialog', { name: 'New event' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Title')).toBeNull();
  });

  it('opens the edit modal from an event block', async () => {
    vi.mocked(calendarService.getEvents).mockResolvedValue([event()]);
    const user = userEvent.setup();

    render(<CalendarView />);
    const eventButtons = await screen.findAllByRole('button', {
      name: /Math lecture/,
    });

    await user.click(eventButtons[0]);
    expect(screen.getByLabelText('Title')).toHaveValue('Math lecture');
  });

  it('deletes an event after confirmation', async () => {
    vi.mocked(calendarService.getEvents).mockResolvedValue([event()]);
    vi.mocked(calendarService.deleteEvent).mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<CalendarView />);
    const eventButtons = await screen.findAllByRole('button', {
      name: /Math lecture/,
    });

    await user.click(eventButtons[0]);
    // The edit modal footer holds the destructive Delete button.
    const deleteButtons = screen
      .getAllByRole('button', { name: 'Delete' })
      .filter((button) => button.className.includes('text-destructive'));
    await user.click(deleteButtons[0]);

    expect(
      screen.getByRole('dialog', { name: 'Delete event' })
    ).toBeInTheDocument();
    await user.click(
      screen
        .getAllByRole('button', { name: 'Delete event' })
        .filter((button) => button.className.includes('destructive'))[0]
    );

    await waitFor(() =>
      expect(calendarService.deleteEvent).toHaveBeenCalledWith(1, 'occurrence')
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Event deleted' })
    );
    // The view reloads the week after a successful delete.
    await waitFor(() =>
      expect(calendarService.getEvents).toHaveBeenCalledTimes(2)
    );
  });

  it('deletes the whole series when the scope asks for it', async () => {
    vi.mocked(calendarService.getEvents).mockResolvedValue([
      event({ id: 7, seriesId: 'series-1', recurrenceRule: 'weekly' }),
    ]);
    vi.mocked(calendarService.deleteEvent).mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<CalendarView />);
    const eventButtons = await screen.findAllByRole('button', {
      name: /Math lecture/,
    });

    await user.click(eventButtons[0]);
    const deleteButtons = screen
      .getAllByRole('button', { name: 'Delete' })
      .filter((button) => button.className.includes('text-destructive'));
    await user.click(deleteButtons[0]);

    await user.click(screen.getByLabelText('Apply the deletion to'));
    await user.click(screen.getByRole('option', { name: 'The whole series' }));
    await user.click(
      screen
        .getAllByRole('button', { name: 'Delete event' })
        .filter((button) => button.className.includes('destructive'))[0]
    );

    await waitFor(() =>
      expect(calendarService.deleteEvent).toHaveBeenCalledWith(7, 'series')
    );
  });
});
