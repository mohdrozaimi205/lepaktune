import './ui/theme.css';
import { engine } from './audio/engine.js';
import { decodeFile, decodeContext, AudioDecodeError } from './audio/decode.js';
import { renderMix, renderTempo, settingsLabel } from './audio/render.js';
import { encode, FORMATS, safeFileName, availableFormats } from './audio/encode.js';
import { separate, quickMix } from './ai/separator.js';
import * as db from './store/db.js';
import { Queue } from './player/queue.js';
import { MediaControls } from './player/mediaSession.js';
import { shareSong, download, fileFor, titleFromFileName } from './share/share.js';
import { toast, confirmBox, fmtBytes } from './ui/dom.js';
import { initPlayer } from './ui/playerView.js';
import { initStudio } from './ui/studioView.js';
import { initLibrary } from './ui/libraryView.js';

export const MODE_LABEL = { asal: 'Asal', minus1: 'Minus One', vokal: 'Vokal Saja', pilih: 'Pilih Instrumen' };

/** Pengawal utama app. Views membaca `app` dan mendengar event 'change'. */
class App extends EventTarget {
  constructor() {
    super();
    this.songs = [];
    this.current = null; // meta lagu semasa
    this.mode = 'asal';
    this.mixBuffer = null;
    this.stemBuffers = null; // {songId, buffers}
    this.sep = null; // {songId, phase, pct, eta, backend}
    this.saving = false;
    this.queue = new Queue();
    this.media = null;
  }

  emit() { this.dispatchEvent(new Event('change')); }

  async refresh() {
    this.songs = await db.listSongs();
    if (this.current) this.current = this.songs.find((s) => s.id === this.current.id) || null;
    const ids = this.songs.map((s) => s.id);
    if (ids.join() !== [...this.queue.list].sort((a, b) => ids.indexOf(a) - ids.indexOf(b)).join() || ids.length !== this.queue.list.length) {
      this.queue.setList(ids, this.current?.id ?? ids[0]);
    }
    const est = await db.storageEstimate();
    const st = document.getElementById('storageStat');
    if (st) st.textContent = est ? `💾 ${fmtBytes(est.usage)}` : '';
    this.emit();
  }

  // ---------- Masukkan lagu ----------
  async addFiles(files) {
    let ok = 0;
    let lastId = null;
    for (const f of files) {
      try {
        const buf = await decodeFile(f, decodeContext());
        lastId = await db.addSong({ title: titleFromFileName(f.name), blob: f, durationSec: buf.duration });
        ok++;
      } catch (e) {
        if (e instanceof db.StorageFullError) { toast(e.message, { bad: true }); break; }
        toast(e instanceof AudioDecodeError ? `${f.name}: ${e.message}` : `Gagal tambah ${f.name}`, { bad: true });
      }
    }
    await this.refresh();
    if (ok) toast(ok === 1 ? '🎵 Lagu ditambah' : `🎵 ${ok} lagu ditambah`);
    if (lastId && !this.current) await this.loadSong(lastId, { autoplay: false });
    return ok;
  }

  async drainInbox() {
    const items = await db.drainInbox();
    if (items.length) await this.addFiles(items.map((i) => (i.blob instanceof File ? i.blob : new File([i.blob], i.name, { type: i.blob.type }))));
  }

  // ---------- Main lagu ----------
  async loadSong(id, { autoplay = true, mode } = {}) {
    const song = await db.getSong(id);
    if (!song) return;
    const { blob, ...meta } = song;
    this.current = { ...meta, size: blob.size };
    this.mixBuffer = await decodeFile(blob, decodeContext());
    if (this.stemBuffers?.songId !== id) this.stemBuffers = null;
    let m = mode || this.mode;
    if (m !== 'asal' && !meta.hasStems4) m = 'asal';
    this.mode = 'asal';
    await engine.load({ mix: this.mixBuffer }, { gains: { mix: 1 } });
    if (m !== 'asal') await this.setMode(m, { keepPosition: false });
    this.queue.jumpTo(id);
    this.media?.setMeta({ title: meta.title, subtitle: MODE_LABEL[this.mode] });
    db.setSetting('lastSong', id);
    if (autoplay) await this.play();
    this.emit();
  }

  async play() {
    if (!this.current) {
      if (this.songs[0]) return this.loadSong(this.songs[0].id);
      return;
    }
    await engine.play();
    this.media?.setPlaying(true);
  }

  pause() {
    engine.pause();
    this.media?.setPlaying(false);
  }

  async toggle() {
    if (engine.playing) this.pause();
    else await this.play();
  }

  async next() {
    const id = this.queue.next(true);
    if (id != null) await this.loadSong(id);
  }

  async prev() {
    if (engine.position > 4) return engine.seek(0);
    const id = this.queue.prev();
    if (id != null) await this.loadSong(id);
  }

  async onEnded() {
    const id = this.queue.onTrackEnded();
    if (id == null) { this.media?.setPlaying(false); this.emit(); return; }
    if (id === this.current?.id) { await engine.seek(0); await engine.play(); }
    else await this.loadSong(id);
  }

  // ---------- Stem ----------
  async getStemBuffers() {
    const id = this.current.id;
    if (this.stemBuffers?.songId === id) return this.stemBuffers.buffers;
    const blobs = await db.getStems(id, 4);
    if (!blobs) return null;
    const buffers = {};
    for (const [k, b] of Object.entries(blobs)) buffers[k] = await decodeFile(b, decodeContext());
    // panjang mesti sama untuk semua stem
    const len = Math.min(...Object.values(buffers).map((b) => b.length));
    for (const [k, b] of Object.entries(buffers)) {
      if (b.length !== len) {
        const nb = new AudioBuffer({ length: len, numberOfChannels: 2, sampleRate: 44100 });
        for (let c = 0; c < 2; c++) nb.copyToChannel(b.getChannelData(Math.min(c, b.numberOfChannels - 1)).subarray(0, len), c);
        buffers[k] = nb;
      }
    }
    this.stemBuffers = { songId: id, buffers };
    return buffers;
  }

  async setMode(mode, { keepPosition = true } = {}) {
    if (!this.current) return;
    if (mode === 'asal') {
      this.mode = 'asal';
      await engine.load({ mix: this.mixBuffer }, { keepPosition, gains: { mix: 1 } });
    } else {
      const buffers = await this.getStemBuffers();
      if (!buffers) { this.mode = mode; this.emit(); return false; }
      const names = Object.keys(buffers);
      const gains = mode === 'pilih' ? (this.pickGains || quickMix('semua', names)) : quickMix(mode, names);
      this.mode = mode;
      await engine.load(buffers, { keepPosition, gains });
    }
    this.media?.setMeta({ title: this.current.title, subtitle: MODE_LABEL[this.mode] });
    this.emit();
    return true;
  }

  setStemGain(name, v) {
    engine.setGain(name, v);
    if (this.mode === 'pilih') this.pickGains = { ...engine.state.gains };
    this.emit();
  }

  async runSeparation() {
    if (!this.current || this.sep) return;
    const songId = this.current.id;
    this.sep = { songId, phase: 'mula', pct: 0, eta: null, backend: null };
    this.emit();
    try {
      const stems = await separate(this.mixBuffer, {
        mode: 4,
        onProgress: (p) => { this.sep = { ...this.sep, phase: p.phase, pct: p.pct, eta: p.eta ?? null }; this.emit(); },
        onBackend: (name) => { this.sep = { ...this.sep, backend: name }; this.emit(); },
      });
      this.sep = { ...this.sep, phase: 'simpan', pct: 0 };
      this.emit();
      const blobs = {};
      const names = Object.keys(stems);
      for (let i = 0; i < names.length; i++) {
        blobs[names[i]] = await encode(stems[names[i]], 'mp3', { bitrate: 192e3 });
        this.sep = { ...this.sep, pct: (i + 1) / names.length };
        this.emit();
      }
      await db.putStems(songId, 4, blobs);
      if (this.current?.id === songId) this.stemBuffers = { songId, buffers: stems };
      this.sep = null;
      await this.refresh();
      toast('✨ Siap! Vokal dan instrumen sudah diasingkan');
      if (this.current?.id === songId && this.mode !== 'asal') await this.setMode(this.mode);
      else if (this.current?.id === songId) await this.setMode('minus1');
    } catch (e) {
      this.sep = null;
      this.emit();
      toast(e instanceof db.StorageFullError ? e.message : `AI gagal: ${e.message}`, { bad: true, ms: 7000 });
    }
  }

  // ---------- Simpan ----------
  async saveCurrent(format) {
    if (!this.current || this.saving) return;
    this.saving = true;
    this.emit();
    try {
      const buffers = engine.buffers;
      const state = { ...engine.state, gains: { ...engine.state.gains } };
      const rendered = await renderMix(buffers, state);
      const blob = await encode(rendered, format);
      const label = settingsLabel(state, MODE_LABEL[this.mode]);
      const title = safeFileName(`${this.current.title} (${label})`);
      const id = await db.addSong({ title, blob, durationSec: rendered.duration, parentId: this.current.id, label });
      await this.refresh();
      const song = { title, blob };
      toast(`💾 Disimpan: ${title}.${FORMATS[format].ext}`, {
        acts: [
          { label: 'Kongsi', onClick: () => shareSong(song) },
          { label: 'Muat turun', onClick: () => download(fileFor(song)) },
        ],
      });
      return id;
    } catch (e) {
      toast(e instanceof db.StorageFullError ? e.message : `Gagal simpan: ${e.message}`, { bad: true, ms: 7000 });
    } finally {
      this.saving = false;
      this.emit();
    }
  }

  async share(id) {
    const s = await db.getSong(id);
    if (!s) return;
    const r = await shareSong(s);
    if (r === 'downloaded') toast('⬇️ Fail dimuat turun');
  }

  async remove(id) {
    const s = this.songs.find((x) => x.id === id);
    if (!(await confirmBox('Padam lagu?', `"${s?.title}" dan hasil AI-nya akan dipadam dari LepakTune.`, { yes: 'Padam', danger: true }))) return;
    if (this.current?.id === id) {
      engine.pause();
      this.media?.setPlaying(false);
      this.current = null;
      this.mixBuffer = null;
      this.stemBuffers = null;
    }
    this.queue.remove(id);
    await db.deleteSong(id);
    await this.refresh();
  }
}

export const app = new App();
window.__lepak = { app, engine, db, renderMix, renderTempo, encode, availableFormats, separate, decodeFile, decodeContext }; // untuk ujian

// ---------- Navigasi tab ----------
function showTab(name) {
  document.querySelectorAll('[data-view]').forEach((v) => v.classList.toggle('active', v.id === name));
  document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
}
function route() {
  const [name, q] = (location.hash.slice(1) || 'pemain').split('?');
  showTab(['pemain', 'studio', 'perpustakaan'].includes(name) ? name : 'pemain');
  if (q && /baru=/.test(q)) app.drainInbox();
  if (q && /ralat=kongsi/.test(q)) toast('Lagu yang dikongsi tak dapat diterima', { bad: true });
}

async function boot() {
  app.media = new MediaControls();
  app.media.bind({
    play: () => app.play(),
    pause: () => app.pause(),
    next: () => app.next(),
    prev: () => app.prev(),
    seek: (t) => engine.seek(t),
    seekBy: (d) => engine.seek(engine.position + d),
  });
  engine.addEventListener('ended', () => app.onEnded());
  engine.addEventListener('state', () => app.emit());
  app.queue.addEventListener('sleep', () => { app.pause(); toast('😴 Pemasa tidur: lagu dihentikan'); app.emit(); });

  initPlayer(document.getElementById('pemain'), app);
  initStudio(document.getElementById('studio'), app);
  initLibrary(document.getElementById('perpustakaan'), app);

  document.getElementById('tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) location.hash = b.dataset.tab;
  });
  window.addEventListener('hashchange', route);

  // seret & lepas fail ke mana-mana
  let dragN = 0;
  window.addEventListener('dragenter', (e) => { e.preventDefault(); dragN++; document.body.classList.add('dragging'); });
  window.addEventListener('dragleave', () => { if (--dragN <= 0) { dragN = 0; document.body.classList.remove('dragging'); } });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragN = 0;
    document.body.classList.remove('dragging');
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) app.addFiles(files);
  });

  // buka fail terus dari pengurus fail (laptop)
  if ('launchQueue' in window) {
    window.launchQueue.setConsumer(async (params) => {
      const files = await Promise.all((params.files || []).map((h) => h.getFile()));
      if (files.length) app.addFiles(files);
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !/INPUT|SELECT|BUTTON|TEXTAREA/.test(document.activeElement?.tagName)) { e.preventDefault(); app.toggle(); }
  });

  setInterval(() => {
    if (engine.playing) app.media.setPosition(engine.position, engine.duration, engine.state.tempo);
  }, 2000);

  await app.refresh();
  route();
  await app.drainInbox();
  const lastId = await db.getSetting('lastSong', null);
  if (lastId && app.songs.some((s) => s.id === lastId)) await app.loadSong(lastId, { autoplay: false });

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    // Muat semula sekali supaya header COOP/COEP dari service worker berkuat kuasa (AI guna banyak teras CPU).
    const reloadForIsolation = () => {
      if (self.crossOriginIsolated || engine.playing || app.sep || sessionStorage.getItem('lepak-coi')) return;
      sessionStorage.setItem('lepak-coi', '1');
      location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', reloadForIsolation);
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL, type: 'module' })
      .then(() => { if (navigator.serviceWorker.controller) reloadForIsolation(); })
      .catch(() => {});
  }
}

boot();
