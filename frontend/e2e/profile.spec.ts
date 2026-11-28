import { test, expect } from '@playwright/test';
import { E2E_PASSWORD, registerUser, seedAuth } from './helpers';

/**
 * Profile flows (app/profile/page.tsx + its modals):
 * - Change Password (#current-password / #new-password / #confirm-password)
 *   calls authService.updatePassword; verified end-to-end by signing out and
 *   logging back in through the /login form with the new password.
 * - Change Email (#new-email / #email-password) swaps the email after a
 *   password confirmation; the disabled email field on the page reflects it.
 * - Data Backup: "Export data" triggers a browser download of an XLSX blob
 *   (anchor click on an object URL); restoring feeds the same file back
 *   through the hidden #import-data input and confirms the destructive
 *   AlertDialog. On an empty account the restore is a no-op, so the spec is
 *   idempotent.
 */
const UNIQUE =
  Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

test('change the password and log back in with it', async ({
  page,
  request,
}) => {
  const user = await registerUser(request);
  await seedAuth(page, user);
  const newPassword = 'e2e-rotated-pass';

  await page.goto('/profile/');
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();

  await page.getByRole('button', { name: 'Change Password' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#current-password').fill(E2E_PASSWORD);
  await dialog.locator('#new-password').fill(newPassword);
  await dialog.locator('#confirm-password').fill(newPassword);
  await dialog.getByRole('button', { name: 'Update Password' }).click();
  await expect(page.getByText('Password updated')).toBeVisible();

  // Prove the rotation: sign out, then log in with the new password through
  // the real login form (first-run users land on /onboarding).
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(/\/login/);
  await page.getByLabel(/username or email/i).fill(user.username);
  await page.getByRole('textbox', { name: 'Password' }).fill(newPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/onboarding/);
  await expect(page.getByText(/Welcome to Life Tracker/)).toBeVisible();
});

test('change the email after password confirmation', async ({
  page,
  request,
}) => {
  const user = await registerUser(request);
  await seedAuth(page, user);
  const newEmail = `e2e.rotated.${UNIQUE}@e2e.local`;

  await page.goto('/profile/');
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();

  await page.getByRole('button', { name: 'Change Email' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#new-email').fill(newEmail);
  await dialog.locator('#email-password').fill(E2E_PASSWORD);
  await dialog.getByRole('button', { name: 'Update Email' }).click();
  await expect(page.getByText('Email updated')).toBeVisible();

  // The profile's disabled email input reflects the change immediately.
  await expect(page.locator('#email')).toHaveValue(newEmail);
});

test('export an XLSX backup and restore it', async ({ page, request }) => {
  const user = await registerUser(request);
  await seedAuth(page, user);

  await page.goto('/profile/');
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();

  // Export: blob download via anchor click — assert the download event.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export data' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const backupPath = await download.path();

  // Restore the just-downloaded backup through the hidden file input.
  await page.locator('#import-data').setInputFiles(backupPath);
  const confirmDialog = page.getByRole('alertdialog');
  await expect(confirmDialog.getByText('Restore from backup?')).toBeVisible();
  await confirmDialog
    .getByRole('button', { name: 'Delete and restore' })
    .click();

  await expect(page.getByText('Data restored')).toBeVisible();
});
