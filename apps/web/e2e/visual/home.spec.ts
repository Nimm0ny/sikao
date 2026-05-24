import { test, expect } from '@playwright/test';

/*
 * Home page (D.4.1) — visual regression baseline.
 *
 * Hits / and asserts the full-page screenshot matches the per-viewport
 * baseline. The 6 projects in playwright.config.ts replay this same spec
 * across xs/sm/md/lg/xl/3xl viewports.
 */

test('Home page renders desktop grid (D.4.1)', async ({ page }) => {
  await page.goto('/');
  // Wait for the metric row to settle so async font loading doesn't
  // diff against the baseline.
  await expect(page.getByTestId('home-view')).toBeVisible();
  await expect(page.getByTestId('home-metric-practice')).toBeVisible();
  await expect(page).toHaveScreenshot({ fullPage: true });
});
