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

const { calendarService } = await import('./calendar-service');
const { authService } = await import('./auth-service');
import type { CalendarEvent } from '../types/calendar';
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

const event: CalendarEvent = {
  id: 1,
  title: 'Standup',
  description: 'Daily sync',
  category: 'Work',
  startAt: '2026-01-02T10:00:00Z',
  endAt: '2026-01-02T10:30:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('calendarService.getEvents', () => {
  it('always sends both range bounds as from/to query params', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 1, data: [event], message: 'ok' })
    );

    const result = await calendarService.getEvents({
      from: '2026-01-01T00:00:00Z',
      to: '2026-02-01T00:00:00Z',
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      `${API_URL}/calendar-events?from=2026-01-01T00%3A00%3A00Z&to=2026-02-01T00%3A00%3A00Z`
    );
    expect(init?.method).toBeUndefined(); // defaults to GET
    expect(result).toEqual([event]);
  });

  it('returns [] when the list data is null', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 0, data: null, message: 'ok' })
    );

    await expect(
      calendarService.getEvents({
        from: '2026-01-01T00:00:00Z',
        to: '2026-02-01T00:00:00Z',
      })
    ).resolves.toEqual([]);
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(
      calendarService.getEvents({
        from: '2026-01-01T00:00:00Z',
        to: '2026-02-01T00:00:00Z',
      })
    ).rejects.toThrow('Failed to fetch calendar events');
  });
});

describe('calendarService.getEvent', () => {
  it('gets a single event by id and unwraps data', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: event, message: 'ok' })
    );

    const result = await calendarService.getEvent(1);

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/calendar-events/1`);
    expect(result).toEqual(event);
  });

  it('throws the exact error when the event is not found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 404 }));

    await expect(calendarService.getEvent(999)).rejects.toThrow(
      'Calendar event not found'
    );
  });
});

describe('calendarService.createEvent', () => {
  it('posts the plain event fields when recurrence is omitted', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: event, message: 'ok' })
    );

    const result = await calendarService.createEvent({
      title: 'Standup',
      description: 'Daily sync',
      category: 'Work',
      startAt: '2026-01-02T10:00:00Z',
      endAt: '2026-01-02T10:30:00Z',
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/calendar-events`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      title: 'Standup',
      description: 'Daily sync',
      category: 'Work',
      startAt: '2026-01-02T10:00:00Z',
      endAt: '2026-01-02T10:30:00Z',
    });
    expect(result).toEqual(event);
  });

  it('serializes the recurrence block alongside the event fields', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: event, message: 'ok' })
    );

    await calendarService.createEvent({
      title: 'Standup',
      description: 'Daily sync',
      category: 'Work',
      startAt: '2026-01-02T10:00:00Z',
      endAt: '2026-01-02T10:30:00Z',
      recurrence: {
        rule: 'weekly',
        interval: 2,
        until: '2026-06-01T00:00:00Z',
        weekdays: ['monday', 'wednesday'],
      },
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({
      title: 'Standup',
      description: 'Daily sync',
      category: 'Work',
      startAt: '2026-01-02T10:00:00Z',
      endAt: '2026-01-02T10:30:00Z',
      recurrence: {
        rule: 'weekly',
        interval: 2,
        until: '2026-06-01T00:00:00Z',
        weekdays: ['monday', 'wednesday'],
      },
    });
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(
      calendarService.createEvent({
        title: 'Standup',
        description: 'Daily sync',
        category: 'Work',
        startAt: '2026-01-02T10:00:00Z',
        endAt: '2026-01-02T10:30:00Z',
      })
    ).rejects.toThrow('Failed to create calendar event');
  });
});

describe('calendarService.updateEvent', () => {
  it('puts the input as-is when no scope is given', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: event, message: 'ok' })
    );

    const result = await calendarService.updateEvent(1, { title: 'Retro' });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/calendar-events/1`);
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual({ title: 'Retro' });
    expect(result).toEqual(event);
  });

  it('merges the scope into the body when given', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: event, message: 'ok' })
    );

    await calendarService.updateEvent(1, { title: 'Retro' }, 'series');

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({
      title: 'Retro',
      scope: 'series',
    });
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(
      calendarService.updateEvent(1, { title: 'Retro' }, 'occurrence')
    ).rejects.toThrow('Failed to update calendar event');
  });
});

describe('calendarService.deleteEvent', () => {
  it('sends a DELETE without a query when no scope is given', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(calendarService.deleteEvent(1)).resolves.toBeUndefined();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/calendar-events/1`);
    expect(init?.method).toBe('DELETE');
  });

  it('appends the scope as a query param when given', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await calendarService.deleteEvent(1, 'series');

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/calendar-events/1?scope=series`);
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(calendarService.deleteEvent(1, 'occurrence')).rejects.toThrow(
      'Failed to delete calendar event'
    );
  });
});
