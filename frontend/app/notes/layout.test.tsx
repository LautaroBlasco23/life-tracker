import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authService } from '@shared/services/auth-service';

vi.mock('@shared/services/auth-service', () => ({
  authService: {
    isAuthenticated: vi.fn(),
    onAuthChange: vi.fn(() => () => undefined),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/components/navigation', () => ({
  Navigation: () => <nav data-testid="navigation" />,
}));

import NotesLayout from './layout';

const mockRouter = vi.mocked(useRouter);
const mockAuthService = vi.mocked(authService);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthService.isAuthenticated.mockReturnValue(true);
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

describe('NotesLayout', () => {
  it('renders the navigation and its children when authenticated', async () => {
    render(
      <NotesLayout>
        <main>notes content</main>
      </NotesLayout>
    );

    expect(screen.getByTestId('navigation')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText('notes content')).toBeVisible()
    );
    expect(mockAuthService.isAuthenticated).toHaveBeenCalled();
  });

  it('redirects to /login when the session is gone', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);

    render(
      <NotesLayout>
        <main>notes content</main>
      </NotesLayout>
    );

    await waitFor(() =>
      expect(mockRouter().push).toHaveBeenCalledWith('/login')
    );
    expect(screen.queryByText('notes content')).not.toBeInTheDocument();
  });
});
