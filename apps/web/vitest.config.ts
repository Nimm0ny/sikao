import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Vitest config — kept separate from vite.config.ts so the prod build
// pipeline doesn't load test-only transforms / setup files.
//
// Aligns with frontend/CLAUDE.md §4 verification chain (lint / lint:hardcode /
// tsc / build) — adds `test` as the new equivalent for unit/integration.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@sikao/ui': resolve(__dirname, '../../packages/ui/src'),
      '@sikao/design-system': resolve(__dirname, '../../packages/design-system/src'),
      '@sikao/api-client': resolve(__dirname, '../../packages/api-client/src'),
      '@sikao/domain': resolve(__dirname, '../../packages/domain/src'),
      '@sikao/answer-engine': resolve(__dirname, '../../packages/answer-engine/src'),
      '@sikao/editor': resolve(__dirname, '../../packages/editor/src'),
      '@sikao/shared-utils': resolve(__dirname, '../../packages/shared-utils/src'),
      '@sikao/config': resolve(__dirname, '../../packages/config/src'),
      '@sikao/test-utils': resolve(__dirname, '../../tests/fixtures'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true, // expose describe/it/expect without explicit imports
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/setupTests.ts', 'src/main.tsx'],
    },
  },
});
