import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CalendarEvent } from '@shared/types/calendar';
import { EventBlock, markEventDragged, clearEventDragged } from './event-block';
import { formatTimeRange } from '../lib/week';

const startAt = new Date(2026, 9, 19, 10, 0).toISOString();
const endAt = new Date(2026, 9, 19, 12, 0).toISOString();

function buildEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 1,
    title: 'English class',
    description: '',
    category: 'Study',
    startAt,
    endAt,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function renderBlock(event: CalendarEvent, dndId?: string) {
  const onClick = vi.fn();
  // useDraggable works standalone without a DndContext.
  render(
    <EventBlock
      event={event}
      lane={0}
      laneCount={1}
      topPercent={10}
      heightPercent={20}
      dndId={dndId}
      onClick={onClick}
    />
  );
  return { onClick };
}

describe('EventBlock', () => {
  it('labels itself with the title and formatted time range', () => {
    renderBlock(buildEvent());

    const expected = formatTimeRange(startAt, endAt);
    expect(
      screen.getByRole('button', { name: `English class, ${expected}` })
    ).toBeInTheDocument();
  });

  it('marks recurring events with a repeat icon', () => {
    const { container } = render(
      <EventBlock
        event={buildEvent({ seriesId: 'series-1' })}
        lane={0}
        laneCount={1}
        topPercent={10}
        heightPercent={20}
        onClick={vi.fn()}
      />
    );

    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('does not show the repeat icon for one-off events', () => {
    const { container } = render(
      <EventBlock
        event={buildEvent()}
        lane={0}
        laneCount={1}
        topPercent={10}
        heightPercent={20}
        onClick={vi.fn()}
      />
    );

    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const { onClick } = renderBlock(buildEvent(), 'week-1');

    await user.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('swallows the first click right after a drag, then recovers', async () => {
    const user = userEvent.setup();
    const { onClick } = renderBlock(buildEvent(), 'week-1');

    markEventDragged(1);
    await user.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();

    // The mark is consumed by the post-drag click; the next click opens the
    // event normally.
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('clears the dragged mark on its own shortly after a drag', async () => {
    const user = userEvent.setup();
    const { onClick } = renderBlock(buildEvent(), 'week-1');

    markEventDragged(1);
    clearEventDragged();
    // Let the internal timeout clear the mark.
    await new Promise((resolve) => setTimeout(resolve, 0));

    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
