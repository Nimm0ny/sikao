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
      '@sikao/design-system': resolve(__dirname, '../../packages/design-system/src'),
      '@sikao/api-client': resolve(__dirname, '../../packages/api-client/src'),
      '@sikao/domain': resolve(__dirname, '../../packages/domain/src'),
      '@sikao/answer-engine': resolve(__dirname, '../../packages/answer-engine/src'),
      '@sikao/calendar-engine': resolve(__dirname, '../../packages/calendar-engine/src'),
      '@sikao/editor': resolve(__dirname, '../../packages/editor/src'),
      '@sikao/shared-utils': resolve(__dirname, '../../packages/shared-utils/src'),
      '@sikao/config': resolve(__dirname, '../../packages/config/src'),
      '@sikao/test-utils': resolve(__dirname, '../../tests/fixtures'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true, // expose describe/it/expect without explicit imports
    // V5-M0.5 (2026-05-24): apps/web 业务层 big-bang 删除后, src/ 下没有
    // 测试文件; 直到 V5-M3 (35 组件骨架) 才开始重建. 加 passWithNoTests
    // 让 monorepo `npm test --workspaces` 通过空集合.
    passWithNoTests: true,
    // Workspace-wide runs in this monorepo can push a few user-event heavy auth
    // tests past the 5s default even when behavior is correct.
    testTimeout: 15000,
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Playwright lives at apps/web/e2e/ with its own runner + config; vitest
    // would otherwise try to evaluate the @playwright/test imports there
    // and fail with matchMedia / window.location errors when 36 specs spool
    // up under jsdom.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/setupTests.ts', 'src/main.tsx'],
    },
  },
});
