import { afterEach, describe, expect, it, vi } from 'vitest';

// APP_VERSION is resolved once at module import from the build-time env var
// injected by next.config.mjs; each branch is tested through a fresh module
// registry (vi.resetModules + dynamic import).

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_APP_VERSION;

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.NEXT_PUBLIC_APP_VERSION;
  } else {
    process.env.NEXT_PUBLIC_APP_VERSION = ORIGINAL_ENV;
  }
  vi.resetModules();
});

describe('APP_VERSION', () => {
  it('falls back to 0.0.0 when the build env var is absent', async () => {
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    vi.resetModules();

    const { APP_VERSION } = await import('./version');

    expect(APP_VERSION).toBe('0.0.0');
  });

  it('uses the version injected by next.config.mjs at build time', async () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '1.2.3';
    vi.resetModules();

    const { APP_VERSION } = await import('./version');

    expect(APP_VERSION).toBe('1.2.3');
  });
});
