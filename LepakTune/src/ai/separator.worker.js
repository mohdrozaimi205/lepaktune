// Web Worker: muat turun model Demucs (htdemucs 4 bahagian) dan asingkan stem.
// Algoritma STFT/chunking diambil dari demucs-js (MIT, Kevin Gibbons) dalam ./vendor.
import * as ort from 'onnxruntime-web/webgpu';
import { separateTracks } from './vendor/apply.js';
import { ensureModel } from './modelStore.js';

// Muat enjin wasm dari fail luar (bukan terbenam) supaya thread tambahan boleh dimulakan dengan betul.
const ORT_BASE = new URL(`${import.meta.env.BASE_URL}ort/`, self.location.origin).href;
ort.env.wasm.wasmPaths = { mjs: `${ORT_BASE}ort-wasm-simd-threaded.asyncify.mjs`, wasm: `${ORT_BASE}ort-wasm-simd-threaded.asyncify.wasm` };
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;

class OrtHTDemucs {
  sources = ['drums', 'bass', 'other', 'vocals'];
  audioChannels = 2;
  samplerate = 44100;
  segment = 7.8;

  static async init(weights, providers) {
    const m = new OrtHTDemucs();
    m.session = await ort.InferenceSession.create(weights, { executionProviders: providers, graphOptimizationLevel: 'all' });
    m.inputNames = m.session.inputNames;
    m.outputNames = m.session.outputNames;
    return m;
  }

  validLength(length) {
    const t = Math.floor(this.segment * this.samplerate);
    if (t < length) throw new Error(`Panjang ${length} melebihi ${t}`);
    return t;
  }

  async forward(mix, magspec) {
    const feeds = {
      [this.inputNames[0]]: new ort.Tensor('float32', mix.data, mix.shape),
      [this.inputNames[1]]: new ort.Tensor('float32', magspec.data, magspec.shape),
    };
    const r = await this.session.run(feeds);
    const x = r[this.outputNames[0]];
    const xt = r[this.outputNames[1]];
    const out = {
      outX: { data: x.data, shape: x.dims },
      outXt: { data: xt.data, shape: xt.dims },
    };
    return out;
  }
}

let model = null;
let modelBackend = null;

async function hasWebGPU() {
  try { return !!(self.navigator.gpu && (await self.navigator.gpu.requestAdapter())); } catch { return false; }
}

async function getModel(forceWasm, post) {
  const wantGpu = !forceWasm && (await hasWebGPU());
  const backend = wantGpu ? 'webgpu' : 'wasm';
  if (model && modelBackend === backend) return model;
  const weights = await ensureModel(4, (pct) => post({ type: 'progress', phase: 'download', pct }));
  post({ type: 'progress', phase: 'load', pct: 0 });
  try {
    model = await OrtHTDemucs.init(weights, wantGpu ? ['webgpu', 'wasm'] : ['wasm']);
    modelBackend = backend;
  } catch (e) {
    if (!wantGpu) throw e;
    model = await OrtHTDemucs.init(weights, ['wasm']);
    modelBackend = 'wasm';
  }
  post({ type: 'backend', name: modelBackend, threads: ort.env.wasm.numThreads });
  return model;
}

self.onmessage = async (ev) => {
  const msg = ev.data;
  const post = (m, t) => self.postMessage({ ...m, id: msg.id }, t || []);
  if (msg.type !== 'separate') return;
  try {
    const m = await getModel(!!msg.forceWasm, post);
    const t0 = performance.now();
    const tracks = await separateTracks(
      m,
      { channelData: msg.channels, sampleRate: 44100 },
      (step, total) => {
        const pct = total ? step / total : 0;
        const el = (performance.now() - t0) / 1000;
        const eta = step > 0 ? (el / step) * (total - step) : null;
        post({ type: 'progress', phase: 'infer', pct, eta });
      },
      0.25,
    );
    const stems = {};
    const transfer = [];
    for (const [name, t] of Object.entries(tracks)) {
      const chans = t.channelData.map((c) => new Float32Array(c)); // salin keluar dari buffer kongsi
      stems[name] = chans;
      transfer.push(...chans.map((c) => c.buffer));
    }
    post({ type: 'done', stems, backend: modelBackend, seconds: (performance.now() - t0) / 1000 }, transfer);
  } catch (e) {
    post({ type: 'error', message: String(e?.message || e) });
  }
};
