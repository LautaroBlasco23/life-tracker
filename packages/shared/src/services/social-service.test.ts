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
const { socialService } = await import('./social-service');
import type { PublicProfileResponse, PublicUserCard } from '../types';

const API_URL = 'http://test-api';

const user = {
  id: 1,
  username: 'tester',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const alice: PublicUserCard = {
  id: 2,
  username: 'alice',
  firstName: 'Alice',
  lastName: 'Doe',
  profilePrivacyStatus: 'public',
  isFollowing: false,
};

const profile: PublicProfileResponse = {
  id: 2,
  firstName: 'Alice',
  lastName: 'Doe',
  username: 'alice',
  profilePrivacyStatus: 'public',
  isFollowing: false,
  followersCount: 3,
  followingCount: 1,
  publicRoutinesCount: 2,
  publicActivitiesCount: 5,
  canViewContent: true,
  routines: [],
  activities: [],
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

describe('socialService.searchUsers', () => {
  it('encodes the query and default limit as query params', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 1, data: [alice], message: 'ok' })
    );

    const result = await socialService.searchUsers('ali');

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/users/search?q=ali&limit=20`);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(result).toEqual([alice]);
  });

  it('passes a custom limit and spaces encoded in the query', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ count: 0, data: [] }));

    await socialService.searchUsers('ali do', 5);

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/users/search?q=ali+do&limit=5`);
  });

  it('returns [] when the backend sends null data', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 0, data: null, message: 'ok' })
    );

    await expect(socialService.searchUsers('ali')).resolves.toEqual([]);
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(socialService.searchUsers('ali')).rejects.toThrow(
      'Failed to search users'
    );
  });
});

describe('socialService.getUserProfile', () => {
  it('fetches the public profile by username', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: profile, message: 'ok' }));

    const result = await socialService.getUserProfile('alice');

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/users/alice/profile`);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(result).toEqual(profile);
  });

  it('maps a 404 to the friendly not-found message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 404 }));

    await expect(socialService.getUserProfile('ghost')).rejects.toThrow(
      'User not found'
    );
  });

  it('throws the generic message on other failures', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(socialService.getUserProfile('alice')).rejects.toThrow(
      'Failed to fetch user profile'
    );
  });
});

describe('socialService.followUser', () => {
  it('posts to the follow endpoint and returns the status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: { status: 'pending' }, message: 'ok' })
    );

    const status = await socialService.followUser('alice');

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/follows/alice`);
    expect(init?.method).toBe('POST');
    expect(status).toBe('pending');
  });

  it('maps a 404 to the friendly not-found message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 404 }));

    await expect(socialService.followUser('ghost')).rejects.toThrow(
      'User not found'
    );
  });

  it('throws the generic message on other failures', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(socialService.followUser('alice')).rejects.toThrow(
      'Failed to follow user'
    );
  });
});

describe('socialService.unfollowUser', () => {
  it('sends DELETE to the follow endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'ok' }));

    await socialService.unfollowUser('alice');

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/follows/alice`);
    expect(init?.method).toBe('DELETE');
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(socialService.unfollowUser('alice')).rejects.toThrow(
      'Failed to unfollow user'
    );
  });
});

describe('socialService.getPendingFollowRequests', () => {
  it('fetches pending requests and unwraps data', async () => {
    const pending = [{ userId: 2, firstName: 'Alice', lastName: 'Doe', username: 'alice' }];
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: pending, message: 'ok' }));

    const result = await socialService.getPendingFollowRequests();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/follows/pending`);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(result).toEqual(pending);
  });

  it('returns [] when the backend sends null data', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: null, message: 'ok' }));

    await expect(socialService.getPendingFollowRequests()).resolves.toEqual([]);
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(socialService.getPendingFollowRequests()).rejects.toThrow(
      'Failed to fetch pending follow requests'
    );
  });
});

describe('socialService.acceptFollowRequest', () => {
  it('posts to the accept endpoint for the follower id', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'ok' }));

    await socialService.acceptFollowRequest(2);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/follows/pending/2/accept`);
    expect(init?.method).toBe('POST');
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(socialService.acceptFollowRequest(2)).rejects.toThrow(
      'Failed to accept follow request'
    );
  });
});

describe('socialService.rejectFollowRequest', () => {
  it('posts to the reject endpoint for the follower id', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'ok' }));

    await socialService.rejectFollowRequest(2);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/follows/pending/2/reject`);
    expect(init?.method).toBe('POST');
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(socialService.rejectFollowRequest(2)).rejects.toThrow(
      'Failed to reject follow request'
    );
  });
});

describe('socialService.getFollowers', () => {
  it('fetches followers with default pagination params', async () => {
    const page = { items: [alice], total: 1, limit: 25, offset: 0 };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: page, message: 'ok' }));

    const result = await socialService.getFollowers('alice');

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/users/alice/followers?limit=25&offset=0`);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(result).toEqual(page);
  });

  it('passes custom limit and offset', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: { items: [], total: 0, limit: 10, offset: 10 } })
    );

    await socialService.getFollowers('alice', 10, 10);

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/users/alice/followers?limit=10&offset=10`);
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(socialService.getFollowers('alice')).rejects.toThrow(
      'Failed to fetch followers'
    );
  });
});

describe('socialService.getFollowing', () => {
  it('fetches following with default pagination params', async () => {
    const page = { items: [alice], total: 1, limit: 25, offset: 0 };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: page, message: 'ok' }));

    const result = await socialService.getFollowing('alice');

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/users/alice/following?limit=25&offset=0`);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(result).toEqual(page);
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(socialService.getFollowing('alice')).rejects.toThrow(
      'Failed to fetch following'
    );
  });
});

describe('socialService.subscribe', () => {
  it('posts the source type and id', async () => {
    const subscription = { id: 5, sourceType: 'activity', sourceId: 3, clonedId: 9 };
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: subscription, message: 'ok' })
    );

    const result = await socialService.subscribe('activity', 3);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/subscriptions`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      sourceType: 'activity',
      sourceId: 3,
    });
    expect(result).toEqual(subscription);
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(socialService.subscribe('routine', 3)).rejects.toThrow(
      'Failed to subscribe'
    );
  });
});

describe('socialService.unsubscribe', () => {
  it('sends DELETE to the subscription url', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'ok' }));

    await socialService.unsubscribe(5);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/subscriptions/5`);
    expect(init?.method).toBe('DELETE');
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(socialService.unsubscribe(5)).rejects.toThrow(
      'Failed to unsubscribe'
    );
  });
});

describe('socialService.getMySubscriptions', () => {
  it('fetches the subscriptions list and unwraps data', async () => {
    const subs = [{ id: 5, sourceType: 'activity', sourceId: 3, clonedId: 9 }];
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: subs, message: 'ok' }));

    const result = await socialService.getMySubscriptions();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/subscriptions`);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(result).toEqual(subs);
  });

  it('returns [] when the backend sends null data', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: null, message: 'ok' }));

    await expect(socialService.getMySubscriptions()).resolves.toEqual([]);
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(socialService.getMySubscriptions()).rejects.toThrow(
      'Failed to fetch subscriptions'
    );
  });
});
