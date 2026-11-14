// API utama untuk asingkan stem. Kerja berat berlaku dalam Web Worker.
import { toStereo } from '../audio/decode.js';

export const STEM_LABELS = {
  vocals: { label: 'Vokal', emoji: '🎤' },
  drums: { label: 'Dram', emoji: '🥁' },
  bass: { label: 'Bass', emoji: '🎸' },
  other: { label: 'Lain-lain', emoji: '🎹' },
  guitar: { label: 'Gitar', emoji: '🪕' },
  piano: { label: 'Piano', emoji: '🎹' },
};
export const STEM_ORDER = ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other'];

let worker = null;
let seq = 0;

function getWorker() {
  if (!worker) worker = new Worker(new URL('./separator.worker.js', import.meta.url), { type: 'module' });
  return worker;
}

/**
 * @param {AudioBuffer} buffer 44.1 kHz
 * @param {{mode?: 4|6, forceWasm?: boolean, onProgress?: (info:{phase:string,pct:number,eta:number|null})=>void, onBackend?: (name:string)=>void}} opts
 * @returns {Promise<Record<string, AudioBuffer>>}
 */
export function separate(buffer, opts = {}) {
  if (buffer.sampleRate !== 44100) return Promise.reject(new Error('Perlu 44.1 kHz'));
  const st = toStereo(buffer);
  const channels = [new Float32Array(st.getChannelData(0)), new Float32Array(st.getChannelData(1))];
  const id = ++seq;
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const onMsg = (ev) => {
      const m = ev.data;
      if (m.id !== id) return;
      if (m.type === 'progress') opts.onProgress?.(m);
      else if (m.type === 'backend') opts.onBackend?.(m.name, m.threads);
      else if (m.type === 'error') { w.removeEventListener('message', onMsg); reject(new Error(m.message)); }
      else if (m.type === 'done') {
        w.removeEventListener('message', onMsg);
        const out = {};
        for (const [name, chans] of Object.entries(m.stems)) {
          const b = new AudioBuffer({ length: chans[0].length, numberOfChannels: 2, sampleRate: 44100 });
          b.copyToChannel(chans[0], 0);
          b.copyToChannel(chans[1], 1);
          out[name] = b;
        }
        resolve(out);
      }
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ type: 'separate', id, channels, forceWasm: !!opts.forceWasm, mode: opts.mode || 4 }, channels.map((c) => c.buffer));
  });
}

/** Butang pantas -> nilai gain setiap stem. */
export function quickMix(kind, names) {
  const g = {};
  for (const n of names) {
    if (kind === 'minus1') g[n] = n === 'vocals' ? 0 : 1;
    else if (kind === 'vokal') g[n] = n === 'vocals' ? 1 : 0;
    else g[n] = 1;
  }
  return g;
}
