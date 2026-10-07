import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '@/components/auth-guard';
import { authService } from '@shared/services/auth-service';

// Proves the service-mocking seam: @shared services are replaced with
// vi.mock so component tests never touch fetch or real storage.

vi.mock('@shared/services/auth-service', () => ({
  authService: {
    isAuthenticated: vi.fn(),
    onAuthChange: vi.fn(() => () => undefined),
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
  } as ReturnType<typeof useRouter>);
});

describe('AuthGuard', () => {
  it('renders children when authenticated', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(true);

    render(
      <AuthGuard>
        <div>protected content</div>
      </AuthGuard>
    );

    await waitFor(() =>
      expect(screen.getByText('protected content')).toBeVisible()
    );
    expect(mockRouter().push).not.toHaveBeenCalled();
  });

  it('redirects to /login when not authenticated', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);

    render(
      <AuthGuard>
        <div>protected content</div>
      </AuthGuard>
    );

    await waitFor(() =>
      expect(mockRouter().push).toHaveBeenCalledWith('/login')
    );
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('subscribes to auth changes and redirects on logout', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(true);
    let authCallback: (authenticated: boolean) => void = () => undefined;
    mockAuthService.onAuthChange.mockImplementation((cb) => {
      authCallback = cb;
      return () => undefined;
    });

    render(
      <AuthGuard>
        <div>protected content</div>
      </AuthGuard>
    );

    await waitFor(() =>
      expect(screen.getByText('protected content')).toBeVisible()
    );

    // Session invalidated from elsewhere (e.g. token refresh failure).
    authCallback(false);

    await waitFor(() =>
      expect(mockRouter().push).toHaveBeenCalledWith('/login')
    );
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });
});
