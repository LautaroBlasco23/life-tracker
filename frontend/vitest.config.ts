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
  },
});
