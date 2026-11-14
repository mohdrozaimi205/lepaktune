// Graf bunyi yang dikongsi oleh main langsung dan render offline:
// [sumber setiap stem] -> [gain stem] -> [SoundTouch tempo/key] -> [Gaya Santai] -> output
import { SoundTouchNode } from '@soundtouchjs/audio-worklet';
import { buildEffectChain, presetRate } from './effects.js';

export const PROCESSOR_URL = `${import.meta.env?.BASE_URL ?? '/'}soundtouch-processor.js`;

const registered = new WeakSet();
export async function ensureWorklet(ctx) {
  if (registered.has(ctx)) return;
  await SoundTouchNode.register(ctx, PROCESSOR_URL);
  registered.add(ctx);
}

/** Kadar sebenar sumber dimainkan (tempo x kadar preset). */
export function effectiveRate(state) {
  return (state.tempo || 1) * presetRate(state.preset);
}

export function isNeutral(state) {
  return (state.tempo || 1) === 1 && !state.semitones && presetRate(state.preset) === 1;
}

/**
 * @param {BaseAudioContext} ctx  (worklet mesti sudah didaftar)
 * @param {Record<string, AudioBuffer>} buffers
 * @param {{gains: Record<string, number>, tempo: number, semitones: number, preset: string|null}} state
 * @param {{useStretch?: boolean}} opts
 */
export function createGraph(ctx, buffers, state, opts = {}) {
  const useStretch = opts.useStretch ?? true;
  const gains = {};
  const bus = ctx.createGain();
  for (const [name] of Object.entries(buffers)) {
    const g = ctx.createGain();
    g.gain.value = state.gains?.[name] ?? 1;
    g.connect(bus);
    gains[name] = g;
  }

  let st = null;
  if (useStretch) {
    st = new SoundTouchNode({ context: ctx });
    bus.connect(st);
  }
  const out = ctx.createGain();
  let fx = buildEffectChain(ctx, state.preset);
  (st || bus).connect(fx.input);
  fx.output.connect(out);

  let sources = [];
  let cur = { ...state };

  function applyRates() {
    const rate = effectiveRate(cur);
    for (const s of sources) s.playbackRate.value = rate;
    if (st) {
      st.playbackRate.value = cur.tempo || 1; // tebus perubahan tempo sahaja; kadar preset kekal ubah nada
      st.pitchSemitones.value = cur.semitones || 0;
    }
  }

  return {
    output: out,
    get state() { return cur; },
    /** Mula main pada masa ctx `when`, dari kedudukan lagu `offsetSec`. Pulangan sumber pertama. */
    start(when, offsetSec) {
      sources = Object.entries(buffers).map(([name, buf]) => {
        const s = ctx.createBufferSource();
        s.buffer = buf;
        s.connect(gains[name]);
        return s;
      });
      applyRates();
      for (const s of sources) s.start(when, Math.max(0, offsetSec));
      return sources[0];
    },
    stop() {
      for (const s of sources) { s.onended = null; try { s.stop(); } catch { /* */ } try { s.disconnect(); } catch { /* */ } }
      sources = [];
    },
    setGain(name, v) {
      cur.gains = { ...cur.gains, [name]: v };
      if (gains[name]) gains[name].gain.setTargetAtTime(v, ctx.currentTime, 0.02);
    },
    setTempoKey({ tempo, semitones }) {
      if (tempo !== undefined) cur.tempo = tempo;
      if (semitones !== undefined) cur.semitones = semitones;
      applyRates();
    },
    setPreset(preset) {
      cur.preset = preset;
      const old = fx;
      fx = buildEffectChain(ctx, preset);
      (st || bus).disconnect();
      (st || bus).connect(fx.input);
      fx.output.connect(out);
      old.dispose();
      applyRates();
    },
    dispose() {
      this.stop();
      fx.dispose();
      try { st?.disconnect(); } catch { /* */ }
      try { out.disconnect(); } catch { /* */ }
    },
  };
}
