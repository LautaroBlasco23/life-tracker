import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure TS: no DOM needed. Services/i18n/theme are plain functions.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // all=true counts untested source files as 0% — without it only the
      // files a test imports appear in the report and thresholds are blind.
      all: true,
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts'],
      reporter: ['text', 'html'],
      // Hard coverage gate with a ratchet policy: floors start just below
      // the measured baseline (Nov 2026, `all: true`) and may only move up.
      // Phase 1 targets: services/** (11 services untested), types/** and
      // utils/** (pure functions, easy wins).
      thresholds: {
        statements: 12,
        branches: 8,
        "src/lib/**": { statements: 44, branches: 46 },
        "src/services/**": { statements: 11, branches: 7 },
        "src/types/**": { statements: 0, branches: 0 },
        "src/utils/**": { statements: 0, branches: 0 },
      },
    },
  },
});
