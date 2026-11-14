import { test, expect } from '@playwright/test';
import { freshPage } from './helpers.js';

test('service worker aktif: luar talian + crossOriginIsolated (AI guna banyak teras)', async ({ page, context }) => {
  await page.goto('./');
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.active, null, { timeout: 30000 });
  await page.waitForFunction(() => self.crossOriginIsolated === true, null, { timeout: 30000 }); // app muat semula sendiri
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle('LepakTune');
  await context.setOffline(false);
});

test('Kongsi -> LepakTune (share target) masukkan lagu', async ({ page }) => {
  await freshPage(page);
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.active, null, { timeout: 30000 });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const fs = await import('node:fs');
  const b64 = fs.readFileSync('tests/fixtures/tone-10s.mp3').toString('base64');
  const status = await page.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const fd = new FormData();
    fd.append('audio', new File([bin], 'Dikongsi.mp3', { type: 'audio/mpeg' }));
    const r = await fetch('/lepaktune/share', { method: 'POST', body: fd, redirect: 'manual' });
    return r.type;
  }, b64);
  expect(status).toBe('opaqueredirect');
  await page.goto('./#perpustakaan?baru=1');
  await expect(page.locator('.song .t', { hasText: 'Dikongsi' })).toBeVisible();
});
