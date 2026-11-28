import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEvent } from '@shared/types/calendar';
import { calendarService } from '@shared/services/calendar-service';
import { showToast } from '@/lib/toast';
import { useWeekEvents } from './use-week-events';
import { getWeekStart } from '../lib/week';

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

// Key-fallback translation mock; the function identity is stable per
// namespace because `t` sits in the hook's effect dependency list.
vi.mock('@shared/contexts/language-context', () => {
  const dictionaries: Record<string, Record<string, string>> = {
    calendar: {
      failedToLoad: 'Failed to load calendar',
    },
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

const weekStart = getWeekStart(new Date(2026, 9, 21)); // Mon Oct 19 2026

function defer<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useWeekEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the events overlapping the requested week', async () => {
    vi.mocked(calendarService.getEvents).mockResolvedValue(events);

    const { result } = renderHook(() => useWeekEvents(weekStart));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(calendarService.getEvents).toHaveBeenCalledWith({
      from: weekStart.toISOString(),
      to: new Date(2026, 9, 26).toISOString(),
    });
    expect(result.current.events).toEqual(events);
  });

  it('clears the week and toasts when loading fails', async () => {
    vi.mocked(calendarService.getEvents).mockRejectedValue(
      new Error('network down')
    );

    const { result } = renderHook(() => useWeekEvents(weekStart));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.events).toEqual([]);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Failed to load calendar' })
    );
  });

  it('refetches when reload is called', async () => {
    vi.mocked(calendarService.getEvents).mockResolvedValue(events);

    const { result } = renderHook(() => useWeekEvents(weekStart));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.reload();
    });

    await waitFor(() =>
      expect(calendarService.getEvents).toHaveBeenCalledTimes(2)
    );
    expect(result.current.events).toEqual(events);
  });

  it('drops responses for a week the user already left', async () => {
    const first = defer<CalendarEvent[]>();
    const second = defer<CalendarEvent[]>();
    vi.mocked(calendarService.getEvents)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const nextWeekStart = getWeekStart(new Date(2026, 9, 28));
    const { result, rerender } = renderHook(
      ({ weekStart: start }: { weekStart: Date }) => useWeekEvents(start),
      { initialProps: { weekStart } }
    );
    rerender({ weekStart: nextWeekStart });

    // A late response for the old week must not reach the grid.
    act(() => first.resolve(events));
    expect(result.current.events).toEqual([]);

    // The response for the current week wins.
    act(() => second.resolve(events));
    await waitFor(() => expect(result.current.events).toEqual(events));
  });
});
