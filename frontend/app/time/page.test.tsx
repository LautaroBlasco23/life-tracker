import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TimePage from './page';

vi.mock('./views/records-view', () => ({
  RecordsView: () => <div data-testid="records-view">records</div>,
}));

vi.mock('./views/calendar-view', () => ({
  CalendarView: () => <div data-testid="calendar-view">calendar</div>,
}));

vi.mock('@shared/contexts/language-context', () => {
  const dictionaries: Record<string, Record<string, string>> = {
    time: { title: 'Time Tracking' },
    calendar: { tab: 'Calendar', recordsTab: 'Records' },
  };
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

describe('TimePage', () => {
  it('mounts the records tab first and not the calendar', () => {
    render(<TimePage />);

    expect(screen.getByTestId('records-view')).toBeInTheDocument();
    expect(screen.queryByTestId('calendar-view')).toBeNull();
  });

  it('mounts the calendar tab on first visit while keeping records mounted', async () => {
    const user = userEvent.setup();
    render(<TimePage />);

    await user.click(screen.getByRole('tab', { name: 'Calendar' }));

    expect(screen.getByTestId('calendar-view')).toBeInTheDocument();
    // Views stay mounted (hidden) so their state survives tab switches.
    expect(screen.getByTestId('records-view')).toBeInTheDocument();
  });

  it('switches back without unmounting the visited calendar', async () => {
    const user = userEvent.setup();
    render(<TimePage />);

    await user.click(screen.getByRole('tab', { name: 'Calendar' }));
    await user.click(screen.getByRole('tab', { name: 'Records' }));

    expect(screen.getByTestId('records-view')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-view')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Records' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
});
