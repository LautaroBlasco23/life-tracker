import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OnboardingPage from './page';
import { authService } from '@shared/services/auth-service';

// The onboarding route wraps the wizard in AuthGuard: authenticated users
// see the wizard, unauthenticated ones are bounced to /login.

vi.mock('@shared/services/auth-service', () => ({
  authService: {
    isAuthenticated: vi.fn(),
    onAuthChange: vi.fn(() => () => undefined),
    getCurrentUser: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Shared context consumed from source resolves its own react copy; every
// component test mocks it (see active-session-card.test.tsx for the pattern).
vi.mock('@shared/contexts/language-context', () => {
  const dictionaries: Record<string, Record<string, string>> = {
    onboarding: {
      step: 'Step {current} of {total}',
      welcome_title: 'Welcome to Life Tracker, {name}!',
      welcome_title_generic: 'Welcome to Life Tracker!',
    },
  };
  return {
    useTranslations: (namespace: string) => {
      const dictionary = dictionaries[namespace] ?? {};
      return (key: string, vars?: Record<string, string | number>): string => {
        let str = dictionary[key] ?? key;
        if (vars) {
          for (const [name, value] of Object.entries(vars)) {
            str = str.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
          }
        }
        return str;
      };
    },
    useLanguage: () => ({ locale: 'en' as const, setLocale: () => undefined }),
  };
});

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

describe('OnboardingPage', () => {
  it('renders the wizard for authenticated users', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(true);
    mockAuthService.getCurrentUser.mockReturnValue({
      id: 1,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    render(<OnboardingPage />);

    await waitFor(() =>
      expect(
        screen.getByRole('heading', {
          name: 'Welcome to Life Tracker, Ada!',
        })
      ).toBeVisible()
    );
    expect(mockRouter().push).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated users to login without rendering the wizard', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);

    render(<OnboardingPage />);

    await waitFor(() =>
      expect(mockRouter().push).toHaveBeenCalledWith('/login')
    );
    expect(
      screen.queryByText(/Welcome to Life Tracker/)
    ).not.toBeInTheDocument();
  });
});
