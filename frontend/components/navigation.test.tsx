import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePathname } from 'next/navigation';
import { ThemeProvider } from '@/contexts/theme-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Navigation } from './navigation';
import { APP_VERSION } from '@/lib/version';

// App shell navigation: usePathname drives the active states; ThemeToggle is
// real, so ThemeProvider wraps the component (matchMedia stubbed in setup).

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

// Shared context consumed from source resolves its own react copy; every
// component test mocks it (see active-session-card.test.tsx for the pattern).
vi.mock('@shared/contexts/language-context', () => ({
  useTranslations: () => {
    const nav: Record<string, string> = {
      activities: 'Activities',
      timeTracker: 'Time tracker',
      notes: 'Notes',
      finance: 'Finance',
      social: 'Social',
      profile: 'Profile',
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
    };
    return (key: string) => nav[key] ?? key;
  },
  useLanguage: () => ({ locale: 'en' as const, setLocale: () => undefined }),
}));

const mockUsePathname = vi.mocked(usePathname);

beforeEach(() => {
  vi.clearAllMocks();
  mockUsePathname.mockReturnValue('/activities');
});

function renderNavigation() {
  const view = render(
    <ThemeProvider>
      <Navigation />
    </ThemeProvider>
  );
  const sidebar = view.container.querySelector('aside')!;
  const mobileMenu = view.container.querySelector('nav')!;
  return { ...view, sidebar, mobileMenu };
}

describe('Navigation', () => {
  it('renders the desktop sidebar with all six destinations', () => {
    const { sidebar } = renderNavigation();

    for (const label of [
      'Activities',
      'Time tracker',
      'Notes',
      'Finance',
      'Social',
      'Profile',
    ]) {
      expect(
        within(sidebar).getByRole('link', { name: label })
      ).toBeInTheDocument();
    }
    // Two brand links: mobile header + sidebar header.
    expect(screen.getAllByRole('link', { name: 'LifeTracker' })).toHaveLength(
      2
    );
  });

  it('shows the app version in the sidebar footer', () => {
    renderNavigation();

    expect(screen.getByText(`LifeTracker v${APP_VERSION}`)).toBeInTheDocument();
  });

  it('marks the current route as active in the sidebar', () => {
    mockUsePathname.mockReturnValue('/finance');
    const { sidebar } = renderNavigation();

    const financeLink = within(sidebar).getByRole('link', {
      name: 'Finance',
    });
    // Active entries get the accent background without the hover: prefix.
    expect(financeLink.className).toContain(
      'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
    );

    const activitiesLink = within(sidebar).getByRole('link', {
      name: 'Activities',
    });
    expect(activitiesLink.className).not.toContain('font-medium');
  });

  it('normalizes trailing slashes when matching the active route', () => {
    // With trailingSlash: true, usePathname() returns '/activities/'.
    mockUsePathname.mockReturnValue('/activities/');
    const { sidebar } = renderNavigation();

    const activitiesLink = within(sidebar).getByRole('link', {
      name: 'Activities',
    });
    expect(activitiesLink.className).toContain(
      'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
    );
  });

  it('marks the profile avatar in the header on /profile', () => {
    mockUsePathname.mockReturnValue('/profile');
    const { container } = renderNavigation();

    const headerProfileLink = container.querySelector(
      'header a[href="/profile"]'
    );
    expect(headerProfileLink?.className).toContain('text-primary');
  });

  it('opens the mobile menu from the hamburger and closes it again', async () => {
    const user = userEvent.setup();
    const { container } = renderNavigation();

    const hamburger = screen.getByRole('button', { name: 'Open menu' });
    expect(hamburger).toHaveAttribute('aria-expanded', 'false');

    await user.click(hamburger);

    expect(hamburger).toHaveAttribute('aria-expanded', 'true');
    // Backdrop overlay appears while the menu is open.
    const backdrop = container.querySelector('div[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    expect(container.querySelector('div[aria-hidden="true"]')).toBeNull();
  });

  it('closes the menu through the backdrop click', async () => {
    const user = userEvent.setup();
    const { container } = renderNavigation();

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const backdrop = container.querySelector(
      'div[aria-hidden="true"]'
    ) as HTMLElement;
    await user.click(backdrop);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
        'aria-expanded',
        'false'
      )
    );
  });

  it('excludes the profile entry from the mobile slide-down menu', () => {
    const { mobileMenu } = renderNavigation();

    // The mobile menu lists five items; profile has its own header avatar.
    expect(
      within(mobileMenu).queryByRole('link', { name: 'Profile' })
    ).not.toBeInTheDocument();
    expect(within(mobileMenu).getAllByRole('link')).toHaveLength(5);
  });
});
