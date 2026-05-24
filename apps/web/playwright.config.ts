import { defineConfig, devices } from '@playwright/test';

/*
 * V5-M9 Phase 7 task 23.2 — playwright visual regression baseline.
 *
 * 6 viewport projects × 6 desktop pages = 36 screenshots per run.
 *
 * Why a separate config (not inside vitest.config.ts):
 *   - playwright is a separate test runner with its own snapshot pipeline.
 *   - vitest stays in jsdom for component / a11y unit tests.
 *
 * webServer: vite dev server fixed at port 18080 (AGENT-H10). Reused if
 * already running locally so a developer can iterate without restarting.
 *
 * Snapshot strategy:
 *   - PNG outputs are gitignored (see apps/web/e2e/visual/__snapshots__/.gitignore).
 *     Cross-platform pixel diffs make committed binaries fragile across
 *     Windows / Linux CI / macOS dev. Each environment regenerates its own
 *     baseline on first run via `--update-snapshots`.
 *   - The spec files + this config ARE committed so the test infrastructure
 *     reproduces; the baseline binary itself is local artifact.
 *   - `expect.toHaveScreenshot({ maxDiffPixels: 100 })` allows minor sub-
 *     pixel font rendering drift.
 */

const VIEWPORTS = [
  { name: 'xs', width: 375, height: 667 }, // mobile portrait
  { name: 'sm', width: 480, height: 800 }, // large mobile
  { name: 'md', width: 768, height: 1024 }, // iPad portrait
  { name: 'lg', width: 1024, height: 768 }, // iPad landscape / 13" laptop
  { name: 'xl', width: 1280, height: 800 }, // desktop default
  { name: '3xl', width: 1920, height: 1080 }, // 1920 main-stage
];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // sequential keeps screenshots deterministic
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://127.0.0.1:18080',
    trace: 'retain-on-failure',
    actionTimeout: 5000,
    navigationTimeout: 15000,
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,
      animations: 'disabled',
    },
  },
  projects: VIEWPORTS.map((vp) => ({
    name: vp.name,
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: vp.width, height: vp.height },
    },
  })),
  webServer: {
    command: 'npm run dev',
    cwd: '.',
    url: 'http://127.0.0.1:18080',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
