import { test, expect } from '@playwright/test';
import { registerUser } from './helpers';

/**
 * Real login through the UI (frontend/app/login/page.tsx), against the
 * backend through the nginx /api proxy — no token seeding, browser-only path.
 *
 * Success marker: redirect to /onboarding (login page router.push for
 * first-run users: a freshly registered user has onboardingCompleted=false)
 * and the wizard welcome text is visible. Language is 'en' by default
 * (language-context initialises to 'en'), so the stable i18n strings are
 * the English ones from packages/shared/src/messages/en.json.
 */
test('UI login with helper-created user reaches the first-run onboarding', async ({
  page,
  request,
}) => {
  const user = await registerUser(request);

  await page.goto('/login');
  await page.getByLabel(/username or email/i).fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // First run: the user is routed to the onboarding guide instead of the
  // default /activities landing.
  await page.waitForURL(/\/onboarding/);
  await expect(page.getByText(/set yourself up in a minute/i)).toBeVisible();
});
