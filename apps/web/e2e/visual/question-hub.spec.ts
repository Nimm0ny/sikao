import { test, expect } from '@playwright/test';

/*
 * Question Hub page (D.4.5) — visual regression baseline.
 *
 * 3-row grid (header / FilterBar with 3 chip groups / Panel with compact
 * 3-col grid). Verifies --card-radius-sm density tightening per spec.
 */

test('Question Hub page renders compact 3-col grid (D.4.5)', async ({ page }) => {
  await page.goto('/question-hub');
  await expect(page.getByTestId('question-hub-view')).toBeVisible();
  await expect(page.getByTestId('hub-grid')).toBeVisible();
  await expect(page).toHaveScreenshot({ fullPage: true });
});
