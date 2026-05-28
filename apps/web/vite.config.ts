import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import {
  createDesignSystemFontHostMiddleware,
  DESIGN_SYSTEM_FONT_ROUTE_PREFIX,
  listDesignSystemFonts,
} from './src/dev/designSystemFontHost';
import { createPrototypeHostMiddleware } from './src/dev/prototypeHost';

// SIKAO Web — sikao/apps/web
// 端口 18080 是硬约束（见 docs/vault/03-tech/Architecture.md）
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'prototype-host',
      apply: 'serve',
      configureServer(server) {
        // Why: SIK-128 H11 acceptance needs prototype pages to be reachable
        // from localhost. Browser/Chrome block file:// URLs by policy, so we
        // expose .tmp_review assets through a dev-only route instead.
        server.middlewares.use(createPrototypeHostMiddleware(__dirname));
      },
    },
    {
      name: 'design-system-font-host',
      configureServer(server) {
        server.middlewares.use(createDesignSystemFontHostMiddleware(__dirname));
      },
      generateBundle() {
        for (const file of listDesignSystemFonts(__dirname)) {
          this.emitFile({
            type: 'asset',
            fileName: `${DESIGN_SYSTEM_FONT_ROUTE_PREFIX.slice(1)}/${file.fileName}`,
            source: file.bytes,
          });
        }
      },
    },
  ],
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
          if (id.includes('/recharts/') || id.includes('/d3-')) return 'vendor-recharts';
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
  // SIK-91 Home M-B: recharts is dynamically imported by ProfileLearning
  // Charts.tsx so vite needs it in the dep optimizer cache; without
  // explicit include the dev server emits 504 Outdated Optimize Dep on
  // first /profile/learning navigation.
  optimizeDeps: {
    include: ['recharts'],
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
