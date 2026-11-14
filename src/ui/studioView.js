// Skrin Studio: mod stem, AI asingkan, tempo/key, Gaya Santai, Simpan, Suno.
import { h, toast, infoBox, confirmBox } from './dom.js';
import { engine } from '../audio/engine.js';
import { PRESETS, PRESET_IDS } from '../audio/effects.js';
import { FORMATS, availableFormats } from '../audio/encode.js';
import { STEM_LABELS, STEM_ORDER } from '../ai/separator.js';
import { MODELS, hasModel } from '../ai/modelStore.js';
import { getSetting, setSetting } from '../store/db.js';

const MODES = [['asal', 'Asal'], ['minus1', 'Minus One'], ['vokal', 'Vokal Saja'], ['pilih', 'Pilih Instrumen']];

function fmtEta(sec) {
  if (sec == null || !isFinite(sec)) return 'mengira masa…';
  if (sec < 60) return `±${Math.ceil(sec)} saat lagi`;
  return `±${Math.ceil(sec / 60)} minit lagi`;
}

export function initStudio(root, app) {
  // ---- Mod stem ----
  const seg = h('div', { class: 'seg', role: 'tablist' }, MODES.map(([id, label]) =>
    h('button', { 'data-mode': id, onClick: () => onMode(id) }, label)));

  async function onMode(id) {
    if (!app.current) return toast('Pilih lagu dulu di Perpustakaan');
    if (id !== 'asal' && !app.current.hasStems4) {
      app.mode = id; // tunjuk kad AI
      app.emit();
      return;
    }
    await app.setMode(id);
  }

  // ---- Kad AI ----
  const aiBtn = h('button', { class: 'btn hot wide', onClick: () => startAi() }, '✨ Asingkan dengan AI');
  const aiInfo = h('p', { class: 'small muted' });
  const bar = h('i');
  const prog = h('div', { class: 'progress hidden' }, bar);
  const progText = h('div', { class: 'small muted hidden' });
  const aiCard = h('div', { class: 'panel hidden' },
    h('h3', {}, '🤖 AI Asingkan Lagu'),
    h('p', { class: 'small' }, 'AI akan pisahkan lagu ini kepada Vokal, Dram, Bass dan Lain-lain. Cuma perlu buat sekali untuk setiap lagu.'),
    aiInfo, aiBtn, prog, progText,
  );

  async function startAi() {
    if (!(await hasModel(4))) {
      const ok = await confirmBox('Muat turun enjin AI?', `Kali pertama sahaja: ±${Math.round(MODELS[4].bytes / 1e6)} MB. Selepas itu AI boleh guna tanpa internet. Guna WiFi ya.`, { yes: 'Muat turun' });
      if (!ok) return;
    }
    app.runSeparation();
  }

  // ---- Stem ----
  const stemGrid = h('div', { class: 'stems' });
  const fullSw = h('button', { class: 'sw', 'aria-label': 'Mod Penuh 6 bahagian', onClick: () => onFull() });
  const stemCard = h('div', { class: 'panel hidden' },
    h('h3', {}, '🎚️ Instrumen', h('span', { class: 'r' }, 'hidup/matikan & kuatkan')),
    stemGrid,
    h('div', { class: 'toggle-row small' }, fullSw, h('span', {}, 'Mod Penuh (6): asingkan Gitar & Piano'), h('span', { class: 'tag' }, 'AKAN DATANG')),
  );
  function onFull() {
    if (!MODELS[6].available) {
      toast('🪕 Mod Penuh (Gitar + Piano) akan datang dalam kemas kini seterusnya');
    }
  }
  let stemKeys = '';
  function buildStems(names) {
    stemGrid.replaceChildren(...STEM_ORDER.filter((n) => names.includes(n)).map((n) => {
      const sw = h('button', { class: 'sw', 'data-stem-sw': n, 'aria-label': STEM_LABELS[n].label });
      const vol = h('input', { type: 'range', min: 0, max: 150, value: 100, 'data-stem-vol': n, 'aria-label': `Kekuatan ${STEM_LABELS[n].label}` });
      sw.addEventListener('click', () => {
        const on = (engine.state.gains[n] ?? 1) > 0;
        if (app.mode !== 'pilih') app.mode = 'pilih';
        app.setStemGain(n, on ? 0 : Math.max(0.05, vol.value / 100));
      });
      vol.addEventListener('input', () => {
        if (app.mode !== 'pilih') app.mode = 'pilih';
        app.setStemGain(n, vol.value / 100);
      });
      return h('div', { class: 'stem', 'data-stem': n },
        h('div', { class: 'top' }, h('span', {}, STEM_LABELS[n].emoji), h('span', {}, STEM_LABELS[n].label), sw),
        vol,
      );
    }));
  }

  // ---- Tempo / Key ----
  const tempo = h('input', { type: 'range', min: 0.5, max: 1.5, step: 0.05, value: 1, id: 'tempo', 'aria-label': 'Tempo' });
  const tempoOut = h('output', {}, '1.00x');
  const key = h('input', { type: 'range', min: -6, max: 6, step: 1, value: 0, id: 'key', 'aria-label': 'Key' });
  const keyOut = h('output', {}, '0');
  tempo.addEventListener('input', () => engine.setTempoKey({ tempo: +tempo.value }));
  key.addEventListener('input', () => engine.setTempoKey({ semitones: +key.value }));
  const resetBtn = h('button', { class: 'btn ghost', onClick: () => { engine.resetSettings(); } }, '↺ Set semula');

  // ---- Gaya Santai ----
  const styles = h('div', { class: 'styles' }, PRESET_IDS.map((id) =>
    h('button', { class: 'style', 'data-preset': id, onClick: () => engine.setPreset(engine.state.preset === id ? null : id) },
      h('span', { class: 'e' }, PRESETS[id].emoji), PRESETS[id].label)));

  // ---- Simpan ----
  const fmt = h('select', { class: 'fmt', 'aria-label': 'Format' });
  const saveBtn = h('button', { class: 'btn hot grow', id: 'saveBtn', onClick: async () => { await setSetting('format', fmt.value); app.saveCurrent(fmt.value); } }, '💾 Simpan');
  availableFormats().then(async (ids) => {
    const def = await getSetting('format', 'mp3');
    fmt.replaceChildren(...ids.map((id) => h('option', { value: id, selected: id === def }, FORMATS[id].label)));
  });

  const sunoBtn = h('button', { class: 'btn wide', onClick: () => openSuno() }, '🎸 AI-kan di Suno (rock, balada, punk, bahasa lain)');

  root.append(
    h('div', { class: 'panel' },
      h('h3', {}, '🎛️ Studio', h('span', { class: 'r', id: 'studioSong' }, '')),
      seg,
      h('p', { class: 'small muted', id: 'modeHint', style: 'margin:10px 2px 0' }),
    ),
    aiCard,
    stemCard,
    h('div', { class: 'panel' },
      h('h3', {}, '⏱️ Tempo & Key', h('span', { class: 'r' }, 'suara kekal asli')),
      h('div', { class: 'fader' }, h('label', { for: 'tempo' }, 'Tempo'), tempo, tempoOut),
      h('div', { class: 'fader' }, h('label', { for: 'key' }, 'Key'), key, keyOut),
      h('div', { class: 'row' }, resetBtn),
    ),
    h('div', { class: 'panel' },
      h('h3', {}, '🌙 Gaya Santai', h('span', { class: 'r' }, 'tekan sekali lagi untuk tutup')),
      styles,
    ),
    h('div', { class: 'panel' },
      h('h3', {}, '💾 Simpan Hasil'),
      h('p', { class: 'small muted', style: 'margin-top:0' }, 'Semua tetapan di atas akan disimpan sebagai lagu baru dalam Perpustakaan.'),
      h('div', { class: 'row' }, fmt, saveBtn),
    ),
    h('div', { class: 'panel' },
      h('h3', {}, '🎸 Tukar Genre / Bahasa'),
      sunoBtn,
    ),
  );

  function render() {
    const cur = app.current;
    document.getElementById('studioSong').textContent = cur ? cur.title : 'tiada lagu';
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.mode === app.mode));
    const needAi = !!cur && app.mode !== 'asal' && !cur.hasStems4;
    const running = !!app.sep && app.sep.songId === cur?.id;
    aiCard.classList.toggle('hidden', !(needAi || running));
    aiBtn.classList.toggle('hidden', running);
    aiBtn.disabled = !!app.sep;
    prog.classList.toggle('hidden', !running);
    progText.classList.toggle('hidden', !running);
    if (running) {
      const s = app.sep;
      bar.style.width = `${Math.round((s.pct || 0) * 100)}%`;
      const phase = { mula: 'Bersedia…', download: `Muat turun enjin AI… ${Math.round(s.pct * 100)}%`, load: 'Memuatkan enjin AI…', infer: `Mengasingkan… ${Math.round(s.pct * 100)}% (${fmtEta(s.eta)})`, simpan: `Menyimpan stem… ${Math.round(s.pct * 100)}%` }[s.phase] || '';
      progText.textContent = `${phase}${s.backend ? ` • ${s.backend === 'webgpu' ? '⚡ GPU' : '🐢 CPU'}` : ''}`;
    }
    aiInfo.textContent = app.sep && !running ? 'AI sedang sibuk dengan lagu lain…' : 'Di telefon: ±3–8 minit. Di laptop: lebih laju. Biarkan app terbuka.';

    const names = engine.buffers ? Object.keys(engine.buffers) : [];
    const isStems = names.length > 1;
    stemCard.classList.toggle('hidden', !isStems);
    if (isStems && names.join() !== stemKeys) { stemKeys = names.join(); buildStems(names); }
    if (isStems) {
      for (const n of names) {
        const g = engine.state.gains[n] ?? 1;
        stemGrid.querySelector(`[data-stem="${n}"]`)?.classList.toggle('off', g === 0);
        stemGrid.querySelector(`[data-stem-sw="${n}"]`)?.classList.toggle('on', g > 0);
        const vol = stemGrid.querySelector(`[data-stem-vol="${n}"]`);
        if (vol && document.activeElement !== vol && g > 0) vol.value = String(Math.round(g * 100));
      }
    }
    fullSw.classList.toggle('on', false);

    const hint = {
      asal: 'Lagu penuh macam asal.',
      minus1: 'Muzik sahaja, tanpa suara penyanyi. Sesuai untuk karaoke.',
      vokal: 'Suara penyanyi sahaja.',
      pilih: 'Pilih instrumen mana yang nak didengar.',
    }[app.mode];
    document.getElementById('modeHint').textContent = cur ? hint : 'Pilih lagu di Perpustakaan untuk mula.';

    const st = engine.state;
    if (document.activeElement !== tempo) tempo.value = String(st.tempo);
    if (document.activeElement !== key) key.value = String(st.semitones);
    tempoOut.textContent = `${(+st.tempo).toFixed(2)}x`;
    keyOut.textContent = st.semitones > 0 ? `+${st.semitones}` : String(st.semitones);
    styles.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('on', b.dataset.preset === st.preset));
    saveBtn.disabled = !cur || app.saving;
    saveBtn.textContent = app.saving ? '⏳ Menyimpan…' : '💾 Simpan';
  }

  app.addEventListener('change', render);
  render();
}

function openSuno() {
  infoBox('🎸 AI-kan lagu di Suno',
    h('div', {},
      h('p', { class: 'small muted' }, 'Suno boleh cipta semula lagu awak dalam gaya lain (rock, balada, punk, sedih) atau bahasa lain. Pelan percuma ada had harian.'),
      h('ol', {},
        h('li', {}, 'Di Suno, tekan ', h('b', {}, 'Create → Upload Audio'), ', pilih lagu awak (boleh guna hasil Minus One atau Vokal Saja dari LepakTune).'),
        h('li', {}, 'Pilih ', h('b', {}, 'Cover'), ', tulis gaya yang awak mahu (contoh: "rock 80an", "balada akustik sedih", "punk"). Untuk bahasa lain, tampal lirik baru dalam bahasa tersebut.'),
        h('li', {}, 'Bila siap, muat turun MP3, kemudian ', h('b', {}, 'Kongsi → LepakTune'), ' supaya ia masuk ke Perpustakaan.'),
      ),
      h('p', { class: 'small muted' }, 'Hasil Suno untuk didengar sendiri sahaja. Jangan muat naik lagu orang lain ke media sosial.'),
    ),
    [{ label: 'Buka Suno', onClick: () => window.open('https://suno.com', '_blank', 'noopener') }],
  );
}
