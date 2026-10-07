import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure TS: no DOM needed. Services/i18n/theme are plain functions.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
