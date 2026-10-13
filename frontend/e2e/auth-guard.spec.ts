import { test, expect } from '@playwright/test';
import { registerUser, seedAuth } from './helpers';

/**
 * Auth guard: the single client-side gate in front of every page
 * (frontend/components/auth-guard.tsx -> authService.isAuthenticated()).
 */
test.describe('auth guard', () => {
  test('unauthenticated visit to a protected page lands on /login', async ({
    page,
  }) => {
    await page.goto('/');

    // app/page.tsx redirects by auth state; guard pushes /login when empty.
    await expect(page).toHaveURL(/\/login/);
    // The login form is the stable marker that the guard rendered it.
    // (getByLabel(/password/i) would also match the "Show password" button.)
    await expect(page.getByLabel(/username or email/i)).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
  });

  test('seeded auth renders the authenticated app from /', async ({
    page,
    request,
  }) => {
    const user = await registerUser(request);
    await seedAuth(page, user);

    await page.goto('/');
    await page.waitForURL(/\/activities/);

    // Authenticated app shell: the sidebar (role=complementary) only renders
    // for logged-in users — the brand text alone matches the header link,
    // sidebar link and version footer (strict-mode collision).
    await expect(page.getByRole('complementary')).toBeVisible();
  });
});
