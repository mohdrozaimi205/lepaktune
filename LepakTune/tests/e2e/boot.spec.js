import { test, expect } from '@playwright/test';
test('app dibuka dengan tema dan 3 tab', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 900 });
  await page.goto('./');
  await expect(page).toHaveTitle('LepakTune');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(20, 16, 12)');
  for (const [tab, id] of [['Studio', 'studio'], ['Perpustakaan', 'perpustakaan'], ['Pemain', 'pemain']]) {
    await page.getByRole('button', { name: tab }).click();
    await expect(page.locator(`#${id}`)).toHaveClass(/active/);
  }
});
