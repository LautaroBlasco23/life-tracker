import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdatePasswordModal } from './update-password-modal';
import { authService } from '@shared/services/auth-service';
import { showToast } from '@/lib/toast';

// Change-password modal: the auth-service seam is mocked and toast output
// is captured so validation branches can be asserted without DOM toasts.

vi.mock('@shared/services/auth-service', () => ({
  authService: {
    updatePassword: vi.fn(),
  },
}));

vi.mock('@/lib/toast', () => ({
  showToast: vi.fn(),
}));

// Shared context consumed from source resolves its own react copy; every
// component test mocks it (see active-session-card.test.tsx for the pattern).
vi.mock('@shared/contexts/language-context', () => {
  const dictionaries: Record<string, Record<string, string>> = {
    updatePassword: {
      title: 'Update Password',
      currentPassword: 'Current password',
      newPassword: 'New password',
      confirmNewPassword: 'Confirm new password',
      updatePassword: 'Update Password',
      updating: 'Updating...',
      passwordsDoNotMatch: 'Passwords do not match',
      passwordsDoNotMatchDescription:
        'Please make sure your new passwords match.',
      passwordTooShort: 'Password too short',
      passwordTooShortDescription:
        'Password must be at least 8 characters long.',
      passwordUpdated: 'Password updated',
      passwordUpdatedDescription:
        'Your password has been successfully updated.',
      updateFailed: 'Update failed',
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
const mockShowToast = vi.mocked(showToast);

function renderModal(open = true) {
  const onOpenChange = vi.fn();
  const view = render(
    <UpdatePasswordModal open={open} onOpenChange={onOpenChange} />
  );
  return { onOpenChange, unmount: view.unmount };
}

const inputFor = (label: string) => screen.getByLabelText(label);

const toggleButtonFor = (label: string) => {
  // Each password field's eye button lives in the same relative wrapper.
  const wrapper = inputFor(label).closest('div');
  return wrapper?.querySelector('button');
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UpdatePasswordModal', () => {
  it('renders the dialog with its three password fields', () => {
    renderModal();

    expect(
      screen.getByRole('dialog', { name: 'Update Password' })
    ).toBeVisible();
    expect(inputFor('Current password')).toBeVisible();
    expect(inputFor('New password')).toBeVisible();
    expect(inputFor('Confirm new password')).toBeVisible();
  });

  it('renders nothing when closed', () => {
    renderModal(false);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('rejects mismatched new passwords', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(inputFor('Current password'), 'old-secret');
    await user.type(inputFor('New password'), 'new-secret-1');
    await user.type(inputFor('Confirm new password'), 'different-1');
    await user.click(screen.getByRole('button', { name: 'Update Password' }));

    expect(mockShowToast).toHaveBeenCalledWith({
      title: 'Passwords do not match',
      description: 'Please make sure your new passwords match.',
      variant: 'destructive',
    });
    expect(mockAuthService.updatePassword).not.toHaveBeenCalled();
  });

  it('rejects new passwords shorter than 6 characters', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(inputFor('Current password'), 'old-secret');
    await user.type(inputFor('New password'), 'abc');
    await user.type(inputFor('Confirm new password'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Update Password' }));

    expect(mockShowToast).toHaveBeenCalledWith({
      title: 'Password too short',
      description: 'Password must be at least 8 characters long.',
      variant: 'destructive',
    });
    expect(mockAuthService.updatePassword).not.toHaveBeenCalled();
  });

  it('updates the password and closes on success', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();
    mockAuthService.updatePassword.mockResolvedValue(undefined);

    await user.type(inputFor('Current password'), 'old-secret');
    await user.type(inputFor('New password'), 'new-secret-1');
    await user.type(inputFor('Confirm new password'), 'new-secret-1');
    await user.click(screen.getByRole('button', { name: 'Update Password' }));

    await waitFor(() =>
      expect(mockAuthService.updatePassword).toHaveBeenCalledWith({
        currentPassword: 'old-secret',
        newPassword: 'new-secret-1',
      })
    );
    expect(mockShowToast).toHaveBeenCalledWith({
      title: 'Password updated',
      description: 'Your password has been successfully updated.',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows a destructive toast when the update fails', async () => {
    const user = userEvent.setup();
    renderModal();
    mockAuthService.updatePassword.mockRejectedValue(
      new Error('Current password is incorrect')
    );

    await user.type(inputFor('Current password'), 'wrong');
    await user.type(inputFor('New password'), 'new-secret-1');
    await user.type(inputFor('Confirm new password'), 'new-secret-1');
    await user.click(screen.getByRole('button', { name: 'Update Password' }));

    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith({
        title: 'Update failed',
        description: 'Current password is incorrect',
        variant: 'destructive',
      })
    );
  });

  it('resets the form when closed and reopened', async () => {
    const user = userEvent.setup();
    mockAuthService.updatePassword.mockResolvedValue(undefined);
    const first = renderModal();

    await user.type(inputFor('Current password'), 'old-secret');
    await user.type(inputFor('New password'), 'new-secret-1');
    await user.type(inputFor('Confirm new password'), 'new-secret-1');
    await user.click(screen.getByRole('button', { name: 'Update Password' }));
    await waitFor(() => expect(first.onOpenChange).toHaveBeenCalledWith(false));

    // Parent closes and later reopens the modal: state must start clean.
    first.unmount();
    renderModal();

    expect(inputFor('Current password')).toHaveValue('');
    expect(inputFor('New password')).toHaveValue('');
    expect(inputFor('Confirm new password')).toHaveValue('');
  });

  it('toggles password visibility for each field', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(inputFor('Current password'), 'secret');

    const currentToggle = toggleButtonFor('Current password')!;
    expect(inputFor('Current password')).toHaveAttribute('type', 'password');
    await user.click(currentToggle);
    expect(inputFor('Current password')).toHaveAttribute('type', 'text');
    await user.click(currentToggle);
    expect(inputFor('Current password')).toHaveAttribute('type', 'password');

    await user.click(toggleButtonFor('New password')!);
    expect(inputFor('New password')).toHaveAttribute('type', 'text');
    await user.click(toggleButtonFor('Confirm new password')!);
    expect(inputFor('Confirm new password')).toHaveAttribute('type', 'text');
  });

  it('fires onOpenChange(false) from the cancel button', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows an updating state while the request is pending', async () => {
    const user = userEvent.setup();
    renderModal();
    let resolveUpdate!: () => void;
    mockAuthService.updatePassword.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        })
    );

    await user.type(inputFor('Current password'), 'old-secret');
    await user.type(inputFor('New password'), 'new-secret-1');
    await user.type(inputFor('Confirm new password'), 'new-secret-1');
    await user.click(screen.getByRole('button', { name: 'Update Password' }));

    expect(screen.getByRole('button', { name: 'Updating...' })).toBeDisabled();

    resolveUpdate();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Update Password' })
      ).not.toBeDisabled()
    );
  });
});
