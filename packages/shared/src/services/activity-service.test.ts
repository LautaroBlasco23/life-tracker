import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setStorageAdapter } from '../lib/storage';

// activityService is a module singleton whose requests go through
// authService, which hydrates from storage at import time. The in-memory
// adapter is installed before the import below so the singletons start from
// a clean, controlled storage backend.

const store = new Map<string, string>();
setStorageAdapter({
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, value),
  removeItem: (key) => store.delete(key),
});

const { authService } = await import('./auth-service');
const { activityService } = await import('./activity-service');
import type { Activity, ActivityRecord, ActivityStats, User } from '../types';

const API_URL = 'http://test-api';

const user: User = {
  id: 1,
  username: 'tester',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const tokens = (accessToken = 'access-1', refreshToken = 'refresh-1') => ({
  accessToken,
  refreshToken,
  expiresIn: 3600,
  tokenType: 'Bearer',
});

// Logs in with a queued login response so each test starts authenticated,
// then clears the mock so a test only sees its own requests.
async function loginAsUser(): Promise<void> {
  vi.mocked(fetch).mockResolvedValueOnce(
    jsonResponse({ data: { tokens: tokens(), user }, message: 'ok' })
  );
  await authService.login({ identifier: 'test@example.com', password: 'secret' });
  vi.mocked(fetch).mockClear();
}

const activity: Activity = {
  id: 7,
  userId: 1,
  title: 'Drink water',
  description: 'Eight glasses',
  completionAmount: 8,
  frequency: 'daily',
  dayTime: 'morning',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  todayCompletions: 0,
  isCompletedToday: false,
};

const record: ActivityRecord = {
  id: 'rec-1',
  activityId: 7,
  userId: 1,
  completionDate: '2026-11-17',
  createdAt: '2026-11-17T08:00:00Z',
};

const stats: ActivityStats = {
  activityId: 7,
  title: 'Drink water',
  totalCompletions: 42,
  currentStreak: 3,
  longestStreak: 10,
  completionRate: 0.8,
  recentRecords: [],
};

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', API_URL);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 500 }))
  );
});

afterEach(async () => {
  await authService.logout();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  store.clear();
});

describe('activityService.getActivities', () => {
  it('gets activities without a query string when no filter is given', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 1, data: [activity], message: 'ok' })
    );

    const result = await activityService.getActivities();

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/activities`);
    expect(result).toEqual([activity]);
  });

  it('serializes filter params into camelCase backend query params', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 0, data: [], message: 'ok' })
    );

    await activityService.getActivities({
      frequency: 'weekly',
      dayTime: 'morning',
      scheduledFor: '2026-11-17',
    });

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      `${API_URL}/activities?frequency=weekly&day_time=morning&scheduled_for=2026-11-17`
    );
  });

  it('omits the query string for an empty filter or unset filter keys', async () => {
    await loginAsUser();
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ count: 0, data: [], message: 'ok' }))
      .mockResolvedValueOnce(jsonResponse({ count: 0, data: [], message: 'ok' }));

    await activityService.getActivities({});
    await activityService.getActivities({ frequency: undefined });

    const urls = vi.mocked(fetch).mock.calls.map(([url]) => url);
    expect(urls).toEqual([`${API_URL}/activities`, `${API_URL}/activities`]);
  });

  it('returns [] when the backend data is null', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 0, data: null, message: 'ok' })
    );

    await expect(activityService.getActivities()).resolves.toEqual([]);
  });

  it('throws when the response is not ok', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }));

    await expect(activityService.getActivities()).rejects.toThrow(
      'Failed to fetch activities'
    );
  });
});

describe('activityService.getActivitiesByUserId', () => {
  it('delegates to getActivities and returns the list', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 1, data: [activity], message: 'ok' })
    );

    await expect(activityService.getActivitiesByUserId()).resolves.toEqual([
      activity,
    ]);
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/activities`);
  });
});

describe('activityService.getTodayActivities', () => {
  it('gets today activities and unwraps the list response', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 1, data: [activity], message: 'ok' })
    );

    const result = await activityService.getTodayActivities();

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/activities/today`);
    expect(result).toEqual([activity]);
  });

  it('returns [] when the backend data is null', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 0, data: null, message: 'ok' })
    );

    await expect(activityService.getTodayActivities()).resolves.toEqual([]);
  });

  it("throws with today's activities message when the response is not ok", async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }));

    await expect(activityService.getTodayActivities()).rejects.toThrow(
      "Failed to fetch today's activities"
    );
  });
});

describe('activityService.getActivity', () => {
  it('gets a single activity by id', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: activity, message: 'ok' })
    );

    const result = await activityService.getActivity(7);

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/activities/7`);
    expect(result).toEqual(activity);
  });

  it('throws when the activity is not found', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 404 }));

    await expect(activityService.getActivity(7)).rejects.toThrow(
      'Activity not found'
    );
  });
});

describe('activityService.createActivity', () => {
  it('posts the payload with dayFrequency serialized as JSON string', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: activity, message: 'created' })
    );

    const result = await activityService.createActivity({
      title: 'Stretch',
      description: 'Five minutes',
      completionAmount: 1,
      frequency: 'weekly',
      dayFrequency: ['monday', 'friday'],
      dayTime: 'evening',
      privacyStatus: 'private',
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/activities`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      title: 'Stretch',
      description: 'Five minutes',
      completionAmount: 1,
      frequency: 'weekly',
      dayFrequency: '["monday","friday"]',
      dayTime: 'evening',
      privacyStatus: 'private',
    });
    expect(result).toEqual(activity);
  });

  it('omits optional fields when not provided', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: activity, message: 'created' })
    );

    await activityService.createActivity({
      title: 'Read',
      description: '30 minutes',
      completionAmount: 1,
      frequency: 'daily',
      dayTime: 'morning',
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({
      title: 'Read',
      description: '30 minutes',
      completionAmount: 1,
      frequency: 'daily',
      dayTime: 'morning',
    });
  });

  it('throws when creation fails', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 400 }));

    await expect(
      activityService.createActivity({
        title: 'Read',
        description: '30 minutes',
        completionAmount: 1,
        frequency: 'daily',
        dayTime: 'morning',
      })
    ).rejects.toThrow('Failed to create activity');
  });
});

describe('activityService.updateActivity', () => {
  it('puts updates with dayFrequency serialized as JSON string', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: activity, message: 'ok' })
    );

    const result = await activityService.updateActivity(7, {
      title: 'New title',
      isActive: false,
      frequency: 'weekly',
      dayFrequency: ['saturday'],
      dayTime: 'afternoon',
      privacyStatus: 'public',
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/activities/7`);
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual({
      title: 'New title',
      isActive: false,
      frequency: 'weekly',
      dayFrequency: '["saturday"]',
      dayTime: 'afternoon',
      privacyStatus: 'public',
    });
    expect(result).toEqual(activity);
  });

  it('sends an empty body when no optional fields are set', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: activity, message: 'ok' })
    );

    await activityService.updateActivity(7, {});

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({});
  });

  it('throws when the update fails', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }));

    await expect(
      activityService.updateActivity(7, { title: 'Nope' })
    ).rejects.toThrow('Failed to update activity');
  });
});

describe('activityService.deleteActivity', () => {
  it('sends a DELETE request to the activity URL', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(activityService.deleteActivity(7)).resolves.toBeUndefined();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/activities/7`);
    expect(init?.method).toBe('DELETE');
  });

  it('throws when the delete fails', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }));

    await expect(activityService.deleteActivity(7)).rejects.toThrow(
      'Failed to delete activity'
    );
  });
});

describe('activityService.recordActivity', () => {
  it('posts an empty payload by default', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: record, message: 'created' })
    );

    const result = await activityService.recordActivity(7);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/activities/7/record`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({});
    expect(result).toEqual(record);
  });

  it('posts completionDate and notes only when provided', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: record, message: 'created' })
    );

    await activityService.recordActivity(7, {
      completionDate: '2026-11-17',
      notes: 'Felt great',
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({
      completionDate: '2026-11-17',
      notes: 'Felt great',
    });
  });

  it('omits falsy optional fields from the payload', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: record, message: 'created' })
    );

    await activityService.recordActivity(7, {
      completionDate: undefined,
      notes: '',
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({});
  });

  it('throws when recording fails', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }));

    await expect(activityService.recordActivity(7)).rejects.toThrow(
      'Failed to record activity'
    );
  });
});

describe('activityService.getActivityRecords', () => {
  it('gets records for an activity and unwraps the list response', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 1, data: [record], message: 'ok' })
    );

    const result = await activityService.getActivityRecords(7);

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/activities/7/records`);
    expect(result).toEqual([record]);
  });

  it('returns [] when the backend data is null', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 0, data: null, message: 'ok' })
    );

    await expect(activityService.getActivityRecords(7)).resolves.toEqual([]);
  });

  it('throws when fetching records fails', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }));

    await expect(activityService.getActivityRecords(7)).rejects.toThrow(
      'Failed to fetch activity records'
    );
  });
});

describe('activityService.getActivityStats', () => {
  it('gets stats for an activity', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: stats, message: 'ok' })
    );

    const result = await activityService.getActivityStats(7);

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/activities/7/stats`);
    expect(result).toEqual(stats);
  });

  it('throws when fetching stats fails', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }));

    await expect(activityService.getActivityStats(7)).rejects.toThrow(
      'Failed to fetch activity stats'
    );
  });
});

describe('activityService.getGlobalStreak', () => {
  it('gets the global streak', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: { current: 3, longest: 10 }, message: 'ok' })
    );

    const result = await activityService.getGlobalStreak();

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/activities/streak`);
    expect(result).toEqual({ current: 3, longest: 10 });
  });

  it('throws when fetching the streak fails', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }));

    await expect(activityService.getGlobalStreak()).rejects.toThrow(
      'Failed to fetch global streak'
    );
  });
});

describe('activityService.revertLastCompletion', () => {
  it('sends a DELETE with a targetDate body when given', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(
      activityService.revertLastCompletion(7, '2026-11-16')
    ).resolves.toBeUndefined();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/activities/7/revert`);
    expect(init?.method).toBe('DELETE');
    expect(JSON.parse(init?.body as string)).toEqual({
      targetDate: '2026-11-16',
    });
  });

  it('sends no body when no targetDate is given', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await activityService.revertLastCompletion(7);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/activities/7/revert`);
    expect(init?.method).toBe('DELETE');
    expect(init?.body).toBeUndefined();
  });

  it('throws when the revert fails', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }));

    await expect(activityService.revertLastCompletion(7)).rejects.toThrow(
      'Failed to revert completion'
    );
  });
});

describe('activityService.incrementActivityProgress', () => {
  it('records a completion then refetches the activity', async () => {
    await loginAsUser();
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ data: record, message: 'created' }))
      .mockResolvedValueOnce(jsonResponse({ data: activity, message: 'ok' }));

    const result = await activityService.incrementActivityProgress(
      7,
      '2026-11-17'
    );

    expect(vi.mocked(fetch).mock.calls).toHaveLength(2);
    const [recordUrl, recordInit] = vi.mocked(fetch).mock.calls[0];
    expect(recordUrl).toBe(`${API_URL}/activities/7/record`);
    expect(recordInit?.method).toBe('POST');
    expect(JSON.parse(recordInit?.body as string)).toEqual({
      completionDate: '2026-11-17',
    });
    const [getUrl] = vi.mocked(fetch).mock.calls[1];
    expect(getUrl).toBe(`${API_URL}/activities/7`);
    expect(result).toEqual(activity);
  });
});

describe('activityService.parseDayFrequency', () => {
  it('parses a serialized dayFrequency string', () => {
    expect(activityService.parseDayFrequency('["monday","friday"]')).toEqual([
      'monday',
      'friday',
    ]);
  });

  it('returns [] for undefined or empty input', () => {
    expect(activityService.parseDayFrequency()).toEqual([]);
    expect(activityService.parseDayFrequency('')).toEqual([]);
  });

  it('returns [] for malformed JSON', () => {
    expect(activityService.parseDayFrequency('{not-json')).toEqual([]);
  });
});
