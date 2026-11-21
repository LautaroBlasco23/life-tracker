import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RegisterPage from './page';
import { authService } from '@shared/services/auth-service';
import { userService } from '@shared/services/user-service';
import { showToast } from '@/lib/toast';

// Register page: auth/user services mocked; availability checks are
// debounced (500ms) so those tests run under fake timers.

vi.mock('@shared/services/auth-service', () => ({
  authService: {
    register: vi.fn(),
    checkUsernameAvailability: vi.fn(),
  },
}));

vi.mock('@shared/services/user-service', () => ({
  userService: {
    checkEmailAvailability: vi.fn(),
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
      createAccount: 'Create account',
      createAccountDescription: 'Enter your information to create your account',
      firstName: 'First name',
      lastName: 'Last name',
      username: 'Username',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm password',
      usernameTaken: 'Username is already taken',
      emailTaken: 'Email is already registered',
      usernameAvailable: 'Username is available',
      emailAvailable: 'Email is available',
      passwordMismatch: 'Password mismatch',
      passwordMismatchDescription: 'Passwords do not match. Please try again.',
      passwordTooShort: 'Password too short',
      passwordTooShortDescription:
        'Password must be at least 8 characters long.',
      passwordMinLength: 'Password must be at least {min} characters long',
      accountCreated: 'Account created',
      accountCreatedDescription: 'Your account has been created successfully.',
      registrationFailed: 'Registration failed',
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
const mockUserService = vi.mocked(userService);
const mockShowToast = vi.mocked(showToast);

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

afterEach(() => {
  vi.useRealTimers();
});

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('First name'), 'Ada');
  await user.type(screen.getByLabelText('Last name'), 'Lovelace');
  await user.type(screen.getByLabelText('Username'), 'ada');
  await user.type(screen.getByLabelText('Email'), 'ada@example.com');
  await user.type(screen.getByLabelText('Password'), 'longenough1');
  await user.type(screen.getByLabelText('Confirm password'), 'longenough1');
}

describe('RegisterPage', () => {
  it('renders the registration form and a link to login', () => {
    render(<RegisterPage />);

    // CardTitle renders as a div, not a heading element.
    expect(
      screen.getByText('Enter your information to create your account')
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login'
    );
  });

  it('sanitizes the username to lowercase allowed characters', async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText('Username'), 'Ana!X Y_9');

    expect(screen.getByLabelText('Username')).toHaveValue('anaxy_9');
  });

  it('checks username availability after the debounce', async () => {
    vi.useFakeTimers();
    mockAuthService.checkUsernameAvailability.mockResolvedValue(true);

    render(<RegisterPage />);
    // userEvent stalls under fake timers; fireEvent keeps this synchronous.
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'ada' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(mockAuthService.checkUsernameAvailability).toHaveBeenCalledWith(
      'ada'
    );
    expect(screen.getByText('Username is available')).toBeVisible();
  });

  it('flags an unavailable username', async () => {
    vi.useFakeTimers();
    mockAuthService.checkUsernameAvailability.mockResolvedValue(false);

    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'ada' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(screen.getByText('Username is already taken')).toBeVisible();
  });

  it('does not check usernames shorter than 3 characters', async () => {
    vi.useFakeTimers();

    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'ab' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(mockAuthService.checkUsernameAvailability).not.toHaveBeenCalled();
  });

  it('checks email availability after the debounce', async () => {
    vi.useFakeTimers();
    mockUserService.checkEmailAvailability.mockResolvedValue(true);

    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'ada@example.com' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(mockUserService.checkEmailAvailability).toHaveBeenCalledWith(
      'ada@example.com'
    );
    expect(screen.getByText('Email is available')).toBeVisible();
  });

  it('flags a registered email', async () => {
    vi.useFakeTimers();
    mockUserService.checkEmailAvailability.mockResolvedValue(false);

    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'ada@example.com' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(screen.getByText('Email is already registered')).toBeVisible();
  });

  it('rejects mismatched passwords before calling the service', async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);
    await fillValidForm(user);
    await user.clear(screen.getByLabelText('Confirm password'));
    await user.type(screen.getByLabelText('Confirm password'), 'different1');

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(mockShowToast).toHaveBeenCalledWith({
      title: 'Password mismatch',
      description: 'Passwords do not match. Please try again.',
      variant: 'destructive',
    });
    expect(mockAuthService.register).not.toHaveBeenCalled();
  });

  it('rejects passwords shorter than 8 characters', async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);
    await fillValidForm(user);
    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.clear(screen.getByLabelText('Confirm password'));
    await user.type(screen.getByLabelText('Confirm password'), 'short');

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(mockShowToast).toHaveBeenCalledWith({
      title: 'Password too short',
      description: 'Password must be at least 8 characters long.',
      variant: 'destructive',
    });
    expect(mockAuthService.register).not.toHaveBeenCalled();
  });

  it('shows the min-length hint once the password was touched', async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    const password = screen.getByLabelText('Password');
    await user.type(password, 'abc');
    await user.tab(); // blur marks the field as touched

    expect(
      screen.getByText('Password must be at least 8 characters long')
    ).toBeVisible();
  });

  it('registers and routes to the onboarding guide', async () => {
    const user = userEvent.setup();
    mockAuthService.checkUsernameAvailability.mockResolvedValue(true);
    mockUserService.checkEmailAvailability.mockResolvedValue(true);
    mockAuthService.register.mockResolvedValue({ token: 't' } as never);

    render(<RegisterPage />);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(mockAuthService.register).toHaveBeenCalledWith({
        firstName: 'Ada',
        lastName: 'Lovelace',
        username: 'ada',
        email: 'ada@example.com',
        password: 'longenough1',
      })
    );
    await waitFor(() =>
      expect(mockRouter().push).toHaveBeenCalledWith('/onboarding')
    );
    expect(mockShowToast).toHaveBeenCalledWith({
      title: 'Account created',
      description: 'Your account has been created successfully.',
    });
  });

  it('shows a destructive toast when registration fails', async () => {
    const user = userEvent.setup();
    mockAuthService.register.mockRejectedValue(new Error('Username exists'));

    render(<RegisterPage />);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith({
        title: 'Registration failed',
        description: 'Username exists',
        variant: 'destructive',
      })
    );
    expect(mockRouter().push).not.toHaveBeenCalled();
  });
});
