import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'apps/web/src'),
      '@sikao/design-system': resolve(__dirname, 'packages/design-system/src'),
      '@sikao/api-client': resolve(__dirname, 'packages/api-client/src'),
      '@sikao/domain': resolve(__dirname, 'packages/domain/src'),
      '@sikao/answer-engine': resolve(__dirname, 'packages/answer-engine/src'),
      '@sikao/calendar-engine': resolve(__dirname, 'packages/calendar-engine/src'),
      '@sikao/editor': resolve(__dirname, 'packages/editor/src'),
      '@sikao/shared-utils': resolve(__dirname, 'packages/shared-utils/src'),
      '@sikao/config': resolve(__dirname, 'packages/config/src'),
      '@sikao/test-utils': resolve(__dirname, 'tests/fixtures'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    passWithNoTests: false,
    testTimeout: 15000,
    setupFiles: ['./apps/web/src/setupTests.ts'],
    include: ['packages/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**', 'apps/**', 'services/**'],
  },
});
