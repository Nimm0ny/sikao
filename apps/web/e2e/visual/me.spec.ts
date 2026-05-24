import { test, expect } from '@playwright/test';

/*
 * Me page (D.4.4) — visual regression baseline.
 *
 * MeHero + 2-col MeGrid + danger Panel spanning both columns. Danger
 * Panel surface is the most visually distinctive feature of this page
 * (left 4px err bar via .dangerList > li::before scoped class).
 */

test('Me page renders hero + danger Panel (D.4.4)', async ({ page }) => {
  await page.goto('/me');
  await expect(page.getByTestId('me-view')).toBeVisible();
  await expect(page.getByTestId('me-hero')).toBeVisible();
  await expect(page.getByTestId('me-danger-list')).toBeVisible();
  await expect(page).toHaveScreenshot({ fullPage: true });
});
