// Kawalan di notifikasi, skrin kunci dan butang earphone.
// Elemen <audio> senyap yang berulang memastikan Android anggap app sedang "main media",
// jadi bunyi Web Audio tidak dihentikan bila skrin ditutup.

function silentWavUrl(seconds = 2) {
  const sr = 8000;
  const n = sr * seconds;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

export class MediaControls {
  constructor() {
    this.el = document.createElement('audio');
    this.el.id = 'keepalive';
    this.el.loop = true;
    this.el.src = silentWavUrl();
    this.el.setAttribute('playsinline', '');
    document.body.appendChild(this.el);
  }

  /** handlers: {play, pause, next, prev, seek(sec)} */
  bind(handlers) {
    const ms = navigator.mediaSession;
    if (!ms) return;
    const set = (a, fn) => { try { ms.setActionHandler(a, fn); } catch { /* tidak disokong */ } };
    set('play', () => handlers.play());
    set('pause', () => handlers.pause());
    set('nexttrack', () => handlers.next());
    set('previoustrack', () => handlers.prev());
    set('seekto', (d) => handlers.seek(d.seekTime));
    set('seekbackward', (d) => handlers.seekBy(-(d.seekOffset || 10)));
    set('seekforward', (d) => handlers.seekBy(d.seekOffset || 10));
  }

  async setPlaying(playing) {
    try {
      if (playing) await this.el.play();
      else this.el.pause();
    } catch { /* perlu sentuhan pengguna dulu */ }
    if (navigator.mediaSession) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }

  setMeta({ title, subtitle }) {
    if (!navigator.mediaSession || !window.MediaMetadata) return;
    const base = import.meta.env.BASE_URL;
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: subtitle || 'LepakTune',
      album: 'LepakTune',
      artwork: [
        { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
        { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
      ],
    });
  }

  setPosition(position, duration, rate) {
    try {
      if (navigator.mediaSession?.setPositionState && duration > 0) {
        navigator.mediaSession.setPositionState({ duration, playbackRate: rate || 1, position: Math.min(position, duration) });
      }
    } catch { /* */ }
  }
}
