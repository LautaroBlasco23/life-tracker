import { test, expect } from '@playwright/test';
import { registerUser, seedAuth } from './helpers';

/**
 * Pasting a screenshot into the notes editor uploads it and embeds the
 * markdown image, which renders inline (`.cm-md-image` widget) once the
 * note is saved and reloaded.
 *
 * Requires an API with the note-image endpoint and an S3-compatible store
 * (dev lane: PLAYWRIGHT_API_URL points at an API started with
 * AWS_ENDPOINT_URL against LocalStack/MinIO on :4566).
 */
test('paste an image into a note: upload, embed, render inline', async ({
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

  // Paste a small generated PNG through a synthetic clipboard event.
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#5c6f55';
      ctx.fillRect(0, 0, 8, 8);
    }
    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b as Blob), 'image/png')
    );
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'shot.png', { type: 'image/png' }));
    const event = new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true,
    });
    document.querySelector('.cm-content')?.dispatchEvent(event);
  });

  // The placeholder is swapped for the uploaded URL from S3 (fast enough
  // that the transient `![Uploading image...` state may already be gone).
  const imageMarkdown = editor.locator(
    'text=/^!\\[Pasted image\\]\\(http:\\/\\/localhost:4566\\/lifetracker-images\\/notes\\//'
  );
  await expect(imageMarkdown).toHaveCount(1, { timeout: 15000 });

  // No placeholder left behind.
  await expect(page.getByText('Uploading image...')).toBeHidden();

  // Add text below the image (so the image line can be inactive later) and
  // give the title an identity; let autosave flush.
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\n\ntext after image', { delay: 20 });
  const uniqueTitle = `paste note ${Date.now().toString(36)}`;
  await page.getByPlaceholder('Note title').fill(uniqueTitle);
  await expect(page.getByText('Unsaved changes').first()).toBeHidden();

  // Reload: the note comes back with the image rendered inline (widget)
  // once the cursor is not on the image line.
  await page.reload();
  await page.getByText(uniqueTitle).first().click();
  await page.getByText('text after image').click();
  await expect(page.locator('.cm-md-image')).toHaveCount(1);
  const url = await page.locator('.cm-md-image').getAttribute('src');
  expect(url).toContain('lifetracker-images/notes/');

  // The bitmap itself must load (not a broken-image box).
  await expect
    .poll(() =>
      page
        .locator('.cm-md-image')
        .evaluate((img) => (img as HTMLImageElement).naturalWidth > 0)
    )
    .toBe(true);
});
