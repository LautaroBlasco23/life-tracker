import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { timeService } from '@shared/services/time-service';
import { showToast } from '@/lib/toast';
import {
  getElapsedSeconds,
  useActiveSessions,
  type ActiveTimeSession,
} from './use-active-sessions';

vi.mock('@shared/services/time-service', () => ({
  timeService: {
    getRecords: vi.fn(),
    getRecord: vi.fn(),
    createRecord: vi.fn(),
    updateRecord: vi.fn(),
    deleteRecord: vi.fn(),
    getStats: vi.fn(),
  },
}));

vi.mock('@/lib/toast', () => ({
  showToast: vi.fn(),
}));

// Key-fallback translation mock; stable identity per namespace.
vi.mock('@shared/contexts/language-context', () => {
  const dictionaries: Record<string, Record<string, string>> = {
    time: {
      categoryRequired: 'Category required',
      descriptionRequired: 'Description required',
      timeRecorded: 'Time recorded',
      failedToSave: 'Failed to save',
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

const STORAGE_KEY = 'time_active_sessions';

// Deterministic "now": 2026-10-21 10:00 local.
const BASE = new Date(2026, 9, 21, 10, 0, 0).getTime();

function storedSession(overrides: Partial<ActiveTimeSession> = {}) {
  return {
    id: 's1',
    category: 'Study',
    description: 'Papers',
    startedAt: null,
    accumulatedSeconds: 60,
    ...overrides,
  };
}

function seedStorage(sessions: unknown) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

describe('getElapsedSeconds', () => {
  it('adds the running seconds on top of the frozen ones', () => {
    expect(
      getElapsedSeconds(
        storedSession({ startedAt: BASE, accumulatedSeconds: 30 }),
        BASE + 65_000
      )
    ).toBe(95);
  });

  it('counts only the frozen seconds while paused', () => {
    expect(
      getElapsedSeconds(storedSession({ startedAt: null }), BASE + 65_000)
    ).toBe(60);
  });
});

describe('useActiveSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers({ now: BASE });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hydrates persisted sessions on mount', () => {
    seedStorage([storedSession()]);

    const { result } = renderHook(() => useActiveSessions());

    expect(result.current.sessions).toEqual([storedSession()]);
  });

  it('drops corrupted storage and removes the key', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json{');

    const { result } = renderHook(() => useActiveSessions());

    expect(result.current.sessions).toEqual([]);
    // The persist effect writes the emptied list back over the corrupt value.
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'x')).toEqual([]);
  });

  it('ignores non-array storage payloads', () => {
    seedStorage({ id: 's1' });

    const { result } = renderHook(() => useActiveSessions());

    expect(result.current.sessions).toEqual([]);
  });

  it('filters out entries with malformed shapes', () => {
    seedStorage([
      storedSession(),
      { id: 42, category: 'Work' },
      { id: 's2', category: 'Work', description: 'x' },
    ]);

    const { result } = renderHook(() => useActiveSessions());

    expect(result.current.sessions).toEqual([storedSession()]);
  });

  it('persists session changes back to storage', () => {
    const { result } = renderHook(() => useActiveSessions());

    act(() => {
      result.current.start('Work', 'Emails');
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      category: 'Work',
      description: 'Emails',
      accumulatedSeconds: 0,
    });
    expect(stored[0].startedAt).toBe(BASE);
  });

  it('refuses to start without a category', () => {
    const { result } = renderHook(() => useActiveSessions());

    let started = true;
    act(() => {
      started = result.current.start('', 'Something');
    });

    expect(started).toBe(false);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Category required' })
    );
    expect(result.current.sessions).toEqual([]);
  });

  it('pauses a running session and freezes its seconds', () => {
    seedStorage([storedSession({ id: 's1', startedAt: BASE })]);
    const { result } = renderHook(() => useActiveSessions());

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    act(() => {
      result.current.pause('s1');
    });

    const session = result.current.sessions[0];
    expect(session.startedAt).toBeNull();
    expect(session.accumulatedSeconds).toBe(70); // 60 frozen + 10 running
  });

  it('resumes a paused session', () => {
    seedStorage([storedSession({ id: 's1' })]);
    const { result } = renderHook(() => useActiveSessions());

    act(() => {
      result.current.resume('s1');
    });

    expect(result.current.sessions[0].startedAt).toBe(BASE);
  });

  it('discards a session', () => {
    seedStorage([storedSession(), storedSession({ id: 's2' })]);
    const { result } = renderHook(() => useActiveSessions());

    act(() => {
      result.current.discard('s1');
    });

    expect(result.current.sessions.map((s) => s.id)).toEqual(['s2']);
  });

  it('refuses to save a session without a description', async () => {
    const session = storedSession({ description: '' });
    const { result } = renderHook(() => useActiveSessions());

    let saved = true;
    await act(async () => {
      saved = await result.current.save(session);
    });

    expect(saved).toBe(false);
    expect(timeService.createRecord).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Description required' })
    );
  });

  it('saves the elapsed time and removes the session', async () => {
    vi.mocked(timeService.createRecord).mockResolvedValue({
      id: 9,
      category: 'Study',
      description: 'Papers',
      durationMinutes: 2,
      createdAt: '',
      updatedAt: '',
    });
    seedStorage([storedSession({ startedAt: BASE })]);
    const onSaved = vi.fn();
    const { result } = renderHook(() => useActiveSessions(onSaved));

    act(() => {
      vi.advanceTimersByTime(120_000);
    });

    let saved = false;
    await act(async () => {
      saved = await result.current.save(result.current.sessions[0]);
    });

    expect(saved).toBe(true);
    // 60 frozen seconds + 120 running seconds, rounded up to whole minutes.
    expect(timeService.createRecord).toHaveBeenCalledWith({
      category: 'Study',
      description: 'Papers',
      durationMinutes: 3,
    });
    expect(result.current.sessions).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('[]');
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Time recorded' })
    );
  });

  it('keeps the session and surfaces the error when saving fails', async () => {
    vi.mocked(timeService.createRecord).mockRejectedValue(new Error('boom'));
    seedStorage([storedSession()]);
    const { result } = renderHook(() => useActiveSessions());

    let saved = true;
    await act(async () => {
      saved = await result.current.save(result.current.sessions[0]);
    });

    expect(saved).toBe(false);
    expect(result.current.sessions).toHaveLength(1);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Failed to save', description: 'boom' })
    );
  });
});
