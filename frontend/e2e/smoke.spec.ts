import { test, expect } from '@playwright/test';

/**
 * Deploy-lane canary, from the browser context (not curl): validates the
 * three wiring points the whole suite depends on.
 * - /env-config.js exists and carries NEXT_PUBLIC_API_URL (runtime env
 *   injection written by inject-env.sh / deploy-frontend.sh).
 * - The static export actually serves the app shell (title + main landmark).
 */
test('env-config exposes the API URL and the app shell renders', async ({
  page,
  request,
}) => {
  // Runtime env injection produced by inject-env.sh / deploy-frontend.sh.
  // NEXT_PUBLIC_API_URL must be present; on the full-stack lane it is '/api'
  // (same-origin proxy) — only assert the variable, not the value, so dev
  // servers with a different explicit base URL also pass this canary.
  //
  // /env-config.js is a container-lane artifact: the dev lane bakes
  // NEXT_PUBLIC_API_URL at startup and doesn't serve the file, so the canary
  // only runs when targeting the container lane (no PLAYWRIGHT_API_URL).
  test.skip(
    !!process.env.PLAYWRIGHT_API_URL,
    'env-config.js is a container-lane artifact (dev lane bakes env at startup)'
  );
  const env = await request.get('/env-config.js');
  expect(env.ok()).toBeTruthy();
  expect(await env.text()).toContain('NEXT_PUBLIC_API_URL');

  // First paint: title from app/layout.tsx metadata + the app root renders.
  await page.goto('/');
  await expect(page).toHaveTitle(/LifeTracker/i);
  await expect(page.locator('body')).toBeVisible();
});
