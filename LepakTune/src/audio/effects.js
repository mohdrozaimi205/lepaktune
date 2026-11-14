// Gaya Santai: preset kesan bunyi. Semua dibina dengan nod Web Audio biasa,
// jadi sama untuk main langsung (AudioContext) dan simpan (OfflineAudioContext).

/**
 * rate: ubah laju + nada sekali (macam piring hitam diperlahankan).
 * Nilai lain dibaca oleh buildEffectChain.
 */
export const PRESETS = {
  slowed: { label: 'Slowed + Reverb', emoji: '🌙', rate: 0.85, reverb: { sec: 3.5, wet: 0.35 } },
  lofi: { label: 'Lofi', emoji: '☕', lowpass: 3500, bits: 12, vinylDb: -32 },
  '8d': { label: '8D', emoji: '🎧', autoPanHz: 0.12, reverb: { sec: 2, wet: 0.25 } },
  bass: { label: 'Bass Boost', emoji: '🔊', lowshelf: { hz: 150, db: 8 } },
  radio: { label: 'Radio Lama', emoji: '📻', band: [300, 3400], drive: 0.3, mono: true },
  bilik: { label: 'Akustik Bilik', emoji: '🪵', reverb: { sec: 0.8, wet: 0.2 }, highshelf: { hz: 8000, db: -3 } },
};

export const PRESET_IDS = Object.keys(PRESETS);

/** Kadar resample preset (1 jika tiada). */
export function presetRate(id) {
  return (id && PRESETS[id]?.rate) || 1;
}

/** IR reverb prosedur: hingar stereo yang pudar secara eksponen. Tetap (seed) supaya hasil boleh diulang. */
export function makeImpulse(ctx, seconds) {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const ir = ctx.createBuffer(2, len, rate);
  let seed = 1234567;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = rnd() * Math.pow(1 - i / len, 3);
  }
  return ir;
}

/** Lengkung waveshaper untuk bitcrush (kuantum ke `bits` bit). */
export function crushCurve(bits, n = 65536) {
  const steps = Math.pow(2, bits - 1);
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.round(x * steps) / steps;
  }
  return c;
}

/** Lengkung waveshaper tepu lembut. */
export function driveCurve(amount, n = 4096) {
  const k = amount * 10 + 1;
  const c = new Float32Array(n);
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(k * x) / norm;
  }
  return c;
}

function reverbSend(ctx, input, output, { sec, wet }) {
  const conv = ctx.createConvolver();
  conv.buffer = makeImpulse(ctx, sec);
  const wetGain = ctx.createGain();
  wetGain.gain.value = wet;
  const dry = ctx.createGain();
  dry.gain.value = 1 - wet * 0.5;
  input.connect(dry).connect(output);
  input.connect(conv).connect(wetGain).connect(output);
}

/**
 * Bina rantaian kesan. Pulangan {input, output, dispose}.
 * Sentiasa ada limiter di hujung supaya tiada bunyi pecah (klip).
 */
export function buildEffectChain(ctx, presetId) {
  const p = (presetId && PRESETS[presetId]) || {};
  const input = ctx.createGain();
  const output = ctx.createGain();
  const sources = [];
  let cur = input;
  const chain = (node) => { cur.connect(node); cur = node; return node; };

  if (p.mono) {
    const m = ctx.createGain();
    m.channelCount = 1;
    m.channelCountMode = 'explicit';
    m.channelInterpretation = 'speakers';
    chain(m);
  }
  if (p.drive) {
    const ws = ctx.createWaveShaper(); ws.curve = driveCurve(p.drive); ws.oversample = '2x';
    chain(ws);
    const g = ctx.createGain(); g.gain.value = 0.7; chain(g);
  }
  if (p.band) {
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = p.band[0]; hp.Q.value = 0.9;
    const hp2 = ctx.createBiquadFilter(); hp2.type = 'highpass'; hp2.frequency.value = p.band[0]; hp2.Q.value = 0.7;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = p.band[1]; lp.Q.value = 0.9;
    const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = p.band[1]; lp2.Q.value = 0.7;
    const lp3 = ctx.createBiquadFilter(); lp3.type = 'lowpass'; lp3.frequency.value = p.band[1]; lp3.Q.value = 0.7;
    const lp4 = ctx.createBiquadFilter(); lp4.type = 'lowpass'; lp4.frequency.value = p.band[1]; lp4.Q.value = 0.7;
    chain(hp); chain(hp2); chain(lp); chain(lp2); chain(lp3); chain(lp4);
  }
  if (p.lowpass) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = p.lowpass; lp.Q.value = 0.5;
    chain(lp);
  }
  if (p.bits) {
    const ws = ctx.createWaveShaper(); ws.curve = crushCurve(p.bits);
    chain(ws);
  }
  if (p.lowshelf) {
    const ls = ctx.createBiquadFilter(); ls.type = 'lowshelf'; ls.frequency.value = p.lowshelf.hz; ls.gain.value = p.lowshelf.db;
    chain(ls);
  }
  if (p.highshelf) {
    const hs = ctx.createBiquadFilter(); hs.type = 'highshelf'; hs.frequency.value = p.highshelf.hz; hs.gain.value = p.highshelf.db;
    chain(hs);
  }
  if (p.autoPanHz) {
    const pan = ctx.createStereoPanner();
    const lfo = ctx.createOscillator(); lfo.frequency.value = p.autoPanHz;
    const depth = ctx.createGain(); depth.gain.value = 1;
    lfo.connect(depth).connect(pan.pan);
    lfo.start();
    sources.push(lfo);
    chain(pan);
  }

  const preLimit = ctx.createGain();
  if (p.reverb) reverbSend(ctx, cur, preLimit, p.reverb);
  else cur.connect(preLimit);

  if (p.vinylDb) {
    const len = ctx.sampleRate * 2;
    const nb = ctx.createBuffer(2, len, ctx.sampleRate);
    let seed = 42;
    for (let c = 0; c < 2; c++) {
      const d = nb.getChannelData(c);
      for (let i = 0; i < len; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const r = seed / 0x7fffffff;
        d[i] = r > 0.9993 ? (r - 0.9993) * 1000 : (r * 2 - 1) * 0.15; // hingar + "krik" sekali-sekala
      }
    }
    const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 2500; nf.Q.value = 0.6;
    const ng = ctx.createGain(); ng.gain.value = Math.pow(10, p.vinylDb / 20);
    ns.connect(nf).connect(ng).connect(preLimit);
    ns.start();
    sources.push(ns);
  }

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -2;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.1;
  const ceiling = ctx.createGain();
  ceiling.gain.value = 0.95;
  preLimit.connect(limiter).connect(ceiling).connect(output);

  return {
    input,
    output,
    dispose() {
      for (const s of sources) { try { s.stop(); } catch { /* */ } }
      try { input.disconnect(); } catch { /* */ }
      try { output.disconnect(); } catch { /* */ }
    },
  };
}
