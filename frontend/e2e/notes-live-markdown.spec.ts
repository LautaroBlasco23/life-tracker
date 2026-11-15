import { test, expect } from '@playwright/test';
import { registerUser, seedAuth } from './helpers';

/**
 * Live markdown rendering in the notes editor (CodeMirror 6).
 *
 * Expected behavior:
 * - Inactive lines render styled: `# X` shows as a big heading span,
 *   `-` list markers collapse into a bullet glyph, `**x**` shows bold.
 * - The line the cursor sits on shows its raw markers, dimmed
 *   (`.cm-md-mark`).
 */
test('live markdown: headings, lists and active-line markers', async ({
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
  await page.keyboard.type('# My title\n');
  await page.keyboard.press('Enter'); // blank line between blocks
  await page.keyboard.type('- first item\n');
  // Enter auto-continues the list (adds "- "), so type content without a
  // marker; a second Enter on the empty item exits the list.
  await page.keyboard.type('second item\n');
  await page.keyboard.press('Enter');
  await page.keyboard.type('plain **bold** text');

  // Inactive rendering: the heading span exists and list markers became
  // bullet widgets.
  await expect(
    page.locator('.cm-md-h1', { hasText: 'My title' })
  ).toBeVisible();
  await expect(page.locator('.cm-md-bullet')).toHaveCount(2);
  await expect(
    page.locator('.cm-md-strong', { hasText: 'bold' })
  ).toBeVisible();

  // On the last (active) line the `**` markers are visible, dimmed.
  await expect(page.locator('.cm-md-mark')).toHaveCount(2);

  // Entering the heading line re-reveals its marker, dimmed.
  await page.locator('.cm-md-h1').click();
  await expect(
    page.locator('.cm-line', { hasText: 'My title' }).locator('.cm-md-mark')
  ).toHaveCount(1);
});
