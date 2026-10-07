import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setStorageAdapter } from '../lib/storage';

// authService is a module singleton; its constructor reads storage at import
// time. The in-memory adapter is installed before the import below so the
// singleton starts from a clean, controlled storage backend.

const store = new Map<string, string>();
setStorageAdapter({
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, value),
  removeItem: (key) => store.delete(key),
});

const { authService } = await import('./auth-service');
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

describe('authService.login', () => {
  it('posts credentials, persists tokens and notifies auth change', async () => {
    const onAuthChange = vi.fn();
    authService.onAuthChange(onAuthChange);

    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: { tokens: tokens(), user }, message: 'ok' })
    );

    const result = await authService.login({
      identifier: 'test@example.com',
      password: 'secret',
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/auth/login`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      identifier: 'test@example.com',
      password: 'secret',
    });
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-Timezone': expect.any(String),
    });

    expect(result).toEqual({ user, token: 'access-1' });
    expect(authService.isAuthenticated()).toBe(true);
    expect(store.get('accessToken')).toBe('access-1');
    expect(store.get('refreshToken')).toBe('refresh-1');
    expect(onAuthChange).toHaveBeenCalledWith(true);
  });

  it('maps backend error responses to friendly messages', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: 'invalid credentials' }, 401)
    );

    await expect(
      authService.login({ identifier: 'test@example.com', password: 'wrong' })
    ).rejects.toThrow('Invalid email or password');
    expect(authService.isAuthenticated()).toBe(false);
  });
});

describe('authService.refreshAccessToken', () => {
  it('throws when no refresh token is available', async () => {
    await expect(authService.refreshAccessToken()).rejects.toThrow(
      'No refresh token available'
    );
  });

  it('exchanges the refresh token and persists the new pair', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: tokens('access-2', 'refresh-2') })
    );
    store.set('refreshToken', 'refresh-1');
    // Simulate an expired access token without touching privates:
    (authService as unknown as { refreshToken: string }).refreshToken =
      'refresh-1';

    const token = await authService.refreshAccessToken();

    expect(token).toBe('access-2');
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/auth/refresh`);
    expect(JSON.parse(init?.body as string)).toEqual({
      refreshToken: 'refresh-1',
    });
    expect(store.get('accessToken')).toBe('access-2');
    expect(store.get('refreshToken')).toBe('refresh-2');
  });
});

describe('authService.makeAuthenticatedRequest', () => {
  it('sends the Bearer token and retries once after a 401 refresh', async () => {
    // The service mutates one headers object across the retry, so snapshot
    // each call's headers at request time instead of holding references.
    const requestLog: Array<{ url: string; headers: Record<string, string> }> =
      [];
    const queue: Response[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        requestLog.push({
          url: String(url),
          headers: { ...(init?.headers as Record<string, string>) },
        });
        return queue.shift() ?? new Response('{}', { status: 500 });
      })
    );
    queue.push(
      jsonResponse({ data: { tokens: tokens(), user }, message: 'ok' }),
      new Response('', { status: 401 }),
      jsonResponse({ data: tokens('access-2', 'refresh-2') }),
      jsonResponse({ ok: true })
    );

    await authService.login({ identifier: 'test@example.com', password: 'secret' });

    const response = await authService.makeAuthenticatedRequest(
      `${API_URL}/notes`
    );

    expect(response.status).toBe(200);
    expect(requestLog).toHaveLength(4);

    expect(requestLog[0].url).toBe(`${API_URL}/auth/login`);
    expect(requestLog[1].url).toBe(`${API_URL}/notes`);
    expect(requestLog[1].headers.Authorization).toBe('Bearer access-1');
    expect(requestLog[2].url).toBe(`${API_URL}/auth/refresh`);
    expect(requestLog[3].url).toBe(`${API_URL}/notes`);
    expect(requestLog[3].headers.Authorization).toBe('Bearer access-2');
  });

  it('logs out and throws when the refresh attempt fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ data: { tokens: tokens(), user }, message: 'ok' }))
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('', { status: 401 }));

    await authService.login({ identifier: 'test@example.com', password: 'secret' });

    await expect(
      authService.makeAuthenticatedRequest(`${API_URL}/notes`)
    ).rejects.toThrow('Session expired');
    expect(authService.isAuthenticated()).toBe(false);
    expect(store.get('accessToken')).toBeUndefined();
  });

  it('throws when not authenticated at all', async () => {
    await expect(
      authService.makeAuthenticatedRequest(`${API_URL}/notes`)
    ).rejects.toThrow('Not authenticated');
  });
});
