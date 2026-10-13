import { test, expect } from '@playwright/test';
import { registerUser, gotoWithRetry } from './helpers';

/**
 * Real login through the UI (frontend/app/login/page.tsx), against the
 * backend through the nginx /api proxy — no token seeding, browser-only path.
 *
 * Success marker: redirect to /activities (login page router.push) and the
 * authenticated shell (Navigation sidebar) becomes visible. Language is 'en'
 * by default (language-context initialises to 'en'), so the stable i18n
 * strings are the English ones from packages/shared/src/messages/en.json.
 */
test('UI login with helper-created user reaches the authenticated shell', async ({
  page,
  request,
}) => {
  const user = await registerUser(request);

  await gotoWithRetry(page, '/login');
  await page.getByLabel(/username or email/i).fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Success = guard passes: redirected to the activities view + app shell
  // (the logged-in sidebar; brand text alone is not unique on the page).
  await page.waitForURL(/\/activities/);
  await expect(page.getByRole('complementary')).toBeVisible();
});
