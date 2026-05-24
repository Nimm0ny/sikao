import { test, expect } from '@playwright/test';

/*
 * Practice page (D.4.2) — visual regression baseline.
 *
 * row1 height collapses 224 → 192px under @media (max-height: 800px);
 * the per-viewport runs cover both regimes naturally (xs/sm/md/lg are
 * <= 800 height in our config; xl and 3xl are taller).
 */

test('Practice page renders 4-row grid + ScopeToggle (D.4.2)', async ({ page }) => {
  await page.goto('/practice');
  await expect(page.getByTestId('practice-view')).toBeVisible();
  await expect(page.getByTestId('practice-specialty-grid')).toBeVisible();
  await expect(page).toHaveScreenshot({ fullPage: true });
});
