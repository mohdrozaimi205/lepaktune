// Enjin main langsung. Satu AudioContext untuk seluruh app.
import { createGraph, ensureWorklet, effectiveRate } from './graph.js';

export class Engine extends EventTarget {
  constructor() {
    super();
    this.ctx = null;
    this.graph = null;
    this.buffers = null;
    this.duration = 0;
    this.playing = false;
    this._offset = 0; // kedudukan lagu (saat) bila mula
    this._startedAt = 0; // ctx.currentTime bila mula
    this.state = { gains: {}, tempo: 1, semitones: 0, preset: null };
  }

  async init() {
    if (this.ctx) return;
    this.ctx = new AudioContext({ sampleRate: 44100, latencyHint: 'playback' });
    this.master = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.master.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    await ensureWorklet(this.ctx);
  }

  get position() {
    if (!this.playing) return this._offset;
    const p = this._offset + (this.ctx.currentTime - this._startedAt) * effectiveRate(this.state);
    return Math.min(p, this.duration);
  }

  /** Muat sumber baru. Kunci 'mix' untuk lagu penuh, atau nama stem. Kekalkan tetapan tempo/key/gaya. */
  async load(buffers, { keepPosition = false, gains } = {}) {
    await this.init();
    const pos = keepPosition ? this.position : 0;
    const wasPlaying = this.playing;
    this._teardown();
    this.buffers = buffers;
    this.duration = Object.values(buffers)[0].duration;
    const g = {};
    for (const k of Object.keys(buffers)) g[k] = gains?.[k] ?? this.state.gains[k] ?? 1;
    this.state = { ...this.state, gains: g };
    this.graph = createGraph(this.ctx, buffers, this.state);
    this.graph.output.connect(this.master);
    this._offset = Math.min(pos, this.duration);
    if (wasPlaying && keepPosition) await this.play();
    this._emit('state');
  }

  _teardown() {
    if (this.graph) {
      this.graph.dispose();
      this.graph = null;
    }
    this.playing = false;
  }

  async play() {
    if (!this.graph) return;
    await this.init();
    if (this.ctx.state !== 'running') await this.ctx.resume();
    if (this.playing) return;
    if (this._offset >= this.duration - 0.05) this._offset = 0;
    const first = this.graph.start(this.ctx.currentTime + 0.02, this._offset);
    this._startedAt = this.ctx.currentTime + 0.02;
    this.playing = true;
    first.onended = () => {
      if (!this.playing) return;
      this.playing = false;
      this._offset = this.duration;
      this._emit('state');
      this._emit('ended');
    };
    this._emit('state');
  }

  pause() {
    if (!this.playing) return;
    this._offset = this.position;
    this.playing = false;
    this.graph.stop();
    this._emit('state');
  }

  async toggle() {
    if (this.playing) this.pause();
    else await this.play();
  }

  async seek(sec) {
    const was = this.playing;
    if (was) { this.playing = false; this.graph.stop(); }
    this._offset = Math.max(0, Math.min(sec, this.duration));
    if (was) await this.play();
    else this._emit('state');
  }

  /** Simpan kedudukan, kemudian guna fn untuk ubah kadar. */
  _rebase(fn) {
    const pos = this.position;
    fn();
    this._offset = pos;
    this._startedAt = this.ctx ? this.ctx.currentTime : 0;
  }

  setGain(stem, v) {
    this.state.gains = { ...this.state.gains, [stem]: v };
    this.graph?.setGain(stem, v);
    this._emit('state');
  }

  setGains(gains) {
    for (const [k, v] of Object.entries(gains)) this.setGain(k, v);
  }

  setTempoKey({ tempo, semitones }) {
    this._rebase(() => {
      if (tempo !== undefined) this.state.tempo = tempo;
      if (semitones !== undefined) this.state.semitones = semitones;
      this.graph?.setTempoKey({ tempo, semitones });
    });
    this._emit('state');
  }

  setPreset(preset) {
    this._rebase(() => {
      this.state.preset = preset;
      this.graph?.setPreset(preset);
    });
    this._emit('state');
  }

  resetSettings() {
    this.setTempoKey({ tempo: 1, semitones: 0 });
    this.setPreset(null);
  }

  _emit(name) {
    this.dispatchEvent(new Event(name));
  }
}

export const engine = new Engine();
