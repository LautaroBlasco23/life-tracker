import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, usePathname } from 'next/navigation';
import { ThemeProvider } from '@/contexts/theme-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfilePage from './page';
import { authService } from '@shared/services/auth-service';
import { userService } from '@shared/services/user-service';
import { dataService } from '@shared/services/data-service';
import { showToast } from '@/lib/toast';
import type { User } from '@shared/types/user';

// Profile page: auth/user/data services mocked; Navigation and the update
// modals render for real against those mocked services. ThemeProvider wraps
// the page because Navigation embeds the real ThemeToggle.

vi.mock('@shared/services/auth-service', () => ({
  authService: {
    isAuthenticated: vi.fn(),
    onAuthChange: vi.fn(() => () => undefined),
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
    updatePassword: vi.fn(),
    updateEmail: vi.fn(),
    checkUsernameAvailability: vi.fn(),
  },
}));

vi.mock('@shared/services/user-service', () => ({
  userService: {
    getMyProfile: vi.fn(),
    updateUser: vi.fn(),
    uploadProfilePicture: vi.fn(),
    checkEmailAvailability: vi.fn(),
  },
}));

vi.mock('@shared/services/data-service', () => ({
  dataService: {
    exportData: vi.fn(),
    importData: vi.fn(),
  },
}));

vi.mock('@/lib/toast', () => ({
  showToast: vi.fn(),
}));

// Shared context consumed from source resolves its own react copy; every
// component test mocks it (see active-session-card.test.tsx for the pattern).
vi.mock('@shared/contexts/language-context', () => {
  const dictionaries: Record<string, Record<string, string>> = {
    profile: {
      title: 'Profile',
      description: 'Manage your account settings and preferences',
      loading: 'Loading...',
      firstName: 'First name',
      lastName: 'Last name',
      username: 'Username',
      email: 'Email',
      saveChanges: 'Save changes',
      signOut: 'Sign out',
      changePassword: 'Change Password',
      changeEmail: 'Change Email',
      starterGuideButton: 'Open guide',
      signedOut: 'Signed out',
      signedOutDescription: 'You have been successfully signed out.',
      profileUpdated: 'Profile updated',
      profileUpdatedDescription: 'Your profile has been successfully updated.',
      updateFailed: 'Update failed',
    },
    privacy: {
      profilePrivacy: 'Profile Privacy',
      public: 'Public',
      private: 'Private',
    },
    dataBackup: {
      title: 'Data Backup',
      exportButton: 'Export data',
      exporting: 'Exporting...',
      importButton: 'Import data',
      importing: 'Restoring...',
      importWarningTitle: 'Restore from backup?',
      importWarningDescription:
        'This will permanently delete all data currently in your account and replace it with the contents of "{filename}". This action cannot be undone.',
      importCancel: 'Cancel',
      importConfirm: 'Delete and restore',
      importSuccess: 'Data restored',
      importSuccessDescription: '{count} items restored.',
      importFailed: 'Restore failed',
      exportFailed: 'Export failed',
      exportSuccess: 'Backup downloaded',
      exportSuccessDescription: 'Your data backup has been downloaded.',
    },
    updateEmail: {
      title: 'Update Email',
      currentEmail: 'Current email',
      newEmail: 'New email',
      password: 'Password',
      updateEmail: 'Update Email',
      updating: 'Updating...',
    },
    updatePassword: {
      title: 'Update Password',
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

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));

const mockRouter = vi.mocked(useRouter);
const mockUsePathname = vi.mocked(usePathname);
const mockAuthService = vi.mocked(authService);
const mockUserService = vi.mocked(userService);
const mockDataService = vi.mocked(dataService);
const mockShowToast = vi.mocked(showToast);

function seedUser(): User {
  return {
    id: 1,
    username: 'ada',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    profilePrivacyStatus: 'public',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-02-20T00:00:00Z',
  };
}

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
  mockUsePathname.mockReturnValue('/profile');
  mockAuthService.isAuthenticated.mockReturnValue(true);
  mockUserService.getMyProfile.mockResolvedValue(seedUser());
});

function renderPage() {
  return render(
    <ThemeProvider>
      <ProfilePage />
    </ThemeProvider>
  );
}

async function renderLoadedPage() {
  const view = renderPage();
  await waitFor(() =>
    expect(screen.getByLabelText('First name')).toHaveValue('Ada')
  );
  return view;
}

describe('ProfilePage — loading and profile fetch', () => {
  it('shows the loading state while the profile is pending', async () => {
    const pending = deferred<User>();
    mockUserService.getMyProfile.mockReturnValue(pending.promise);

    renderPage();

    // AuthGuard renders its own 'Loading...' on the first paint, so there
    // are two while the profile is pending.
    expect(screen.getAllByText('Loading...').length).toBeGreaterThan(0);
    pending.resolve(seedUser());
    await waitFor(() =>
      expect(screen.getByLabelText('First name')).toHaveValue('Ada')
    );
  });

  it('renders the loaded profile with username in the header', async () => {
    await renderLoadedPage();

    expect(screen.getByRole('heading', { name: 'Profile' })).toBeVisible();
    expect(
      screen.getByText('Manage your account settings and preferences · @ada')
    ).toBeVisible();
    expect(screen.getByLabelText('Username')).toHaveValue('ada');
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
    expect(screen.getByLabelText('Username')).toBeDisabled();
    expect(screen.getByLabelText('Email')).toBeDisabled();
  });

  it('falls back to the cached auth user when the profile fetch fails', async () => {
    mockUserService.getMyProfile.mockRejectedValue(new Error('offline'));
    mockAuthService.getCurrentUser.mockReturnValue(seedUser());

    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText('First name')).toHaveValue('Ada')
    );
  });

  it('stays empty without a cached user after a failed fetch', async () => {
    mockUserService.getMyProfile.mockRejectedValue(new Error('offline'));
    mockAuthService.getCurrentUser.mockReturnValue(null);

    renderPage();

    await waitFor(() =>
      expect(mockUserService.getMyProfile).toHaveBeenCalled()
    );
    expect(screen.getByLabelText('First name')).toHaveValue('');
  });
});

describe('ProfilePage — personal information form', () => {
  it('saves changed names and shows a success toast', async () => {
    const user = userEvent.setup();
    const updated = { ...seedUser(), firstName: 'Grace' };
    mockUserService.updateUser.mockResolvedValue(updated);
    await renderLoadedPage();

    await user.clear(screen.getByLabelText('First name'));
    await user.type(screen.getByLabelText('First name'), 'Grace');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(mockUserService.updateUser).toHaveBeenCalledWith({
        firstName: 'Grace',
        lastName: 'Lovelace',
      })
    );
    // Privacy unchanged: the key is omitted from the update payload.
    expect(mockUserService.updateUser.mock.calls[0][0]).not.toHaveProperty(
      'profilePrivacyStatus'
    );
    expect(mockShowToast).toHaveBeenCalledWith({
      title: 'Profile updated',
      description: 'Your profile has been successfully updated.',
    });
  });

  it('includes profilePrivacyStatus in the update once it changes', async () => {
    const user = userEvent.setup();
    mockUserService.updateUser.mockResolvedValue(seedUser());
    await renderLoadedPage();

    // Two comboboxes exist (privacy, language); the privacy one comes first.
    const privacyTrigger = screen.getAllByRole('combobox')[0];
    await user.click(privacyTrigger);
    await user.click(await screen.findByRole('option', { name: 'Private' }));

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(mockUserService.updateUser).toHaveBeenCalledWith({
        firstName: 'Ada',
        lastName: 'Lovelace',
        profilePrivacyStatus: 'private',
      })
    );
  });

  it('shows a destructive toast when saving fails', async () => {
    const user = userEvent.setup();
    mockUserService.updateUser.mockRejectedValue(new Error('server error'));
    await renderLoadedPage();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith({
        title: 'Update failed',
        description: 'server error',
        variant: 'destructive',
      })
    );
  });
});

describe('ProfilePage — account actions', () => {
  it('signs out and routes to login', async () => {
    const user = userEvent.setup();
    mockAuthService.logout.mockResolvedValue(undefined);
    await renderLoadedPage();

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(mockAuthService.logout).toHaveBeenCalled());
    expect(mockRouter().push).toHaveBeenCalledWith('/login');
    expect(mockShowToast).toHaveBeenCalledWith({
      title: 'Signed out',
      description: 'You have been successfully signed out.',
    });
  });

  it('routes to the onboarding guide from the starter guide button', async () => {
    const user = userEvent.setup();
    await renderLoadedPage();

    await user.click(screen.getByRole('button', { name: 'Open guide' }));

    expect(mockRouter().push).toHaveBeenCalledWith('/onboarding');
  });

  it('opens the change password modal', async () => {
    const user = userEvent.setup();
    await renderLoadedPage();

    await user.click(screen.getByRole('button', { name: 'Change Password' }));

    expect(
      await screen.findByRole('dialog', { name: 'Update Password' })
    ).toBeVisible();
  });

  it('opens the change email modal pre-filled with the current email', async () => {
    const user = userEvent.setup();
    await renderLoadedPage();

    await user.click(screen.getByRole('button', { name: 'Change Email' }));

    const dialog = await screen.findByRole('dialog', {
      name: 'Update Email',
    });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByLabelText('Current email')).toHaveValue(
      'ada@example.com'
    );
  });
});

describe('ProfilePage — data backup', () => {
  it('exports the data through the data service', async () => {
    const user = userEvent.setup();
    mockDataService.exportData.mockResolvedValue('backup.xlsx');
    await renderLoadedPage();

    await user.click(screen.getByRole('button', { name: 'Export data' }));

    await waitFor(() =>
      expect(mockDataService.exportData).toHaveBeenCalledTimes(1)
    );
    expect(mockShowToast).toHaveBeenCalledWith({
      title: 'Backup downloaded',
      description: 'Your data backup has been downloaded.',
    });
    expect(
      screen.getByRole('button', { name: 'Export data' })
    ).not.toBeDisabled();
  });

  it('disables the export button while exporting and shows failures', async () => {
    const user = userEvent.setup();
    const pending = deferred<string>();
    mockDataService.exportData.mockReturnValue(pending.promise);
    await renderLoadedPage();

    await user.click(screen.getByRole('button', { name: 'Export data' }));

    expect(screen.getByRole('button', { name: 'Exporting...' })).toBeDisabled();

    pending.reject(new Error('export failed'));
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith({
        title: 'Export failed',
        description: 'export failed',
        variant: 'destructive',
      })
    );
  });

  it('asks for confirmation before restoring a backup file', async () => {
    const user = userEvent.setup();
    await renderLoadedPage();

    const file = new File(['bytes'], 'backup.xlsx');
    fireEvent.change(screen.getByLabelText(/Import data/), {
      target: { files: [file] },
    });

    expect(await screen.findByText('Restore from backup?')).toBeVisible();
    expect(
      screen.getByText(
        'This will permanently delete all data currently in your account and replace it with the contents of "backup.xlsx". This action cannot be undone.'
      )
    ).toBeVisible();
    expect(mockDataService.importData).not.toHaveBeenCalled();
  });

  it('cancelling the dialog keeps the current data untouched', async () => {
    const user = userEvent.setup();
    await renderLoadedPage();

    const file = new File(['bytes'], 'backup.xlsx');
    fireEvent.change(screen.getByLabelText(/Import data/), {
      target: { files: [file] },
    });
    await screen.findByText('Restore from backup?');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByText('Restore from backup?')).not.toBeInTheDocument()
    );
    expect(mockDataService.importData).not.toHaveBeenCalled();
  });

  it('restores the confirmed backup and reports the item count', async () => {
    const user = userEvent.setup();
    mockDataService.importData.mockResolvedValue({
      activities: 3,
      timeRecords: 2,
      calendarEvents: 0,
      notes: 1,
      routines: 0,
      routineActivities: 0,
      activityRecords: 0,
      transactions: 4,
      payments: 0,
    });
    await renderLoadedPage();

    const file = new File(['bytes'], 'backup.xlsx');
    fireEvent.change(screen.getByLabelText(/Import data/), {
      target: { files: [file] },
    });
    await screen.findByText('Restore from backup?');
    await user.click(
      screen.getByRole('button', { name: 'Delete and restore' })
    );

    await waitFor(() =>
      expect(mockDataService.importData).toHaveBeenCalledWith(file)
    );
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith({
        title: 'Data restored',
        description: '10 items restored.',
      })
    );
  });

  it('shows a destructive toast when the restore fails', async () => {
    const user = userEvent.setup();
    mockDataService.importData.mockRejectedValue(new Error('bad file'));
    await renderLoadedPage();

    const file = new File(['bytes'], 'backup.xlsx');
    fireEvent.change(screen.getByLabelText(/Import data/), {
      target: { files: [file] },
    });
    await screen.findByText('Restore from backup?');
    await user.click(
      screen.getByRole('button', { name: 'Delete and restore' })
    );

    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith({
        title: 'Restore failed',
        description: 'bad file',
        variant: 'destructive',
      })
    );
  });
});
