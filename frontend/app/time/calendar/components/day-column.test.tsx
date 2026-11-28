import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CalendarEvent } from '@shared/types/calendar';
import { DayColumn } from './day-column';

const day = new Date(2026, 9, 19); // Monday

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

function renderColumn({
  events: dayEvents = events,
  day: columnDay = day,
  onSlotClick = vi.fn(),
  onEventClick = vi.fn(),
}: {
  events?: CalendarEvent[];
  day?: Date;
  onSlotClick?: (day: Date, minutes: number) => void;
  onEventClick?: (event: CalendarEvent) => void;
} = {}) {
  // useDroppable works standalone without a DndContext.
  return render(
    <DayColumn
      day={columnDay}
      events={dayEvents}
      now={new Date(2026, 9, 19, 14, 0)}
      idPrefix="week"
      onSlotClick={onSlotClick}
      onEventClick={onEventClick}
    />
  );
}

describe('DayColumn', () => {
  it('positions its events inside the column', () => {
    renderColumn();

    expect(
      screen.getByRole('button', { name: /English class/ })
    ).toBeInTheDocument();
    // 10:00 of a 1440-minute day.
    expect(
      parseFloat(
        screen.getByRole('button', { name: /English class/ }).style.top
      )
    ).toBeCloseTo((600 / 1440) * 100);
  });

  it('clicking an event opens the event instead of a new slot', async () => {
    const user = userEvent.setup();
    const onSlotClick = vi.fn();
    const onEventClick = vi.fn();
    renderColumn({ onSlotClick, onEventClick });

    await user.click(screen.getByRole('button', { name: /English class/ }));

    expect(onEventClick).toHaveBeenCalledWith(events[0]);
    expect(onSlotClick).not.toHaveBeenCalled();
  });

  it('clicking an empty area starts the create flow for that day', async () => {
    const user = userEvent.setup();
    const onSlotClick = vi.fn();
    renderColumn({ events: [], onSlotClick });

    const column = document.querySelector('[data-day]')!;
    // jsdom reports a zero-size rect, so the click maps to midnight.
    fireEvent.click(column, { clientY: 100 });

    expect(onSlotClick).toHaveBeenCalledTimes(1);
    expect(onSlotClick.mock.calls[0][0]).toEqual(day);
    expect(onSlotClick.mock.calls[0][1]).toBe(0);
  });

  it('marks today with the current-time line', () => {
    const { container } = renderColumn({ day: new Date() });

    expect(container.querySelector('[data-day]')).toBeInTheDocument();
    expect(container.querySelector('.z-20')).not.toBeNull();
  });

  it('omits the current-time line on other days', () => {
    const { container } = renderColumn({ day: new Date(2026, 8, 14) });

    expect(container.querySelector('.z-20')).toBeNull();
  });
});
