import { defineConfig, devices } from '@playwright/test';

/**
 * Essential-E2E config (chromium only).
 *
 * Target lane: the full-stack container mode (like `make dev-container`):
 * the static export served by nginx on :3000 with the /api proxy pointing at
 * the backend — exactly what the CI e2e job and the deploy lane run.
 *
 * Run locally:
 *   make dev-container          # postgres + mongodb + api + web on :3000
 *   cd frontend && npm run test:e2e
 *
 * Chromium is the only project for CI speed / lower flake. Opt into the other
 * browsers with E2E_ALL_BROWSERS=1 (adds firefox + webkit projects).
 */
export default defineConfig({
  testDir: './e2e',
  // One worker + no parallelism: specs share real backend/database state.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  expect: {
    timeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Desktop-size viewport: the notes page hides the list on small
        // screens (md:flex/hidden responsive classes) — keep it visible.
        viewport: { width: 1280, height: 720 },
      },
    },
    ...(process.env.E2E_ALL_BROWSERS
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        ]
      : []),
  ],
});
