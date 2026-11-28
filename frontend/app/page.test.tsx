import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from './page';
import { authService } from '@shared/services/auth-service';

// Root page is a pure redirect seam: authenticated users land on the
// onboarding guide (first run) or activities, everyone else on /login.

vi.mock('@shared/services/auth-service', () => ({
  authService: {
    isAuthenticated: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

const mockRouter = vi.mocked(useRouter);
const mockAuthService = vi.mocked(authService);

beforeEach(() => {
  vi.clearAllMocks();
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

describe('HomePage', () => {
  it('shows the redirecting placeholder', () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);

    render(<HomePage />);

    expect(screen.getByText('Redirecting...')).toBeVisible();
  });

  it('redirects unauthenticated users to /login', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);

    render(<HomePage />);

    await waitFor(() =>
      expect(mockRouter().push).toHaveBeenCalledWith('/login')
    );
    expect(mockRouter().push).toHaveBeenCalledTimes(1);
  });

  it('redirects returning users to /activities', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(true);
    mockAuthService.getCurrentUser.mockReturnValue({
      id: 1,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      createdAt: '',
      updatedAt: '',
      onboardingCompleted: true,
    });

    render(<HomePage />);

    await waitFor(() =>
      expect(mockRouter().push).toHaveBeenCalledWith('/activities')
    );
  });

  it('treats a stale cached user without onboardingCompleted as completed', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(true);
    mockAuthService.getCurrentUser.mockReturnValue({
      id: 1,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      createdAt: '',
      updatedAt: '',
    });

    render(<HomePage />);

    await waitFor(() =>
      expect(mockRouter().push).toHaveBeenCalledWith('/activities')
    );
  });

  it('sends first-run users to the onboarding guide', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(true);
    mockAuthService.getCurrentUser.mockReturnValue({
      id: 1,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      createdAt: '',
      updatedAt: '',
      onboardingCompleted: false,
    });

    render(<HomePage />);

    await waitFor(() =>
      expect(mockRouter().push).toHaveBeenCalledWith('/onboarding')
    );
  });
});
