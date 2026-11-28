import { test, expect } from '@playwright/test';
import { registerUser, seedAuth } from './helpers';

/**
 * Runtime preferences persist across reloads (both are localStorage-backed):
 * - Theme: the sidebar ThemeToggle ("Toggle theme" sr-only label) flips
 *   light/dark by toggling the `dark` class on <html>; the preference is
 *   stored under the `theme` key (frontend/contexts/theme-context.tsx).
 * - Language: the Profile page's language select switches the whole app to
 *   Spanish; the locale is stored under the `locale` key
 *   (packages/shared/src/contexts/language-context.tsx).
 */
test('theme toggle persists across reload', async ({ page, request }) => {
  const user = await registerUser(request);
  await seedAuth(page, user);

  await page.goto('/activities/');
  await expect(page.getByRole('complementary')).toBeVisible();

  // The initial theme resolves from the OS scheme ('system'), so assert a
  // change rather than a specific value. Scope to the sidebar: the mobile
  // header renders a second, hidden toggle.
  const initial = await page.locator('html').getAttribute('class');
  const initialIsDark = /(^|\s)dark(\s|$)/.test(initial ?? '');
  await page
    .getByRole('complementary')
    .getByRole('button', { name: 'Toggle theme' })
    .click();
  const toggled = await page.locator('html').getAttribute('class');
  const toggledIsDark = /(^|\s)dark(\s|$)/.test(toggled ?? '');
  expect(toggledIsDark).not.toBe(initialIsDark);

  // The preference survives a full reload.
  await page.reload();
  await expect
    .poll(async () =>
      /(^|\s)dark(\s|$)/.test(
        (await page.locator('html').getAttribute('class')) ?? ''
      )
    )
    .toBe(toggledIsDark);
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(
    toggledIsDark ? 'dark' : 'light'
  );

  // Toggling back is persisted too.
  await page
    .getByRole('complementary')
    .getByRole('button', { name: 'Toggle theme' })
    .click();
  await expect
    .poll(async () =>
      /(^|\s)dark(\s|$)/.test(
        (await page.locator('html').getAttribute('class')) ?? ''
      )
    )
    .toBe(initialIsDark);
  await page.reload();
  await expect
    .poll(async () =>
      /(^|\s)dark(\s|$)/.test(
        (await page.locator('html').getAttribute('class')) ?? ''
      )
    )
    .toBe(initialIsDark);
});

test('language switch to Spanish persists across reload', async ({
  page,
  request,
}) => {
  const user = await registerUser(request);
  await seedAuth(page, user);

  await page.goto('/profile/');
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();

  // The language select is the only combobox whose value shows 'English'
  // (the privacy select in the Personal Information card shows 'Public' —
  // and its hint text mentions "Account Information", which breaks
  // hasText-based card scoping).
  await page.getByRole('combobox').filter({ hasText: 'English' }).click();
  await page.getByRole('option', { name: 'Spanish' }).click();

  // The whole app switches immediately.
  await expect(page.getByRole('heading', { name: 'Perfil' })).toBeVisible();
  await expect(page.getByText('Información personal')).toBeVisible();
  await expect(page.getByText('Exportar datos')).toBeVisible();

  // And it survives a reload (localStorage `locale`).
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Perfil' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('locale'))).toBe('es');
});
