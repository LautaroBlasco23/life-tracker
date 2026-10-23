import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEvent } from '@shared/types/calendar';
import { calendarService } from '@shared/services/calendar-service';
import { showToast } from '@/lib/toast';
import { CalendarEventModal } from './calendar-event-modal';

vi.mock('@shared/services/calendar-service', () => ({
  calendarService: {
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
  },
}));

vi.mock('@/lib/toast', () => ({
  showToast: vi.fn(),
}));

// Mocking the shared context keeps this test on the component's own logic and
// avoids a second React copy (the workspace root installs React for mobile).
vi.mock('@shared/contexts/language-context', () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const calendar: Record<string, string> = {
      eventTitle: 'Title',
      endsNextDay: 'Ends the next day',
      tooLong: 'An event cannot be longer than 24 hours',
      invalidRange: 'End time must be after start time',
      repeat: 'Repeat',
      repeatNone: 'None',
      repeatWeekly: 'Weekly',
      repeatUntil: 'Repeat until',
      repeatUntilRequired: 'Pick the last date of the series',
      repeatUntilBeforeStart: 'The last date cannot be before the event date',
      applyTo: 'Apply to',
      applyToOccurrence: 'This event',
      applyToSeries: 'The whole series',
    };
    const common: Record<string, string> = {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
    };
    return (namespace === 'common' ? common : calendar)[key] ?? key;
  },
}));

const date = new Date(2026, 9, 19);

function renderModal(startMinutes: number, endMinutes: number) {
  return render(
    <CalendarEventModal
      open
      onOpenChange={vi.fn()}
      event={null}
      defaults={{ date, startMinutes, endMinutes }}
      onSaved={vi.fn()}
      onRequestDelete={vi.fn()}
    />
  );
}

function renderEditModal(event: CalendarEvent) {
  return render(
    <CalendarEventModal
      open
      onOpenChange={vi.fn()}
      event={event}
      defaults={null}
      onSaved={vi.fn()}
      onRequestDelete={vi.fn()}
    />
  );
}

const seriesEvent: CalendarEvent = {
  id: 7,
  title: 'English class',
  description: '',
  category: 'Study',
  startAt: new Date(2026, 9, 19, 10, 0).toISOString(),
  endAt: new Date(2026, 9, 19, 12, 0).toISOString(),
  createdAt: '',
  updatedAt: '',
  seriesId: 'series-1',
  recurrenceRule: 'weekly',
  recurrenceUntil: new Date(2026, 10, 16, 23, 59, 59, 999).toISOString(),
  occurrenceIndex: 0,
};

describe('CalendarEventModal', () => {
  beforeEach(() => {
    vi.mocked(calendarService.createEvent).mockReset();
    vi.mocked(calendarService.updateEvent).mockReset();
    vi.mocked(showToast).mockReset();
  });

  it('rejects an end time before the start time', async () => {
    const user = userEvent.setup();
    renderModal(10 * 60, 9 * 60);

    await user.type(screen.getByLabelText('Title'), 'English class');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(calendarService.createEvent).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'End time must be after start time' })
    );
  });

  it('creates an event with ISO instants for the entered local time', async () => {
    const user = userEvent.setup();
    renderModal(10 * 60, 12 * 60);

    await user.type(screen.getByLabelText('Title'), '  English class  ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(calendarService.createEvent).toHaveBeenCalledWith({
      title: 'English class',
      description: '',
      category: 'Other',
      startAt: new Date(2026, 9, 19, 10, 0).toISOString(),
      endAt: new Date(2026, 9, 19, 12, 0).toISOString(),
    });
  });

  it('creates a weekly series with the recurrence payload', async () => {
    const user = userEvent.setup();
    renderModal(10 * 60, 12 * 60);

    await user.type(screen.getByLabelText('Title'), 'English class');
    await user.click(screen.getByLabelText('Repeat'));
    await user.click(screen.getByRole('option', { name: 'Weekly' }));

    const until = screen.getByLabelText('Repeat until');
    await user.clear(until);
    await user.type(until, '2026-11-16');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(calendarService.createEvent).toHaveBeenCalledWith({
      title: 'English class',
      description: '',
      category: 'Other',
      startAt: new Date(2026, 9, 19, 10, 0).toISOString(),
      endAt: new Date(2026, 9, 19, 12, 0).toISOString(),
      recurrence: {
        rule: 'weekly',
        interval: 1,
        until: new Date(2026, 10, 16, 23, 59, 59, 999).toISOString(),
      },
    });
  });

  it('requires the last date of a weekly series', async () => {
    const user = userEvent.setup();
    renderModal(10 * 60, 12 * 60);

    await user.type(screen.getByLabelText('Title'), 'English class');
    await user.click(screen.getByLabelText('Repeat'));
    await user.click(screen.getByRole('option', { name: 'Weekly' }));

    const until = screen.getByLabelText('Repeat until');
    await user.clear(until);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(calendarService.createEvent).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Pick the last date of the series' })
    );
  });

  it('rejects a last date before the event date', async () => {
    const user = userEvent.setup();
    renderModal(10 * 60, 12 * 60);

    await user.type(screen.getByLabelText('Title'), 'English class');
    await user.click(screen.getByLabelText('Repeat'));
    await user.click(screen.getByRole('option', { name: 'Weekly' }));

    const until = screen.getByLabelText('Repeat until');
    await user.clear(until);
    await user.type(until, '2026-10-12');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(calendarService.createEvent).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'The last date cannot be before the event date',
      })
    );
  });

  it('updates a single occurrence by default', async () => {
    const user = userEvent.setup();
    renderEditModal(seriesEvent);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(calendarService.updateEvent).toHaveBeenCalledWith(
      7,
      {
        title: 'English class',
        description: '',
        category: 'Study',
        startAt: new Date(2026, 9, 19, 10, 0).toISOString(),
        endAt: new Date(2026, 9, 19, 12, 0).toISOString(),
      },
      'occurrence'
    );
  });

  it('updates the whole series when the scope asks for it', async () => {
    const user = userEvent.setup();
    renderEditModal(seriesEvent);

    await user.click(screen.getByLabelText('Apply to'));
    await user.click(screen.getByRole('option', { name: 'The whole series' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(calendarService.updateEvent).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ title: 'English class' }),
      'series'
    );
  });

  it('sends the next-day instant when the overnight toggle is on', async () => {
    const user = userEvent.setup();
    renderModal(23 * 60, 0); // 23:00 -> 00:00 next day

    await user.type(screen.getByLabelText('Title'), 'Overnight class');
    await user.click(
      screen.getByRole('checkbox', { name: 'Ends the next day' })
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(calendarService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        startAt: new Date(2026, 9, 19, 23, 0).toISOString(),
        endAt: new Date(2026, 9, 20, 0, 0).toISOString(),
      })
    );
  });

  it('rejects an overnight event longer than 24 hours', async () => {
    const user = userEvent.setup();
    renderModal(10 * 60, 11 * 60); // 10:00 -> 11:00 next day = 25h

    await user.type(screen.getByLabelText('Title'), 'Too long');
    await user.click(
      screen.getByRole('checkbox', { name: 'Ends the next day' })
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(calendarService.createEvent).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'An event cannot be longer than 24 hours',
      })
    );
  });
});
