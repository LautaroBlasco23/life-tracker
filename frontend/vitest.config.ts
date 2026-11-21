import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mirrors frontend/tsconfig.json paths (@shared consumed from source).
      '@shared': path.resolve(__dirname, '../packages/shared/src'),
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    environment: 'jsdom',
    // globals=true lets @testing-library/react register its automatic
    // afterEach cleanup (tests still import APIs explicitly).
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', 'out/**', '.next/**'],
    coverage: {
      provider: 'v8',
      // coverage.include makes untested source files appear at 0% — without
      // it only the files a test imports appear and thresholds are blind.
      // (vitest 4+ removed coverage.all; include is the replacement.)
      include: ['app/**', 'components/**', 'contexts/**', 'hooks/**', 'lib/**'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        // Demo-video capture lane, Playwright specs/helpers, build output
        // and the CI e2e listener tooling — not product code.
        'demo/**',
        'e2e/**',
        'scripts/**',
        'out/**',
        '.next/**',
        'node_modules/**',
      ],
      reporter: ['text', 'html'],
      // Hard coverage gate with a ratchet policy: floors start just below the
      // measured baseline (Nov 2026, `all: true`) and may only move up.
      // Feature folders (app/components/hooks/lib) are the Phase 2+ work;
      // contexts is already near its ceiling.
      thresholds: {
        statements: 9,
        branches: 6,
        'app/**': { statements: 8, branches: 5 },
        'components/**': { statements: 9, branches: 6 },
        'contexts/**': { statements: 94, branches: 86 },
        'hooks/**': { statements: 0, branches: 0 },
        'lib/**': { statements: 1, branches: 0 },
      },
    },
  },
});
