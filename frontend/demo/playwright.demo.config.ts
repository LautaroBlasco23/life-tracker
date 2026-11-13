import { defineConfig } from '@playwright/test';

/**
 * Demo-video config (chromium only, headless).
 *
 * Lane: same as the e2e lane — `make dev-container` (nginx :3000 with /api
 * proxy) or `make dev` + PLAYWRIGHT_API_URL. Run:
 *
 *   npm run demo:video:capture   # playwright test --config demo/...
 *   npm run demo:video:render    # node scripts/render-demo-video.mjs
 *   npm run demo:video           # capture + render
 *
 * The spec records the browser context into demo/recordings/*.webm (video
 * size == viewport to avoid Playwright's CSS-pixel soft recording); the
 * render script encodes the newest recording to demo/output/demo.mp4.
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'demo.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // One long take — the whole tour lives in a single test so the context
  // (and its .webm) is written exactly once.
  timeout: 180_000,
  reporter: [['list']],
  // Keep demo artifacts out of the e2e test-results dir; recordings land in
  // demo/recordings/... (resolved relative to this config dir).
  outputDir: 'recordings',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    viewport: { width: 1280, height: 720 },
    video: {
      // Record at exactly the viewport size: Playwright's recorder captures
      // at CSS-pixel size and ignores deviceScaleFactor.
      mode: 'on',
      size: { width: 1280, height: 720 },
    },
    trace: 'off',
    launchOptions: {
      slowMo: Number(process.env.E2E_SLOWMO_MS || 0),
    },
  },
  expect: {
    timeout: 10_000,
  },
});
