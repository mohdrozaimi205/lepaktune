import { test, expect } from '@playwright/test';
import { freshPage, addFixture, FIX } from './helpers.js';
test('tambah, fail rosak, padam', async ({ page }) => {
  await freshPage(page);
  await addFixture(page, 'tone-10s.mp3');
  await expect(page.locator('.song .t').first()).toHaveText('tone-10s');
  await expect(page.locator('.song .m').first()).toContainText('0:10');
  await page.locator('#fileInput').setInputFiles(FIX('bukan-audio.txt'));
  await expect(page.locator('.toast.bad')).toContainText('bukan lagu yang sah');
  await page.getByRole('button', { name: 'Padam tone-10s' }).click();
  await page.getByRole('button', { name: 'Padam', exact: true }).click();
  await expect(page.locator('.song')).toHaveCount(0);
});
