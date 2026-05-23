import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// SIKAO Web — sikao/apps/web
// 端口 18080 是硬约束（见 docs/vault/03-tech/Architecture.md）
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    modulePreload: { polyfill: false },
    minify: 'oxc',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router')) {
            return 'vendor-react';
          }
          if (id.includes('/@tanstack/react-query/')) return 'vendor-query';
          if (id.includes('/framer-motion/') || id.includes('/motion-')) return 'vendor-motion';
          if (id.includes('/lodash-es/') || id.includes('/dompurify/')) return 'vendor-utils';
          return undefined;
        },
      },
    },
  },
  server: {
    proxy: {
      '/api/v2': 'http://127.0.0.1:8000',
      '/healthz': 'http://127.0.0.1:8000',
      '/readyz': 'http://127.0.0.1:8000',
      '/version': 'http://127.0.0.1:8000',
      '/version.json': 'http://127.0.0.1:8000',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@sikao/design-system': resolve(__dirname, '../../packages/design-system/src'),
      '@sikao/api-client': resolve(__dirname, '../../packages/api-client/src'),
      '@sikao/domain': resolve(__dirname, '../../packages/domain/src'),
      '@sikao/calendar-engine': resolve(__dirname, '../../packages/calendar-engine/src'),
      '@sikao/answer-engine': resolve(__dirname, '../../packages/answer-engine/src'),
      '@sikao/editor': resolve(__dirname, '../../packages/editor/src'),
      '@sikao/shared-utils': resolve(__dirname, '../../packages/shared-utils/src'),
      '@sikao/config': resolve(__dirname, '../../packages/config/src'),
      '@sikao/test-utils': resolve(__dirname, '../../tests/fixtures'),
    },
  },
});
