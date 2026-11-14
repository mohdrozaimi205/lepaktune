// Kongsi lagu ke peranti lain (Quick Share, WhatsApp, Drive) atau muat turun.
const EXT = { 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/flac': 'flac', 'audio/wav': 'wav', 'audio/x-wav': 'wav' };

export function fileFor(song) {
  const ext = EXT[song.blob.type] || 'mp3';
  const name = `${song.title}.${ext}`.replace(/[\\/:*?"<>|]+/g, '');
  return new File([song.blob], name, { type: song.blob.type || 'audio/mpeg' });
}

export function download(file) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

/** Pulangan 'shared' | 'downloaded' | 'cancelled'. */
export async function shareSong(song) {
  const file = fileFor(song);
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: song.title, text: 'Dari LepakTune 🎧' });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  download(file);
  return 'downloaded';
}

export function titleFromFileName(name) {
  return (name || 'Lagu').replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[_]+/g, ' ').trim() || 'Lagu';
}
