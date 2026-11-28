import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './page';
import { authService } from '@shared/services/auth-service';
import { showToast } from '@/lib/toast';

// Login page: the auth-service seam is mocked, toasts are captured so the
// success/error branches can be asserted without react-hot-toast DOM.

vi.mock('@shared/services/auth-service', () => ({
  authService: {
    login: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

vi.mock('@/lib/toast', () => ({
  showToast: vi.fn(),
}));

// Shared context consumed from source resolves its own react copy; every
// component test mocks it (see active-session-card.test.tsx for the pattern).
vi.mock('@shared/contexts/language-context', () => {
  const dictionaries: Record<string, Record<string, string>> = {
    auth: {
      signIn: 'Sign in',
      signInDescription: 'Enter your credentials to access your account',
      signUp: 'Sign up',
      usernameOrEmail: 'Username or email',
      usernameOrEmailPlaceholder: 'ada',
      password: 'Password',
      passwordPlaceholder: '••••••••',
      signingIn: 'Signing in...',
      noAccount: "Don't have an account?",
      english: 'English',
      spanish: 'Spanish',
      welcomeBack: 'Welcome back',
      welcomeBackDescription: 'You have been successfully logged in.',
      loginFailed: 'Login failed',
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

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

const mockRouter = vi.mocked(useRouter);
const mockAuthService = vi.mocked(authService);
const mockShowToast = vi.mocked(showToast);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

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

async function fillCredentials(user: ReturnType<typeof userEvent.setup>) {
  // userEvent sessions must not run concurrently (shared pointer state).
  await user.type(screen.getByLabelText('Username or email'), 'ada');
  await user.type(screen.getByLabelText('Password'), 'secret123');
}

describe('LoginPage', () => {
  it('renders the sign in form and a link to register', () => {
    render(<LoginPage />);

    // CardTitle renders as a div, not a heading element.
    expect(
      screen.getByText('Enter your credentials to access your account')
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute(
      'href',
      '/register'
    );
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'type',
      'password'
    );
  });

  it('logs in and routes returning users to activities', async () => {
    const user = userEvent.setup();
    mockAuthService.login.mockResolvedValue({ token: 't' } as never);
    mockAuthService.getCurrentUser.mockReturnValue({
      id: 1,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      createdAt: '',
      updatedAt: '',
      onboardingCompleted: true,
    });

    render(<LoginPage />);
    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(mockAuthService.login).toHaveBeenCalledWith({
        identifier: 'ada',
        password: 'secret123',
      })
    );
    await waitFor(() =>
      expect(mockRouter().push).toHaveBeenCalledWith('/activities')
    );
    expect(mockShowToast).toHaveBeenCalledWith({
      title: 'Welcome back',
      description: 'You have been successfully logged in.',
    });
  });

  it('routes first-run users to the onboarding guide', async () => {
    const user = userEvent.setup();
    mockAuthService.login.mockResolvedValue({ token: 't' } as never);
    mockAuthService.getCurrentUser.mockReturnValue({
      id: 1,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      createdAt: '',
      updatedAt: '',
      onboardingCompleted: false,
    });

    render(<LoginPage />);
    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(mockRouter().push).toHaveBeenCalledWith('/onboarding')
    );
  });

  it('shows a destructive toast when login fails', async () => {
    const user = userEvent.setup();
    mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

    render(<LoginPage />);
    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith({
        title: 'Login failed',
        description: 'Invalid credentials',
        variant: 'destructive',
      })
    );
    expect(mockRouter().push).not.toHaveBeenCalled();
  });

  it('disables the submit button while signing in', async () => {
    const user = userEvent.setup();
    const pending = deferred<{ token: string }>();
    mockAuthService.login.mockReturnValue(pending.promise as Promise<never>);

    render(<LoginPage />);
    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    // The submit handler is async: the loading state lands a tick later.
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Signing in...' })
      ).toBeDisabled()
    );

    pending.resolve({ token: 't' } as never);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sign in' })).not.toBeDisabled()
    );
  });
});
