// Render offline mengikut tetapan semasa (stem, tempo, key, Gaya Santai).
import { createGraph, ensureWorklet, effectiveRate, isNeutral } from './graph.js';
import { PRESETS } from './effects.js';

const SR = 44100;

/**
 * @param {Record<string, AudioBuffer>} buffers
 * @param {{gains, tempo, semitones, preset}} state
 * @returns {Promise<AudioBuffer>}
 */
export async function renderMix(buffers, state) {
  const first = Object.values(buffers)[0];
  const rate = effectiveRate(state);
  const tail = PRESETS[state.preset]?.reverb?.sec ?? 0;
  const length = Math.ceil((first.duration / rate + tail) * SR);
  const ctx = new OfflineAudioContext(2, length, SR);
  const useStretch = !isNeutral(state);
  if (useStretch) await ensureWorklet(ctx);
  const g = createGraph(ctx, buffers, state, { useStretch });
  g.output.connect(ctx.destination);
  g.start(0, 0);
  return ctx.startRendering();
}

/** Ubah tempo/key sahaja (untuk ujian dan kegunaan ringkas). */
export function renderTempo(buffer, { tempo = 1, semitones = 0 }) {
  return renderMix({ mix: buffer }, { gains: { mix: 1 }, tempo, semitones, preset: null });
}

/** Label pendek untuk nama fail hasil. */
export function settingsLabel(state, modeLabel) {
  const parts = [];
  if (modeLabel && modeLabel !== 'Asal') parts.push(modeLabel);
  if (state.preset) parts.push(PRESETS[state.preset].label);
  if ((state.tempo || 1) !== 1) parts.push(`${state.tempo.toFixed(2)}x`);
  if (state.semitones) parts.push(`Key ${state.semitones > 0 ? '+' : ''}${state.semitones}`);
  return parts.join(', ') || 'Salinan';
}
