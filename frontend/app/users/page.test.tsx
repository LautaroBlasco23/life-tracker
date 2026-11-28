import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, useSearchParams } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PublicProfileResponse,
  PublicActivityCard,
  PublicRoutineCard,
} from '@shared/types/user';
import { socialService } from '@shared/services/social-service';
import { authService } from '@shared/services/auth-service';
import { showToast } from '@/lib/toast';

vi.mock('@shared/services/social-service', () => ({
  socialService: {
    getUserProfile: vi.fn(),
    getMySubscriptions: vi.fn(),
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    getPendingFollowRequests: vi.fn(),
    searchUsers: vi.fn(),
    acceptFollowRequest: vi.fn(),
    rejectFollowRequest: vi.fn(),
  },
}));

vi.mock('@shared/services/auth-service', () => ({
  authService: {
    getCurrentUser: vi.fn(),
    isAuthenticated: vi.fn(),
    onAuthChange: vi.fn(() => () => undefined),
  },
}));

vi.mock('@/lib/toast', () => ({
  showToast: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock('@/components/navigation', () => ({
  Navigation: () => <nav data-testid="navigation" />,
}));

vi.mock('@/components/auth-guard', () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Memoized per namespace: the real useTranslations wraps its result in
// useCallback, and the page keys its profile loader off t.
vi.mock('@shared/contexts/language-context', () => {
  const dicts: Record<string, Record<string, string>> = {
    profilePublic: {
      notFound: 'Profile not found',
      errorLoading: 'Error loading profile',
      loading: 'Loading...',
      backToSocial: 'Back to social',
      privateProfile: 'Private profile',
      thisIsYou: 'This is you',
      followers: 'followers',
      following: 'following',
      publicRoutines: 'Public routines',
      publicActivities: 'Public activities',
      noPublicRoutines: 'No public routines',
      noPublicActivities: 'No public activities',
      subscribe: 'Subscribe',
      subscribed: 'Subscribed',
      subscribedToast: 'Subscribed to {name}',
      unsubscribedToast: 'Unsubscribed from {name}',
      subscribeFailed: 'Subscribe failed',
      unsubscribeFailed: 'Unsubscribe failed',
      activitiesCount: '{count} activities',
      streakDays: '{count} day streak',
      lockedMessage: '{name} keeps this private',
      loadingProfile: 'Loading...',
    },
    social: {
      follow: 'Follow',
      following: 'Following',
      pending: 'Pending',
      followFailed: 'Follow failed',
    },
    activities: {},
    common: { error: 'Error' },
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
          (key: string, vars?: Record<string, string | number>) => {
            let str = dicts[namespace]?.[key] ?? key;
            if (vars) {
              for (const [k, v] of Object.entries(vars)) {
                str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
              }
            }
            return str;
          }
        );
      }
      return cache.get(namespace)!;
    },
  };
});

import UsersPage from './page';

const mockSocialService = vi.mocked(socialService);
const mockAuthService = vi.mocked(authService);
const mockRouter = vi.mocked(useRouter);
const mockUseSearchParams = vi.mocked(useSearchParams);

function makeRoutine(
  overrides: Partial<PublicRoutineCard> & { id: number }
): PublicRoutineCard {
  return {
    title: `Routine ${overrides.id}`,
    description: 'a routine',
    activities: [],
    subscribed: false,
    ...overrides,
  };
}

function makeActivity(
  overrides: Partial<PublicActivityCard> & { id: number }
): PublicActivityCard {
  return {
    title: `Activity ${overrides.id}`,
    description: 'an activity',
    frequency: 'daily',
    dayTime: 'morning',
    completionAmount: 1,
    subscribed: false,
    ...overrides,
  };
}

function makeProfile(
  overrides: Partial<PublicProfileResponse> & { id: number }
): PublicProfileResponse {
  return {
    firstName: 'Ana',
    lastName: 'Garcia',
    username: 'ana',
    profilePrivacyStatus: 'public',
    isFollowing: false,
    followersCount: 3,
    followingCount: 5,
    publicRoutinesCount: 0,
    publicActivitiesCount: 0,
    canViewContent: true,
    routines: [],
    activities: [],
    ...overrides,
  };
}

// Drives useSearchParams().get('username') per test.
let usernameParam: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  usernameParam = 'ana';
  mockSocialService.getUserProfile.mockResolvedValue(makeProfile({ id: 2 }));
  mockSocialService.getMySubscriptions.mockResolvedValue([]);
  mockAuthService.getCurrentUser.mockReturnValue(null);
  mockRouter.mockReturnValue({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    // Required by the AppRouterInstance type introduced in Next 16.
    bfcacheId: 'mock-bfcache-id',
  } as ReturnType<typeof useRouter>);
  mockUseSearchParams.mockReturnValue({
    get: (key: string) => (key === 'username' ? usernameParam : null),
  } as unknown as ReturnType<typeof useSearchParams>);
});

async function renderProfile() {
  const user = userEvent.setup();
  render(<UsersPage />);
  await waitFor(() =>
    expect(mockSocialService.getUserProfile).toHaveBeenCalledWith('ana')
  );
  await waitFor(() =>
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  );
  return { user };
}

describe('UsersPage', () => {
  it('shows the not-found error when no username is given', async () => {
    usernameParam = undefined;

    render(<UsersPage />);

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Profile not found' })
      ).toBeInTheDocument()
    );
    expect(mockSocialService.getUserProfile).not.toHaveBeenCalled();
  });

  it('renders the profile header with follower counts', async () => {
    await renderProfile();

    expect(screen.getByText('Ana Garcia')).toBeInTheDocument();
    expect(screen.getByText('@ana')).toBeInTheDocument();
    expect(screen.getByText(/followers/)).toBeInTheDocument();
    expect(screen.getByText(/following/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument();
  });

  it('marks the viewer as self and hides follow/subscribe actions', async () => {
    mockAuthService.getCurrentUser.mockReturnValue({
      id: 2,
      firstName: 'Ana',
      lastName: 'Garcia',
      email: 'ana@example.com',
      createdAt: '',
      updatedAt: '',
    });
    mockSocialService.getUserProfile.mockResolvedValue(
      makeProfile({
        id: 2,
        routines: [makeRoutine({ id: 1, subscribed: true })],
        activities: [makeActivity({ id: 1 })],
      })
    );

    await renderProfile();

    expect(screen.getByText('This is you')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Follow' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Subscribed/ })
    ).not.toBeInTheDocument();
  });

  it('lists routines and activities with counts', async () => {
    mockSocialService.getUserProfile.mockResolvedValue(
      makeProfile({
        id: 2,
        routines: [makeRoutine({ id: 1 })],
        activities: [makeActivity({ id: 1 })],
      })
    );

    await renderProfile();

    expect(screen.getByText('Routine 1')).toBeInTheDocument();
    expect(screen.getByText('Activity 1')).toBeInTheDocument();
    expect(screen.getByText('daily')).toBeInTheDocument(); // frequency via tActivities
  });

  it('shows empty-state cards when there is no public content', async () => {
    await renderProfile();

    expect(screen.getByText('No public routines')).toBeInTheDocument();
    expect(screen.getByText('No public activities')).toBeInTheDocument();
  });

  it('shows the locked card for a private profile', async () => {
    mockSocialService.getUserProfile.mockResolvedValue(
      makeProfile({ id: 2, canViewContent: false })
    );

    await renderProfile();

    expect(screen.getByText('Private profile')).toBeInTheDocument();
    expect(screen.getByText('Ana keeps this private')).toBeInTheDocument();
    expect(screen.queryByText('Public routines')).not.toBeInTheDocument();
  });

  it('follows a user and reflects the pending status', async () => {
    const { user } = await renderProfile();
    mockSocialService.followUser.mockResolvedValue('pending');

    await user.click(screen.getByRole('button', { name: 'Follow' }));

    await waitFor(() =>
      expect(mockSocialService.followUser).toHaveBeenCalledWith('ana')
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Pending' })
      ).toBeInTheDocument()
    );
  });

  it('unfollows a user who is currently followed', async () => {
    mockSocialService.getUserProfile.mockResolvedValue(
      makeProfile({ id: 2, isFollowing: true, followStatus: 'accepted' })
    );
    mockSocialService.unfollowUser.mockResolvedValue(undefined);
    const { user } = await renderProfile();

    await user.click(screen.getByRole('button', { name: /Following/ }));

    await waitFor(() =>
      expect(mockSocialService.unfollowUser).toHaveBeenCalledWith('ana')
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument()
    );
  });

  it('toasts a destructive error when the follow toggle fails', async () => {
    const { user } = await renderProfile();
    mockSocialService.followUser.mockRejectedValue(new Error('offline'));

    await user.click(screen.getByRole('button', { name: 'Follow' }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        title: 'Follow failed',
        description: 'offline',
        variant: 'destructive',
      })
    );
  });

  it('subscribes to a routine and records the subscription id', async () => {
    mockSocialService.getUserProfile.mockResolvedValue(
      makeProfile({
        id: 2,
        routines: [makeRoutine({ id: 1 })],
      })
    );
    mockSocialService.subscribe.mockResolvedValue({
      id: 77,
      sourceType: 'routine',
      sourceId: 1,
      clonedId: 99,
    });
    const { user } = await renderProfile();

    await user.click(screen.getByRole('button', { name: 'Subscribe' }));

    await waitFor(() =>
      expect(mockSocialService.subscribe).toHaveBeenCalledWith('routine', 1)
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Subscribed' })
      ).toBeInTheDocument()
    );
    expect(showToast).toHaveBeenCalledWith({
      title: 'Subscribed to @ana',
    });
  });

  it('unsubscribes using the stored subscription id', async () => {
    mockSocialService.getUserProfile.mockResolvedValue(
      makeProfile({
        id: 2,
        routines: [makeRoutine({ id: 1, subscribed: true })],
      })
    );
    mockSocialService.getMySubscriptions.mockResolvedValue([
      { id: 77, sourceType: 'routine', sourceId: 1, clonedId: 99 },
    ]);
    mockSocialService.unsubscribe.mockResolvedValue(undefined);
    const { user } = await renderProfile();

    await user.click(screen.getByRole('button', { name: 'Subscribed' }));

    await waitFor(() =>
      expect(mockSocialService.unsubscribe).toHaveBeenCalledWith(77)
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Subscribe' })
      ).toBeInTheDocument()
    );
    expect(showToast).toHaveBeenCalledWith({
      title: 'Unsubscribed from @ana',
    });
  });

  it('tolerates a failed subscriptions load and still renders the profile', async () => {
    mockSocialService.getMySubscriptions.mockRejectedValue(
      new Error('offline')
    );

    await renderProfile();

    expect(screen.getByText('Ana Garcia')).toBeInTheDocument();
  });

  it('shows the error state with a back link when loading fails', async () => {
    mockSocialService.getUserProfile.mockRejectedValue(
      new Error('User not found')
    );
    render(<UsersPage />);

    await waitFor(() =>
      expect(screen.getByText('Profile not found')).toBeInTheDocument()
    );
    expect(screen.getByText('User not found')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Back to social' })
    );

    expect(mockRouter().push).toHaveBeenCalledWith('/social');
  });
});
