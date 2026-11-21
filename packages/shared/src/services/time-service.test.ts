import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setStorageAdapter } from '../lib/storage';

// Services are module singletons built on authService, which hydrates from
// storage at import time. The in-memory adapter is installed before the
// import below so the singleton starts from a clean, controlled backend.

const store = new Map<string, string>();
setStorageAdapter({
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, value),
  removeItem: (key) => store.delete(key),
});

const { timeService } = await import('./time-service');
const { authService } = await import('./auth-service');
import type { TimeRecord, TimeStats } from '../types/time';
import type { User } from '../types';

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

beforeEach(async () => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', API_URL);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 500 }))
  );

  vi.mocked(fetch).mockResolvedValueOnce(
    jsonResponse({ data: { tokens: tokens(), user }, message: 'ok' })
  );
  await authService.login({ identifier: 'test@example.com', password: 'secret' });
  vi.mocked(fetch).mockClear();
});

afterEach(async () => {
  await authService.logout();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  store.clear();
});

const record: TimeRecord = {
  id: 1,
  category: 'Work',
  description: 'Deep work',
  durationMinutes: 90,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const stats: TimeStats = {
  totalMinutes: 90,
  recordCount: 1,
  categoryTotals: { Work: 90 },
  topCategory: 'Work',
  topCategoryMinutes: 90,
};

describe('timeService.getRecords', () => {
  it('gets all records without a query string when no params are given', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 1, data: [record], message: 'ok' })
    );

    const result = await timeService.getRecords();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/time-records`);
    expect(init?.method).toBeUndefined(); // defaults to GET
    expect(result).toEqual([record]);
  });

  it('builds the query string from the category/month/year params in order', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 0, data: [], message: 'ok' })
    );

    await timeService.getRecords({ category: 'Work', month: 3, year: 2026 });

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/time-records?category=Work&month=3&year=2026`);
  });

  it('sends a month of 0 instead of treating it as missing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 0, data: [], message: 'ok' })
    );

    await timeService.getRecords({ month: 0 });

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/time-records?month=0`);
  });

  it('returns [] when the list data is null', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 0, data: null, message: 'ok' })
    );

    await expect(timeService.getRecords()).resolves.toEqual([]);
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(timeService.getRecords()).rejects.toThrow(
      'Failed to fetch time records'
    );
  });
});

describe('timeService.getRecord', () => {
  it('gets a single record by id and unwraps data', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: record, message: 'ok' })
    );

    const result = await timeService.getRecord(1);

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/time-records/1`);
    expect(result).toEqual(record);
  });

  it('throws the exact error when the record is not found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 404 }));

    await expect(timeService.getRecord(999)).rejects.toThrow(
      'Time record not found'
    );
  });
});

describe('timeService.createRecord', () => {
  it('posts the full input and unwraps the created record', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: record, message: 'ok' })
    );

    const result = await timeService.createRecord({
      category: 'Work',
      description: 'Deep work',
      durationMinutes: 90,
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/time-records`);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init?.body as string)).toEqual({
      category: 'Work',
      description: 'Deep work',
      durationMinutes: 90,
    });
    expect(result).toEqual(record);
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(
      timeService.createRecord({
        category: 'Work',
        description: 'Deep work',
        durationMinutes: 90,
      })
    ).rejects.toThrow('Failed to create time record');
  });
});

describe('timeService.updateRecord', () => {
  it('puts only the fields that were provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: record, message: 'ok' })
    );

    const result = await timeService.updateRecord(1, { durationMinutes: 45 });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/time-records/1`);
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual({ durationMinutes: 45 });
    expect(result).toEqual(record);
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(
      timeService.updateRecord(1, { category: 'Reading' })
    ).rejects.toThrow('Failed to update time record');
  });
});

describe('timeService.deleteRecord', () => {
  it('sends a DELETE without a body and resolves to nothing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 204 })
    );

    await expect(timeService.deleteRecord(1)).resolves.toBeUndefined();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/time-records/1`);
    expect(init?.method).toBe('DELETE');
    expect(init?.body).toBeUndefined();
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(timeService.deleteRecord(1)).rejects.toThrow(
      'Failed to delete time record'
    );
  });
});

describe('timeService.getStats', () => {
  it('gets stats from the stats endpoint and unwraps data', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: stats, message: 'ok' })
    );

    const result = await timeService.getStats();

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/time-records/stats`);
    expect(result).toEqual(stats);
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(timeService.getStats()).rejects.toThrow(
      'Failed to fetch time stats'
    );
  });
});
