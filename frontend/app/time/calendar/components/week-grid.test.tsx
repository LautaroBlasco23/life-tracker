import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CalendarEvent } from '@shared/types/calendar';
import { WeekGrid } from './week-grid';
import { getWeekDays, getWeekStart } from '../lib/week';

const days = getWeekDays(getWeekStart(new Date(2026, 9, 21))); // Mon Oct 19 2026

const events: CalendarEvent[] = [
  {
    id: 1,
    title: 'English class',
    description: '',
    category: 'Study',
    startAt: new Date(2026, 9, 19, 10, 0).toISOString(),
    endAt: new Date(2026, 9, 19, 12, 0).toISOString(),
    createdAt: '',
    updatedAt: '',
  },
];

describe('WeekGrid', () => {
  it('renders one column per day and the week events', () => {
    const { container } = render(
      <WeekGrid
        days={days}
        events={events}
        onSlotClick={vi.fn()}
        onEventClick={vi.fn()}
      />
    );

    expect(container.querySelectorAll('[data-day]')).toHaveLength(7);
    expect(screen.getByText('19')).toBeInTheDocument(); // Monday header
    expect(screen.getByText('English class')).toBeInTheDocument();
  });

  it('opens the event when a block is clicked', async () => {
    const onEventClick = vi.fn();
    const onSlotClick = vi.fn();
    const user = userEvent.setup();

    render(
      <WeekGrid
        days={days}
        events={events}
        onSlotClick={onSlotClick}
        onEventClick={onEventClick}
      />
    );

    await user.click(screen.getByRole('button', { name: /English class/ }));

    expect(onEventClick).toHaveBeenCalledWith(events[0]);
    expect(onSlotClick).not.toHaveBeenCalled();
  });

  it('opens the create flow when an empty slot is clicked', async () => {
    const onSlotClick = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <WeekGrid
        days={[days[0]]}
        events={[]}
        onSlotClick={onSlotClick}
        onEventClick={vi.fn()}
      />
    );

    await user.click(container.querySelector('[data-day]')!);

    expect(onSlotClick).toHaveBeenCalledTimes(1);
    expect(onSlotClick.mock.calls[0][0]).toEqual(days[0]);
  });
});
