import { test, expect } from '@playwright/test';

/*
 * Review page (D.4.5 + 复习日历) — visual regression baseline.
 *
 * Same compact 3-col grid as Question Hub plus a calendarBar with the
 * DatePicker default-presets (今天 / 明天 / 下周一).
 */

test('Review page renders calendar bar + compact grid (D.4.5)', async ({ page }) => {
  await page.goto('/review');
  await expect(page.getByTestId('review-view')).toBeVisible();
  await expect(page.getByTestId('review-calendar-bar')).toBeVisible();
  await expect(page.getByTestId('review-grid')).toBeVisible();
  await expect(page).toHaveScreenshot({ fullPage: true });
});
