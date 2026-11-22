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
        // Vendored shadcn/ui primitives (upstream boilerplate, no app logic —
        // same policy as demo/e2e). Custom in-repo components stay covered:
        // card/{delete-modal,entityCard,entityDropdown}, category/*,
        // filterModal/*, countdown, page-header, password-input,
        // streak-badge, time-input.
        'components/ui/{accordion,alert,alert-dialog,aspect-ratio,avatar,badge,breadcrumb,button,calendar,card,carousel,chart,checkbox,collapsible,command,context-menu,dialog,drawer,dropdown-menu,form,hover-card,input-otp,input,label,menubar,navigation-menu,pagination,popover,progress,radio-group,resizable,scroll-area,select,separator,sheet,sidebar,skeleton,slider,sonner,switch,table,tabs,textarea,toggle,toggle-group,tooltip,use-mobile}.tsx',
      ],
      reporter: ['text', 'html'],
      // Hard coverage gate with a ratchet policy: floors sit just below the
      // measured Nov 2026 post-Phase-2 numbers (all 68 files / 558 tests,
      // untested files count as 0%) and may only move up toward the 80%+ end
      // state. Vendored shadcn primitives are excluded from the denominator
      // (see excludes); custom components and feature folders stay in.
      thresholds: {
        statements: 85,
        branches: 76,
        'app/**': { statements: 88, branches: 78 },
        'components/**': { statements: 72, branches: 65 },
        'contexts/**': { statements: 94, branches: 86 },
        'hooks/**': { statements: 99, branches: 99 },
        'lib/**': { statements: 96, branches: 93 },
      },
    },
  },
});
