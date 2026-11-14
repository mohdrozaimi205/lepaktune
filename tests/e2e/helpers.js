import path from 'node:path';
export const FIX = (f) => path.resolve('tests/fixtures', f);
export async function freshPage(page) {
  await page.goto('./');
  await page.waitForFunction(() => self.crossOriginIsolated === true, null, { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => !!window.__lepak);
  await page.evaluate(async () => {
    const ids = (await window.__lepak.db.listSongs()).map((s) => s.id);
    for (const id of ids) await window.__lepak.db.deleteSong(id);
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__lepak);
}
export async function addFixture(page, name) {
  await page.locator('#fileInput').setInputFiles(FIX(name));
  await page.locator('.song').first().waitFor({ state: 'attached' });
}
/** Jalankan dalam page: frekuensi dominan buffer (DFT kasar pada tetingkap tengah). */
export const DOMINANT_FREQ_SRC = `(buf) => {
  const d = buf.getChannelData(0); const sr = buf.sampleRate; const N = 16384; const off = Math.floor(d.length/2 - N/2);
  let best = 0, bestF = 0;
  for (let f = 100; f < 1000; f += 0.5) { let re = 0, im = 0; const w = 2*Math.PI*f/sr;
    for (let i = 0; i < N; i += 2) { re += d[off+i]*Math.cos(w*i); im += d[off+i]*Math.sin(w*i); }
    const m = re*re+im*im; if (m > best) { best = m; bestF = f; } }
  return bestF; }`;
