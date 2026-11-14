// Skrin Perpustakaan: tambah, import, senarai, kongsi, padam.
import { h } from './dom.js';
import { fmtTime } from '../audio/decode.js';

export function initLibrary(root, app) {
  const input = h('input', { type: 'file', accept: 'audio/*,.mp3,.m4a,.wav,.ogg,.flac,.aac', multiple: true, class: 'hidden', id: 'fileInput' });
  input.addEventListener('change', async () => {
    const files = [...input.files];
    input.value = '';
    if (files.length) await app.addFiles(files);
  });
  const list = h('div', { class: 'songs', id: 'songList' });
  const count = h('span', { class: 'r' });

  root.append(
    h('div', { class: 'panel' },
      h('h3', {}, '📚 Perpustakaan', count),
      h('div', { class: 'drop' },
        h('div', { style: 'font-size:30px' }, '🎵'),
        h('div', {}, 'Seret fail lagu ke sini, atau'),
        h('div', { class: 'row', style: 'justify-content:center;margin-top:10px' },
          h('button', { class: 'btn hot', onClick: () => input.click() }, '＋ Tambah Lagu'),
          h('button', { class: 'btn', title: 'Import lagu yang dikongsi dari peranti lain', onClick: () => input.click() }, '📥 Import'),
        ),
        h('div', { class: 'small', style: 'margin-top:10px' }, 'Tip telefon: dari app Fail atau WhatsApp, tekan Kongsi → LepakTune'),
      ),
      input,
      list,
    ),
  );

  function render() {
    count.textContent = `${app.songs.length} lagu`;
    if (!app.songs.length) {
      list.replaceChildren(h('div', { class: 'empty' }, h('div', { class: 'big' }, '📼'), h('div', {}, 'Belum ada lagu. Tambah lagu pertama awak!')));
      return;
    }
    list.replaceChildren(...app.songs.map((s) => {
      const badges = [];
      if (s.hasStems4) badges.push(h('span', { class: 'tag' }, 'AI ✓'));
      if (s.parentId) badges.push(h('span', { class: 'tag' }, 'HASIL'));
      return h('div', { class: `song${app.current?.id === s.id ? ' now' : ''}`, 'data-song': s.id },
        h('div', { class: 'art' }, s.parentId ? '💿' : '📼'),
        h('div', {},
          h('div', { class: 't', title: s.title }, s.title),
          h('div', { class: 'm' }, h('span', {}, fmtTime(s.durationSec)), h('span', {}, `${(s.size / 1e6).toFixed(1)} MB`), ...badges),
        ),
        h('div', { class: 'acts' },
          h('button', { title: 'Main', 'aria-label': `Main ${s.title}`, onClick: () => app.loadSong(s.id) }, '▶'),
          h('button', { title: 'Buka di Studio', 'aria-label': `Studio ${s.title}`, onClick: async () => { if (app.current?.id !== s.id) await app.loadSong(s.id, { autoplay: false }); location.hash = 'studio'; } }, '🎛️'),
          h('button', { title: 'Kongsi', 'aria-label': `Kongsi ${s.title}`, onClick: () => app.share(s.id) }, '⤴'),
          h('button', { title: 'Padam', 'aria-label': `Padam ${s.title}`, onClick: () => app.remove(s.id) }, '🗑'),
        ),
      );
    }));
  }

  app.addEventListener('change', render);
  render();
}
