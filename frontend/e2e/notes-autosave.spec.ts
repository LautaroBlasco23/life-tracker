import { test, expect } from '@playwright/test';
import { registerUser, seedAuth } from './helpers';

/**
 * Autosave reliability:
 * - content within the server cap saves (indicator clears);
 * - content over the server cap fails exactly ONCE per edit — no retry
 *   loop (the old implementation self-rescheduled every ~300ms on any
 *   failure, hammering the API with 400s);
 * - the unsaved indicator stays visible and truthful; the draft keeps
 *   the data.
 */
test('oversized note fails once, no retry loop; normal note saves', async ({
  page,
  request,
}) => {
  const user = await registerUser(request);
  await seedAuth(page, user);

  await page.goto('/notes/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await page.getByRole('button', { name: 'New Note' }).click();
  const editor = page.locator('.cm-content');
  await expect(editor).toBeVisible();
  await editor.click();

  const putStatuses: number[] = [];
  page.on('response', (r) => {
    if (r.request().method() === 'PUT' && r.url().includes('/notes/')) {
      putStatuses.push(r.status());
    }
  });

  // Over the 1MB server cap: one debounced attempt, one 400, then silence.
  await page.keyboard.insertText('x'.repeat(1_000_001));
  await expect(page.getByText('Unsaved changes').first()).toBeVisible();
  await page.waitForTimeout(6000);
  expect(putStatuses).toEqual([400]);
  await expect(page.getByText('Unsaved changes').first()).toBeVisible();

  // Shrink under the cap: the next edit saves successfully.
  await page.keyboard.press('Control+A');
  await page.keyboard.type('reasonable size now', { delay: 10 });
  await expect(page.getByText('Unsaved changes').first()).toBeHidden({
    timeout: 15000,
  });
  expect(putStatuses[putStatuses.length - 1]).toBe(200);
});
