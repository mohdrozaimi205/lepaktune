// Muat turun model AI sekali, kemudian simpan dalam Cache API supaya boleh guna tanpa internet.
const BASE = import.meta.env?.BASE_URL ?? '/';
const CACHE = 'lepaktune-models-v1';

export const MODELS = {
  4: { file: 'htdemucs_4s.onnx', parts: 8, bytes: 174263526, available: true },
  6: { file: 'htdemucs_6s.onnx', parts: 0, bytes: 0, available: false }, // akan datang
};

function key(mode) {
  return new URL(`${BASE}models/${MODELS[mode].file}`, self.location.origin).href;
}

export async function hasModel(mode) {
  if (!MODELS[mode]?.available) return false;
  const c = await caches.open(CACHE);
  return !!(await c.match(key(mode)));
}

/** Pulangan ArrayBuffer model. onProgress(0..1) semasa muat turun. */
export async function ensureModel(mode, onProgress) {
  const m = MODELS[mode];
  if (!m?.available) throw new Error('Model ini belum tersedia');
  const c = await caches.open(CACHE);
  const hit = await c.match(key(mode));
  if (hit) return hit.arrayBuffer();

  const all = new Uint8Array(m.bytes);
  let got = 0;
  for (let i = 0; i < m.parts; i++) {
    const res = await fetch(`${BASE}models/${m.file}.part${i}`);
    if (!res.ok) throw new Error(`Gagal muat turun model (bahagian ${i + 1})`);
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      all.set(value, got);
      got += value.length;
      onProgress?.(got / m.bytes);
    }
  }
  if (got !== m.bytes) throw new Error('Model tidak lengkap, cuba lagi');
  await c.put(key(mode), new Response(all, { headers: { 'Content-Type': 'application/octet-stream' } }));
  return all.buffer;
}

export async function deleteModels() {
  await caches.delete(CACHE);
}
