import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
      invalidRange: 'End time must be after start time',
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

describe('CalendarEventModal', () => {
  beforeEach(() => {
    vi.mocked(calendarService.createEvent).mockReset();
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
});
