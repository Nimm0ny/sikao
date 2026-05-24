import { test, expect } from '@playwright/test';

/*
 * Note page (D.4.3) — visual regression baseline.
 *
 * Sticky cards carry [data-tilt] for the -2..+2deg paper-rotation effect.
 * `animations: 'disabled'` in playwright.config.ts freezes hover transitions
 * so the screenshot is deterministic.
 */

test('Note page renders sticky-cards grid + filter chips (D.4.3)', async ({ page }) => {
  await page.goto('/note');
  await expect(page.getByTestId('note-view')).toBeVisible();
  await expect(page.getByTestId('note-grid')).toBeVisible();
  await expect(page).toHaveScreenshot({ fullPage: true });
});
