import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FollowerItem, PublicUserCard } from '@shared/types/user';
import { socialService } from '@shared/services/social-service';
import { showToast } from '@/lib/toast';

vi.mock('@shared/services/social-service', () => ({
  socialService: {
    getPendingFollowRequests: vi.fn(),
    searchUsers: vi.fn(),
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
    acceptFollowRequest: vi.fn(),
    rejectFollowRequest: vi.fn(),
    getUserProfile: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    getMySubscriptions: vi.fn(),
  },
}));

vi.mock('@/lib/toast', () => ({
  showToast: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/components/navigation', () => ({
  Navigation: () => <nav data-testid="navigation" />,
}));

vi.mock('@/components/auth-guard', () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Memoized per namespace: the real useTranslations wraps its result in
// useCallback, and the page keys its debounced-search callback off t.
vi.mock('@shared/contexts/language-context', () => {
  const dicts: Record<string, Record<string, string>> = {
    social: {
      title: 'Social',
      description: 'Social description',
      search: 'Search',
      requests: 'Requests',
      searchPlaceholder: 'Search by username',
      searchResults: '{count} results',
      noResults: 'No results',
      tryDifferentSearch: 'Try a different search',
      findFriends: 'Find friends',
      pendingRequests: '{count} pending',
      wantsToFollow: 'wants to follow you',
      reject: 'Reject',
      accept: 'Accept',
      noPendingRequests: 'No pending requests',
      requestsAppearHere: 'They will appear here',
      follow: 'Follow',
      following: 'Following',
      pending: 'Pending',
      unfollowed: 'Unfollowed',
      noLongerFollowing: 'Not following {name} anymore',
      followed: 'Followed',
      nowFollowing: 'Following {name}',
      requestSent: 'Request sent',
      followRequestPending: 'Waiting for {name}',
      followFailed: 'Follow failed',
      unfollowFailed: 'Unfollow failed',
      requestAccepted: 'Accepted',
      followRequestAccepted: 'You can see their content',
      requestRejected: 'Rejected',
      followRequestRejected: 'Request rejected',
      acceptFailed: 'Accept failed',
      rejectFailed: 'Reject failed',
      private: 'Private',
      viewProfile: 'View profile',
      searchFailed: 'Search failed',
    },
    common: {},
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

import SocialPage from './page';

const mockSocialService = vi.mocked(socialService);
const mockRouter = vi.mocked(useRouter);

function makeUser(
  overrides: Partial<PublicUserCard> & { id: number }
): PublicUserCard {
  return {
    username: `user${overrides.id}`,
    firstName: 'Ana',
    lastName: 'Garcia',
    profilePrivacyStatus: 'public',
    isFollowing: false,
    ...overrides,
  };
}

const pendingRequests: FollowerItem[] = [
  { userId: 7, firstName: 'Luis', lastName: 'Martinez', username: 'luism' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockSocialService.getPendingFollowRequests.mockResolvedValue([]);
  mockSocialService.searchUsers.mockResolvedValue([]);
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
});

describe('SocialPage — pending requests', () => {
  it('loads pending follow requests on mount and badges the tab', async () => {
    mockSocialService.getPendingFollowRequests.mockResolvedValue(
      pendingRequests
    );
    render(<SocialPage />);

    await waitFor(() =>
      expect(mockSocialService.getPendingFollowRequests).toHaveBeenCalled()
    );
    await waitFor(() => {
      const requestsTab = screen.getByRole('tab', { name: /Requests/ });
      expect(within(requestsTab).getByText('1')).toBeInTheDocument();
    });
  });

  it('renders pending requests with accept and reject actions', async () => {
    mockSocialService.getPendingFollowRequests.mockResolvedValue(
      pendingRequests
    );
    render(<SocialPage />);

    // Pending requests render inside the requests tab.
    await waitFor(() =>
      expect(mockSocialService.getPendingFollowRequests).toHaveBeenCalled()
    );
    await userEvent.click(screen.getByRole('tab', { name: /Requests/ }));

    expect(await screen.findByText('Luis Martinez')).toBeInTheDocument();

    expect(screen.getByText('wants to follow you')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Accept/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject/ })).toBeInTheDocument();
  });

  it('accepts a request and removes it from the list', async () => {
    const user = userEvent.setup();
    mockSocialService.getPendingFollowRequests.mockResolvedValue(
      pendingRequests
    );
    mockSocialService.acceptFollowRequest.mockResolvedValue(undefined);
    render(<SocialPage />);
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /1/ })).toBeInTheDocument()
    );
    await user.click(screen.getByRole('tab', { name: /Requests/ }));
    await user.click(screen.getByRole('button', { name: /Accept/ }));

    await waitFor(() =>
      expect(mockSocialService.acceptFollowRequest).toHaveBeenCalledWith(7)
    );
    await waitFor(() =>
      expect(screen.queryByText('Luis Martinez')).not.toBeInTheDocument()
    );
    expect(showToast).toHaveBeenCalledWith({
      title: 'Accepted',
      description: 'You can see their content',
    });
  });

  it('rejects a request and removes it from the list', async () => {
    const user = userEvent.setup();
    mockSocialService.getPendingFollowRequests.mockResolvedValue(
      pendingRequests
    );
    mockSocialService.rejectFollowRequest.mockResolvedValue(undefined);
    render(<SocialPage />);
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /1/ })).toBeInTheDocument()
    );
    await user.click(screen.getByRole('tab', { name: /Requests/ }));
    await user.click(screen.getByRole('button', { name: /Reject/ }));

    await waitFor(() =>
      expect(mockSocialService.rejectFollowRequest).toHaveBeenCalledWith(7)
    );
    await waitFor(() =>
      expect(screen.queryByText('Luis Martinez')).not.toBeInTheDocument()
    );
    expect(showToast).toHaveBeenCalledWith({
      title: 'Rejected',
      description: 'Request rejected',
    });
  });

  it('keeps the request and toasts when accepting fails', async () => {
    const user = userEvent.setup();
    mockSocialService.getPendingFollowRequests.mockResolvedValue(
      pendingRequests
    );
    mockSocialService.acceptFollowRequest.mockRejectedValue(
      new Error('offline')
    );
    render(<SocialPage />);
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /1/ })).toBeInTheDocument()
    );
    await user.click(screen.getByRole('tab', { name: /Requests/ }));
    await user.click(screen.getByRole('button', { name: /Accept/ }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        title: 'Accept failed',
        description: 'offline',
        variant: 'destructive',
      })
    );
    expect(screen.getByText('Luis Martinez')).toBeInTheDocument();
  });

  it('shows the empty state when there are no pending requests', async () => {
    render(<SocialPage />);
    await waitFor(() =>
      expect(mockSocialService.getPendingFollowRequests).toHaveBeenCalled()
    );
    await userEvent.click(screen.getByRole('tab', { name: /Requests/ }));

    expect(await screen.findByText('No pending requests')).toBeInTheDocument();
  });
});

describe('SocialPage — search and follow', () => {
  it('searches users (debounced) and renders result cards', async () => {
    const user = userEvent.setup();
    mockSocialService.searchUsers.mockResolvedValue([makeUser({ id: 1 })]);
    render(<SocialPage />);

    await user.type(screen.getByPlaceholderText('Search by username'), 'ana');

    await waitFor(() =>
      expect(mockSocialService.searchUsers).toHaveBeenCalledWith('ana', 20)
    );
    await waitFor(() =>
      expect(screen.getByText('Ana Garcia')).toBeInTheDocument()
    );
    expect(screen.getByText('@user1')).toBeInTheDocument();
    expect(screen.getByText('1 results')).toBeInTheDocument();
  });

  it('navigates to the public profile when a result is clicked', async () => {
    const user = userEvent.setup();
    mockSocialService.searchUsers.mockResolvedValue([makeUser({ id: 1 })]);
    render(<SocialPage />);
    await user.type(screen.getByPlaceholderText('Search by username'), 'ana');
    await waitFor(() =>
      expect(screen.getByText('Ana Garcia')).toBeInTheDocument()
    );

    await user.click(screen.getByText('Ana Garcia'));

    expect(mockRouter().push).toHaveBeenCalledWith('/users?username=user1');
  });

  it('shows the private badge for private profiles', async () => {
    const user = userEvent.setup();
    mockSocialService.searchUsers.mockResolvedValue([
      makeUser({ id: 1, profilePrivacyStatus: 'private' }),
    ]);
    render(<SocialPage />);
    await user.type(screen.getByPlaceholderText('Search by username'), 'ana');

    await waitFor(() =>
      expect(screen.getByText('Private')).toBeInTheDocument()
    );
  });

  it('shows the no-results state for an empty search', async () => {
    const user = userEvent.setup();
    render(<SocialPage />);

    await user.type(
      screen.getByPlaceholderText('Search by username'),
      'nobody'
    );

    await waitFor(() =>
      expect(screen.getByText('No results')).toBeInTheDocument()
    );
  });

  it('toasts a destructive error when the search fails', async () => {
    const user = userEvent.setup();
    mockSocialService.searchUsers.mockRejectedValue(new Error('offline'));
    render(<SocialPage />);

    await user.type(screen.getByPlaceholderText('Search by username'), 'ana');

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        title: 'Search failed',
        description: 'offline',
        variant: 'destructive',
      })
    );
  });

  it('follows a user whose request stays pending', async () => {
    const user = userEvent.setup();
    mockSocialService.searchUsers.mockResolvedValue([makeUser({ id: 1 })]);
    mockSocialService.followUser.mockResolvedValue('pending');
    render(<SocialPage />);
    await userEvent.type(
      screen.getByPlaceholderText('Search by username'),
      'ana'
    );
    await waitFor(() =>
      expect(screen.getByText('Ana Garcia')).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: 'Follow' }));

    await waitFor(() =>
      expect(mockSocialService.followUser).toHaveBeenCalledWith('user1')
    );

    expect(showToast).toHaveBeenCalledWith({
      title: 'Request sent',
      description: 'Waiting for Ana',
    });
  });

  it('follows a user who accepts immediately', async () => {
    const user = userEvent.setup();
    mockSocialService.searchUsers.mockResolvedValue([makeUser({ id: 1 })]);
    mockSocialService.followUser.mockResolvedValue('accepted');
    render(<SocialPage />);
    await userEvent.type(
      screen.getByPlaceholderText('Search by username'),
      'ana'
    );
    await waitFor(() =>
      expect(screen.getByText('Ana Garcia')).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: 'Follow' }));

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Following/ })
      ).toBeInTheDocument()
    );
    expect(showToast).toHaveBeenCalledWith({
      title: 'Followed',
      description: 'Following Ana',
    });
  });

  it('unfollows a followed user', async () => {
    const user = userEvent.setup();
    mockSocialService.searchUsers.mockResolvedValue([
      makeUser({ id: 1, isFollowing: true, followStatus: 'accepted' }),
    ]);
    mockSocialService.unfollowUser.mockResolvedValue(undefined);
    render(<SocialPage />);
    await userEvent.type(
      screen.getByPlaceholderText('Search by username'),
      'ana'
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Following/ })
      ).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: /Following/ }));

    await waitFor(() =>
      expect(mockSocialService.unfollowUser).toHaveBeenCalledWith('user1')
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument()
    );
    expect(showToast).toHaveBeenCalledWith({
      title: 'Unfollowed',
      description: 'Not following Ana anymore',
    });
  });

  it('toasts a destructive error when following fails', async () => {
    const user = userEvent.setup();
    mockSocialService.searchUsers.mockResolvedValue([makeUser({ id: 1 })]);
    mockSocialService.followUser.mockRejectedValue(new Error('offline'));
    render(<SocialPage />);
    await userEvent.type(
      screen.getByPlaceholderText('Search by username'),
      'ana'
    );
    await waitFor(() =>
      expect(screen.getByText('Ana Garcia')).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: 'Follow' }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        title: 'Follow failed',
        description: 'offline',
        variant: 'destructive',
      })
    );
  });
});
