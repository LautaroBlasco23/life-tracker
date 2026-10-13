import { test, expect } from '@playwright/test';
import { registerUser, seedAuth } from './helpers';

/**
 * Notes: minimal real CRUD through the UI using a seeded session.
 *
 * Facts from app/notes/page.tsx + messages/en.json:
 * - "New Note" button creates an "Untitled" note, selects it and enters
 *   edit mode (no dialog — the editor is inline in the page).
 * - Title input placeholder "Note title"; content "Start writing...";
 *   Save button label "Save" (disabled until something changed).
 */
test('create + edit a note via the UI and see it in the list', async ({
  page,
  request,
}) => {
  const user = await registerUser(request);
  await seedAuth(page, user);

  await page.goto('/notes/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create: becomes "Untitled", selected, editor in edit mode.
  await page.getByRole('button', { name: 'New Note' }).click();
  const editorVisible = page.getByPlaceholder('Start writing...');
  await expect(editorVisible).toBeVisible();

  // Give it real content through the editor.
  const uniqueTitle = `e2e note ${Date.now().toString(36)}`;
  await page.getByPlaceholder('Note title').fill(uniqueTitle);
  await page
    .getByPlaceholder('Start writing...')
    .fill('created by notes-crud.spec.ts');
  await page.getByRole('button', { name: 'Save' }).click();

  // Back to the list and assert the saved title. NOTE: do NOT click the
  // editor's Back button — it's `md:hidden` at the desktop viewport, and
  // Playwright's click auto-wait blocks 30s waiting for visibility (swallowed
  // by a catch, but it eats the whole test timeout). On desktop the list is
  // always visible next to the editor.
  await expect(page.getByText(uniqueTitle).first()).toBeVisible();
});
