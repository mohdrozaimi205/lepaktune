// Skrin Pemain: kaset, gelombang bunyi, kawalan.
import { h } from './dom.js';
import { engine } from '../audio/engine.js';
import { fmtTime } from '../audio/decode.js';
import { effectiveRate } from '../audio/graph.js';
import { PRESETS } from '../audio/effects.js';
import { drawWave } from './waveform.js';

const REPEAT_ICON = { off: '➡️', all: '🔁', one: '🔂' };
const REPEAT_NEXT = { off: 'all', all: 'one', one: 'off' };
const REPEAT_LABEL = { off: 'Tiada ulang', all: 'Ulang semua', one: 'Ulang satu' };
const SLEEP_STEPS = [0, 30, 60, 90];

export function initPlayer(root, app) {
  const title = h('div', { class: 't', id: 'nowTitle' }, 'Tiada lagu');
  const sub = h('div', { class: 's', id: 'nowSub' }, 'Tambah lagu di Perpustakaan');
  const cassette = h('div', { class: 'cassette' },
    h('div', { class: 'screws' }, h('i'), h('i'), h('i'), h('i')),
    h('div', { class: 'label' }, title, sub),
    h('div', { class: 'window' }, h('div', { class: 'reel' }), h('div', { class: 'tape' }), h('div', { class: 'reel' })),
    h('div', { class: 'bottom' }),
  );
  const canvas = h('canvas', { class: 'wave', width: 700, height: 140 });
  const seek = h('input', { type: 'range', min: 0, max: 1000, value: 0, 'aria-label': 'Kedudukan lagu' });
  const tNow = h('span', {}, '0:00');
  const tEnd = h('span', {}, '0:00');
  let seeking = false;
  seek.addEventListener('input', () => { seeking = true; tNow.textContent = fmtTime((seek.value / 1000) * engine.duration); });
  seek.addEventListener('change', async () => { await engine.seek((seek.value / 1000) * engine.duration); seeking = false; });

  const playBtn = h('button', { class: 'knob big', id: 'playBtn', 'aria-label': 'Main', onClick: () => app.toggle() }, '▶');
  const repeatBtn = h('button', { class: 'knob sm', title: 'Ulang', onClick: () => { app.queue.setRepeat(REPEAT_NEXT[app.queue.repeat]); render(); } });
  const shuffleBtn = h('button', { class: 'knob sm', title: 'Shuffle', onClick: () => { app.queue.setShuffle(!app.queue.shuffle); render(); } }, '🔀');
  const sleepBadge = h('span', { class: 'badge hidden' });
  const sleepBtn = h('button', {
    class: 'knob sm', title: 'Pemasa tidur',
    onClick: () => {
      const q = app.queue;
      const curMin = q.sleepEndsAt ? q._sleepMin : 0;
      const nxt = SLEEP_STEPS[(SLEEP_STEPS.indexOf(curMin) + 1) % SLEEP_STEPS.length];
      if (nxt) { q.startSleepTimer(nxt); q._sleepMin = nxt; } else { q.cancelSleepTimer(); q._sleepMin = 0; }
      render();
    },
  }, '⏰', sleepBadge);

  const statusLine = h('div', { class: 'small muted', style: 'text-align:center;margin-top:10px' });

  root.append(
    h('div', { class: 'panel deck' },
      h('h3', {}, '📼 Sedang Dimainkan', h('span', { class: 'r', id: 'modeTag' }, 'ASAL')),
      cassette,
      canvas,
      h('div', { class: 'seek' }, tNow, seek, tEnd),
      h('div', { class: 'transport' },
        repeatBtn,
        h('button', { class: 'knob', 'aria-label': 'Sebelum', onClick: () => app.prev() }, '⏮'),
        playBtn,
        h('button', { class: 'knob', 'aria-label': 'Seterusnya', onClick: () => app.next() }, '⏭'),
        shuffleBtn,
        sleepBtn,
      ),
      statusLine,
    ),
  );

  function render() {
    const cur = app.current;
    title.textContent = cur ? cur.title : 'Tiada lagu';
    const st = engine.state;
    const bits = [];
    if (cur) {
      bits.push(app.mode === 'asal' ? 'Lagu asal' : { minus1: 'Minus One', vokal: 'Vokal Saja', pilih: 'Pilih Instrumen' }[app.mode]);
      if (st.preset) bits.push(PRESETS[st.preset].label);
      if (st.tempo !== 1) bits.push(`${st.tempo.toFixed(2)}x`);
      if (st.semitones) bits.push(`Key ${st.semitones > 0 ? '+' : ''}${st.semitones}`);
    }
    sub.textContent = cur ? bits.join(' • ') : 'Tambah lagu di Perpustakaan';
    document.getElementById('modeTag').textContent = cur ? (bits[0] || '').toUpperCase() : '';
    playBtn.textContent = engine.playing ? '⏸' : '▶';
    playBtn.setAttribute('aria-label', engine.playing ? 'Jeda' : 'Main');
    cassette.parentElement.classList.toggle('playing', engine.playing);
    cassette.querySelectorAll('.reel').forEach((r) => { r.style.animationDuration = `${2.2 / effectiveRate(st)}s`; });
    repeatBtn.textContent = REPEAT_ICON[app.queue.repeat];
    repeatBtn.title = REPEAT_LABEL[app.queue.repeat];
    repeatBtn.classList.toggle('lit', app.queue.repeat !== 'off');
    shuffleBtn.classList.toggle('lit', app.queue.shuffle);
    const sm = app.queue.sleepEndsAt ? app.queue._sleepMin : 0;
    sleepBtn.classList.toggle('lit', !!sm);
    sleepBadge.classList.toggle('hidden', !sm);
    sleepBadge.textContent = sm ? `${sm}m` : '';
    tEnd.textContent = fmtTime(engine.duration);
    statusLine.textContent = app.sep ? '✨ AI sedang mengasingkan lagu…' : (app.queue.sleepEndsAt ? `😴 Berhenti pada ${new Date(app.queue.sleepEndsAt).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}` : '');
  }

  function tick() {
    if (!seeking && engine.duration) {
      seek.value = String(Math.round((engine.position / engine.duration) * 1000));
      tNow.textContent = fmtTime(engine.position);
    }
    drawWave(canvas, engine.analyser, engine.playing);
    requestAnimationFrame(tick);
  }

  app.addEventListener('change', render);
  render();
  requestAnimationFrame(tick);
}
