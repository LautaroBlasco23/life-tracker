import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CalendarToolbar } from './calendar-toolbar';
import { getWeekStart } from '../lib/week';

vi.mock('@shared/contexts/language-context', () => {
  const dictionaries: Record<string, Record<string, string>> = {
    calendar: {
      previousWeek: 'Previous week',
      today: 'Today',
      nextWeek: 'Next week',
      newEvent: 'New event',
    },
  };
  // A stable identity per namespace: hooks put `t` in effect deps.
  const cache = new Map<
    string,
    (key: string, vars?: Record<string, string | number>) => string
  >();
  return {
    useTranslations: (namespace: string) => {
      if (!cache.has(namespace)) {
        cache.set(
          namespace,
          (key, vars) => dictionaries[namespace]?.[key] ?? key
        );
      }
      return cache.get(namespace)!;
    },
  };
});

// Monday Oct 19 2026 — a week that stays inside one month.
const weekStart = getWeekStart(new Date(2026, 9, 21));

describe('CalendarToolbar', () => {
  it('renders the week label and navigation actions', () => {
    render(
      <CalendarToolbar
        weekStart={weekStart}
        onPreviousWeek={vi.fn()}
        onNextWeek={vi.fn()}
        onToday={vi.fn()}
        onNewEvent={vi.fn()}
      />
    );

    expect(screen.getByText('Oct 19 – 25, 2026')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Previous week' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Next week' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'New event' })
    ).toBeInTheDocument();
  });

  it('wires every action to its callback', async () => {
    const user = userEvent.setup();
    const onPreviousWeek = vi.fn();
    const onNextWeek = vi.fn();
    const onToday = vi.fn();
    const onNewEvent = vi.fn();

    render(
      <CalendarToolbar
        weekStart={weekStart}
        onPreviousWeek={onPreviousWeek}
        onNextWeek={onNextWeek}
        onToday={onToday}
        onNewEvent={onNewEvent}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Previous week' }));
    await user.click(screen.getByRole('button', { name: 'Today' }));
    await user.click(screen.getByRole('button', { name: 'Next week' }));
    await user.click(screen.getByRole('button', { name: 'New event' }));

    expect(onPreviousWeek).toHaveBeenCalledTimes(1);
    expect(onToday).toHaveBeenCalledTimes(1);
    expect(onNextWeek).toHaveBeenCalledTimes(1);
    expect(onNewEvent).toHaveBeenCalledTimes(1);
  });
});
