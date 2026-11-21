import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setStorageAdapter } from '../lib/storage';

// Services are module singletons hydrating from storage at import time; the
// in-memory adapter must be installed before the imports below.

const store = new Map<string, string>();
setStorageAdapter({
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, value),
  removeItem: (key) => store.delete(key),
});

const { authService } = await import('./auth-service');
const { userService } = await import('./user-service');
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

const updatedUser: User = { ...user, firstName: 'Updated' };

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

describe('userService.getMyProfile', () => {
  it('fetches /users/me and caches the returned user', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: updatedUser, message: 'ok' }));

    const result = await userService.getMyProfile();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/users/me`);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(result).toEqual(updatedUser);
    // setCurrentUser persists the user for the next app start.
    expect(authService.getCurrentUser()).toEqual(updatedUser);
    expect(JSON.parse(store.get('currentUser') as string)).toEqual(updatedUser);
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(userService.getMyProfile()).rejects.toThrow(
      'Failed to fetch profile'
    );
  });
});

describe('userService.getUserById', () => {
  it('fetches a user by id', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: user, message: 'ok' }));

    const result = await userService.getUserById(7);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/users/7`);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(result).toEqual(user);
  });

  it('returns null on 404 without throwing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 404 }));

    await expect(userService.getUserById(7)).resolves.toBeNull();
  });

  it('throws on other failures', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(userService.getUserById(7)).rejects.toThrow(
      'Failed to fetch user'
    );
  });
});

describe('userService.updateUser', () => {
  it('puts only the provided fields and caches the result', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: updatedUser, message: 'ok' })
    );

    const result = await userService.updateUser({ firstName: 'Updated' });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/users/me`);
    expect(init?.method).toBe('PUT');
    // Omitted optionals (lastName, timezone, profilePrivacyStatus) are not serialized.
    expect(JSON.parse(init?.body as string)).toEqual({ firstName: 'Updated' });
    expect(result).toEqual(updatedUser);
    expect(authService.getCurrentUser()).toEqual(updatedUser);
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 400 }));

    await expect(userService.updateUser({ firstName: 'X' })).rejects.toThrow(
      'Failed to update user'
    );
  });
});

describe('userService.completeOnboarding', () => {
  it('puts the onboarding endpoint without a body and caches the result', async () => {
    const onboarded: User = { ...user, onboardingCompleted: true };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: onboarded, message: 'ok' }));

    const result = await userService.completeOnboarding();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/users/me/onboarding`);
    expect(init?.method).toBe('PUT');
    expect(init?.body).toBeUndefined();
    expect(result).toEqual(onboarded);
    expect(authService.getCurrentUser()).toEqual(onboarded);
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(userService.completeOnboarding()).rejects.toThrow(
      'Failed to complete onboarding'
    );
  });
});

describe('userService.uploadProfilePicture', () => {
  it('posts a FormData body with the image file and no JSON content type', async () => {
    const file = new File(['image-bytes'], 'avatar.png', { type: 'image/png' });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: user, message: 'ok' }));

    const result = await userService.uploadProfilePicture(file);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/users/me/image`);
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get('image')).toBe(file);
    // FormData bodies must keep the browser-generated multipart boundary,
    // so no explicit Content-Type is set.
    expect((init?.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    expect(result).toEqual(user);
    expect(authService.getCurrentUser()).toEqual(user);
  });

  it('throws on non-ok responses', async () => {
    const file = new File(['image-bytes'], 'avatar.png', { type: 'image/png' });
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(userService.uploadProfilePicture(file)).rejects.toThrow(
      'Failed to upload profile picture'
    );
  });
});

describe('userService.deleteProfilePicture', () => {
  it('deletes the image then refetches the profile', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: 'deleted' }))
      .mockResolvedValueOnce(jsonResponse({ data: user, message: 'ok' }));

    const result = await userService.deleteProfilePicture();

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    const [deleteUrl, deleteInit] = vi.mocked(fetch).mock.calls[0];
    expect(deleteUrl).toBe(`${API_URL}/users/me/image`);
    expect(deleteInit?.method).toBe('DELETE');
    const [profileUrl, profileInit] = vi.mocked(fetch).mock.calls[1];
    expect(profileUrl).toBe(`${API_URL}/users/me`);
    expect(profileInit?.method ?? 'GET').toBe('GET');
    expect(result).toEqual(user);
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(userService.deleteProfilePicture()).rejects.toThrow(
      'Failed to delete profile picture'
    );
  });
});

describe('userService.getAllUsers', () => {
  it('fetches all users and unwraps data', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: [user], message: 'ok' }));

    const result = await userService.getAllUsers();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/users`);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(result).toEqual([user]);
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(userService.getAllUsers()).rejects.toThrow(
      'Failed to fetch users'
    );
  });
});

describe('userService.checkEmailAvailability', () => {
  it('uses raw unauthenticated fetch with an encoded email param', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ available: true, email: 'a b@example.com' })
    );

    const result = await userService.checkEmailAvailability('a b@example.com');

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/users/check-email?email=a%20b%40example.com`);
    // Public endpoint: no headers added (no Authorization, no Content-Type).
    expect(init?.headers).toBeUndefined();
    expect(result).toBe(true);
  });

  it('returns false when the email is taken', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ available: false, email: 'taken@example.com' })
    );

    await expect(userService.checkEmailAvailability('taken@example.com')).resolves.toBe(
      false
    );
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(
      userService.checkEmailAvailability('taken@example.com')
    ).rejects.toThrow('Failed to check email availability');
  });
});
