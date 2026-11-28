import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure TS: no DOM needed. Services/i18n/theme are plain functions.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // coverage.include makes untested source files appear at 0% — without
      // it only the files a test imports appear and thresholds are blind.
      // (vitest 4+ removed coverage.all; include is the replacement.)
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts'],
      reporter: ['text', 'html'],
      // Hard coverage gate with a ratchet policy: floors may only move up.
      // Phase 1 (Nov 2026) took the suite from 12.4% to ~90.8% statements
      // (services were the big gap; lib branches remain the weakest spot).
      thresholds: {
        statements: 90,
        branches: 90,
        "src/lib/**": { statements: 88, branches: 46 },
        "src/services/**": { statements: 90, branches: 91 },
        "src/types/**": { statements: 76, branches: 90 },
        "src/utils/**": { statements: 90, branches: 99 },
      },
    },
  },
});
