import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateEmailModal } from './update-email-modal';
import { authService } from '@shared/services/auth-service';
import { userService } from '@shared/services/user-service';
import { showToast } from '@/lib/toast';
import type { User } from '@shared/types/user';

// Change-email modal: auth/user services mocked; the availability check is
// debounced (500ms) so those tests run under fake timers.

vi.mock('@shared/services/auth-service', () => ({
  authService: {
    updateEmail: vi.fn(),
    getCurrentUser: vi.fn(),
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
    updateEmail: {
      title: 'Update Email',
      description:
        'Enter your password and the new email address you want to use.',
      currentEmail: 'Current email',
      newEmail: 'New email',
      password: 'Password',
      updateEmail: 'Update Email',
      updating: 'Updating...',
      sameEmail: 'Same email',
      sameEmailDescription: 'The new email is the same as your current email.',
      emailUpdated: 'Email updated',
      emailUpdatedDescription: 'Your email has been successfully updated.',
      updateFailed: 'Update failed',
      emailAvailable: 'Email is available',
      emailTaken: 'Email is already registered',
    },
    common: {
      cancel: 'Cancel',
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

const mockAuthService = vi.mocked(authService);
const mockUserService = vi.mocked(userService);
const mockShowToast = vi.mocked(showToast);

const CURRENT_EMAIL = 'old@example.com';

const userFactory = (): User => ({
  id: 1,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'new@example.com',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z',
});

function renderModal(open = true) {
  const props = {
    open,
    onOpenChange: vi.fn(),
    currentEmail: CURRENT_EMAIL,
    onEmailUpdated: vi.fn(),
  };
  render(<UpdateEmailModal {...props} />);
  return props;
}

const inputFor = (label: string) => screen.getByLabelText(label);

const toggleButtonFor = (label: string) =>
  inputFor(label).closest('div')?.querySelector('button');

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('UpdateEmailModal', () => {
  it('renders the dialog with the current email disabled', () => {
    renderModal();

    expect(screen.getByRole('dialog', { name: 'Update Email' })).toBeVisible();
    expect(inputFor('Current email')).toBeDisabled();
    expect(inputFor('Current email')).toHaveValue(CURRENT_EMAIL);
  });

  it('rejects submitting the same email', async () => {
    const user = userEvent.setup();
    const props = renderModal();

    await user.type(inputFor('New email'), CURRENT_EMAIL);
    await user.type(inputFor('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Update Email' }));

    expect(mockShowToast).toHaveBeenCalledWith({
      title: 'Same email',
      description: 'The new email is the same as your current email.',
      variant: 'destructive',
    });
    expect(mockAuthService.updateEmail).not.toHaveBeenCalled();
    expect(props.onEmailUpdated).not.toHaveBeenCalled();
  });

  it('checks availability after the debounce when the email is valid', async () => {
    vi.useFakeTimers();
    mockUserService.checkEmailAvailability.mockResolvedValue(true);
    renderModal();

    // userEvent stalls under fake timers; fireEvent keeps this synchronous.
    fireEvent.change(inputFor('New email'), {
      target: { value: 'new@example.com' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(mockUserService.checkEmailAvailability).toHaveBeenCalledWith(
      'new@example.com'
    );
    expect(screen.getByText('Email is available')).toBeVisible();
  });

  it('flags an already registered email', async () => {
    vi.useFakeTimers();
    mockUserService.checkEmailAvailability.mockResolvedValue(false);
    renderModal();

    fireEvent.change(inputFor('New email'), {
      target: { value: 'taken@example.com' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(screen.getByText('Email is already registered')).toBeVisible();
  });

  it('does not check an invalid email shape', async () => {
    vi.useFakeTimers();
    renderModal();

    fireEvent.change(inputFor('New email'), {
      target: { value: 'not-an-email' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(mockUserService.checkEmailAvailability).not.toHaveBeenCalled();
  });

  it('does not check the current email', async () => {
    vi.useFakeTimers();
    renderModal();

    fireEvent.change(inputFor('New email'), {
      target: { value: CURRENT_EMAIL },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(mockUserService.checkEmailAvailability).not.toHaveBeenCalled();
  });

  it('updates the email and notifies the parent on success', async () => {
    const user = userEvent.setup();
    const props = renderModal();
    const updatedUser = userFactory();
    mockAuthService.updateEmail.mockResolvedValue(undefined);
    mockAuthService.getCurrentUser.mockReturnValue(updatedUser);

    await user.type(inputFor('New email'), 'new@example.com');
    await user.type(inputFor('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Update Email' }));

    await waitFor(() =>
      expect(mockAuthService.updateEmail).toHaveBeenCalledWith({
        password: 'secret',
        newEmail: 'new@example.com',
      })
    );
    expect(props.onEmailUpdated).toHaveBeenCalledWith(updatedUser);
    expect(mockShowToast).toHaveBeenCalledWith({
      title: 'Email updated',
      description: 'Your email has been successfully updated.',
    });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows a destructive toast when the update fails', async () => {
    const user = userEvent.setup();
    const props = renderModal();
    mockAuthService.updateEmail.mockRejectedValue(new Error('Wrong password'));

    await user.type(inputFor('New email'), 'new@example.com');
    await user.type(inputFor('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Update Email' }));

    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith({
        title: 'Update failed',
        description: 'Wrong password',
        variant: 'destructive',
      })
    );
    expect(props.onEmailUpdated).not.toHaveBeenCalled();
  });

  it('fires onOpenChange(false) from the cancel button', async () => {
    const user = userEvent.setup();
    const props = renderModal();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('toggles the password visibility', async () => {
    const user = userEvent.setup();
    renderModal();

    expect(inputFor('Password')).toHaveAttribute('type', 'password');
    await user.click(toggleButtonFor('Password')!);
    expect(inputFor('Password')).toHaveAttribute('type', 'text');
  });

  it('shows an updating state while the request is pending', async () => {
    const user = userEvent.setup();
    renderModal();
    let resolveUpdate!: () => void;
    mockAuthService.updateEmail.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        })
    );

    await user.type(inputFor('New email'), 'new@example.com');
    await user.type(inputFor('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Update Email' }));

    expect(screen.getByRole('button', { name: 'Updating...' })).toBeDisabled();

    resolveUpdate();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Update Email' })
      ).not.toBeDisabled()
    );
  });
});
