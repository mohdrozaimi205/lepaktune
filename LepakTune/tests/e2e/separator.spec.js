import { test, expect } from '@playwright/test';
import { freshPage, addFixture } from './helpers.js';
test.setTimeout(15 * 60 * 1000);

test('AI asingkan 4 stem: kunci betul, tiada NaN, jumlah stem ≈ lagu asal, sempadan segmen licin', async ({ page }) => {
  page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
  await freshPage(page);
  await addFixture(page, 'mix-10s.mp3');
  const r = await page.evaluate(async () => {
    const { app, separate } = window.__lepak;
    await app.loadSong(app.songs[0].id, { autoplay: false });
    const mix = app.mixBuffer;
    let backend = null; let threads = null;
    const t0 = performance.now();
    const stems = await separate(mix, { forceWasm: true, onBackend: (b, t) => { backend = b; threads = t; } });
    const secs = (performance.now() - t0) / 1000;
    const names = Object.keys(stems).sort();
    let nan = false; let err = 0; let ref = 0; let jump = 0;
    const seg = Math.floor(7.8 * 44100);
    for (let c = 0; c < 2; c++) {
      const m = mix.getChannelData(c);
      const sum = new Float32Array(m.length);
      for (const n of names) { const d = stems[n].getChannelData(c); for (let i = 0; i < m.length; i++) { if (Number.isNaN(d[i])) nan = true; sum[i] += d[i]; } }
      for (let i = 0; i < m.length; i++) { err += (sum[i] - m[i]) ** 2; ref += m[i] ** 2; }
      for (let i = seg - 50; i < seg + 50; i++) jump = Math.max(jump, Math.abs(sum[i] - sum[i - 1]) - Math.abs(m[i] - m[i - 1]));
    }
    return { iso: self.crossOriginIsolated, threads, names, nan, relRms: Math.sqrt(err / ref), jump, backend, secs, len: stems.vocals.length, mixLen: mix.length };
  });
  console.log('separator:', JSON.stringify(r));
  expect(r.names).toEqual(['bass', 'drums', 'other', 'vocals']);
  expect(r.nan).toBe(false);
  expect(r.len).toBe(r.mixLen);
  expect(r.relRms).toBeLessThan(0.2); // Demucs tidak jamin jumlah stem tepat sama dengan lagu asal
  expect(r.jump).toBeLessThan(0.1);
  expect(r.backend).toBe('wasm');
});
