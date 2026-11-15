import { test, expect } from '@playwright/test';
import { registerUser, seedAuth } from './helpers';

/**
 * Notes: minimal real CRUD through the UI using a seeded session.
 *
 * Facts from app/notes/views/notesView.tsx + messages/en.json:
 * - "New Note" button creates an "Untitled" note and opens it in the
 *   inline CodeMirror editor (single state — no edit/preview toggle).
 * - Title input placeholder "Note title"; content editor is `.cm-content`.
 * - No Save button: notes autosave (debounced PUT after ~1.5s idle);
 *   the "Unsaved changes" indicator clears once the save succeeds.
 */
test('create + edit a note via the UI, autosave persists it', async ({
  page,
  request,
}) => {
  const user = await registerUser(request);
  await seedAuth(page, user);

  await page.goto('/notes/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Create: becomes "Untitled", selected, live editor open.
  await page.getByRole('button', { name: 'New Note' }).click();
  const editor = page.locator('.cm-content');
  await expect(editor).toBeVisible();

  // Give it real content through the editor.
  const uniqueTitle = `e2e note ${Date.now().toString(36)}`;
  await page.getByPlaceholder('Note title').fill(uniqueTitle);
  await editor.click();
  await page.keyboard.type('created by notes-crud.spec.ts', { delay: 25 });

  // Autosave: the unsaved indicator appears while typing, then clears once
  // the debounced save succeeds.
  await expect(page.getByText('Unsaved changes').first()).toBeVisible();
  await expect(page.getByText('Unsaved changes').first()).toBeHidden();

  // The note must survive a reload — saved on the server, not just locally.
  await page.reload();
  await expect(page.getByText(uniqueTitle).first()).toBeVisible();
});
