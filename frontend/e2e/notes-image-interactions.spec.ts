import { expect, test } from '@playwright/test';
import { registerUser, seedAuth } from './helpers';

/**
 * Happy path for the interactive note images (PR #155):
 * click keeps the image rendered, double-click reveals its raw markdown,
 * drag moves it to another line, and the resize handle persists a
 * `{width=Npx}` attribute that survives reload.
 *
 * Runs on the container lane (same prerequisites as
 * notes-image-paste.spec.ts: API + aws-emulator profile via
 * `make dev-container`; CI browses 127.0.0.1:3000 so image fetches are
 * same-origin with the backend's S3_PUBLIC_URL default).
 *
 * The image is uploaded through the API from a page-context canvas, and
 * the note is created via the API — the paste spec already covers the
 * upload-through-UI flow.
 */
test('note image interactions: click, reveal, drag-move, resize', async ({
  page,
  request,
}) => {
  const user = await registerUser(request);
  await seedAuth(page, user);
  const auth = { Authorization: `Bearer ${user.accessToken}` };

  await page.goto('/notes/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  // Upload a real 300x200 PNG from a page canvas (same trick as the
  // paste spec, but posted straight to the API — same origin, so the
  // nginx /api proxy forwards it and the emulator stores the object).
  const imageUrl = await page.evaluate(async (token: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#5c6f55';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b as Blob), 'image/png')
    );
    const form = new FormData();
    form.append('image', new File([blob], 'shot.png', { type: 'image/png' }));
    const response = await fetch('/api/notes/images', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!response.ok) {
      throw new Error(`image upload failed: ${response.status}`);
    }
    const body = (await response.json()) as { data: { url: string } };
    return body.data.url;
  }, user.accessToken);

  // Seed the note via the API: image on its own line, then two text
  // paragraphs to drag onto and park the cursor in.
  const uniqueTitle = `interactions note ${Date.now().toString(36)}`;
  const alt = 'note image';
  const imageMarkdown = `![${alt}](${imageUrl})`;
  const create = await request.post('/api/notes', {
    headers: auth,
    data: {
      title: uniqueTitle,
      content: `${imageMarkdown}\n\nfirst paragraph\n\nlast line`,
    },
  });
  expect(create.ok()).toBe(true);
  const note = (await create.json()) as {
    data: { id: number; content: string };
  };
  const noteId = note.data.id;

  // Fetch the persisted content (autosave is debounced — always poll).
  const noteContent = async (): Promise<string> => {
    const response = await request.get(`/api/notes/${noteId}`, {
      headers: auth,
    });
    const body = (await response.json()) as { data: { content: string } };
    return body.data.content;
  };

  // Open the note and park the cursor on the last line so the image
  // renders as a widget.
  await page.reload();
  await page.getByText(uniqueTitle).first().click();
  await page.getByText('last line').click();
  const img = page.locator('.cm-md-image');
  await expect(img).toHaveCount(1);

  // The bitmap itself must load (not a broken-image box) — proves the
  // emulator object is being served through the lane's image proxy.
  await expect
    .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);

  // --- Single click: the image stays rendered, raw markdown hidden. ---
  await img.click();
  await expect(img).toHaveCount(1);
  await expect(page.locator('.cm-md-mark')).toHaveCount(0);

  // --- Double-click: the raw markdown is revealed for URL editing. ---
  await img.dblclick();
  await expect(page.locator('.cm-md-mark').first()).toBeVisible();
  await expect(page.getByText(new RegExp(`^\\!\\[${alt}\\]\\(`))).toBeVisible();
  // Clicking elsewhere re-renders the image.
  await page.getByText('first paragraph').click();
  await expect(img).toHaveCount(1);
  await expect(page.locator('.cm-md-mark')).toHaveCount(0);

  // --- Drag: move the image below the first paragraph. ---
  const imageBox = (await img.boundingBox())!;
  const targetBox = (await page.getByText('last line').boundingBox())!;
  await page.mouse.move(
    imageBox.x + imageBox.width / 2,
    imageBox.y + imageBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 15 }
  );
  await page.mouse.up();

  // The widget re-renders at the new spot...
  await expect(img).toHaveCount(1);
  // ...and autosave persists the move: exactly one image, now after the
  // first paragraph (ordering, not exact position — robust against
  // mid-line drop variance).
  await expect
    .poll(async () => {
      const content = await noteContent();
      return (
        content.split(imageMarkdown).length === 2 &&
        content.indexOf(imageMarkdown) > content.indexOf('first paragraph')
      );
    })
    .toBe(true);

  // --- Resize: drag the corner handle and persist the width. ---
  await img.hover();
  const handle = page.locator('.cm-md-image-handle');
  await expect(handle).toBeVisible();
  const startWidth = await img.evaluate(
    (el) => (el as HTMLImageElement).getBoundingClientRect().width
  );
  const handleBox = (await handle.boundingBox())!;
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    handleBox.x + handleBox.width / 2 + 120,
    handleBox.y + handleBox.height / 2,
    { steps: 10 }
  );
  await page.mouse.up();

  // The persisted width attribute appears in the note content...
  await expect
    .poll(async () => {
      const content = await noteContent();
      const match = /\{width=(\d+)px\}/.exec(content);
      return match ? Number(match[1]) : 0;
    })
    .toBeGreaterThan(startWidth);
  // ...and the widget re-renders at that width.
  await expect
    .poll(() =>
      img.evaluate((el) => (el as HTMLImageElement).style.width || '')
    )
    .toMatch(/px$/);

  // --- Reload: the size attribute parses and renders again. ---
  await page.reload();
  await page.getByText(uniqueTitle).first().click();
  await page.getByText('last line').click();
  await expect(img).toHaveCount(1);
  await expect
    .poll(() => img.evaluate((el) => (el as HTMLImageElement).style.width))
    .toMatch(/^\d+px$/);
});
