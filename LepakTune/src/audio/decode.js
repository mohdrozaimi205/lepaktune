export class AudioDecodeError extends Error {
  constructor(msg = 'Fail ini bukan lagu yang sah') { super(msg); this.name = 'AudioDecodeError'; }
}

/** Nyahkod Blob/File kepada AudioBuffer 44.1 kHz. */
export async function decodeFile(file, ctx) {
  let buf;
  try {
    buf = await file.arrayBuffer();
  } catch {
    throw new AudioDecodeError('Fail tak boleh dibaca');
  }
  try {
    const audio = await ctx.decodeAudioData(buf);
    if (!audio || audio.length === 0) throw new Error('kosong');
    return audio;
  } catch {
    throw new AudioDecodeError();
  }
}

let _decodeCtx = null;
/** Konteks khas untuk nyahkod pada 44.1 kHz (kadar yang diperlukan Demucs). */
export function decodeContext() {
  if (!_decodeCtx) _decodeCtx = new OfflineAudioContext(2, 1, 44100);
  return _decodeCtx;
}

/** Pastikan buffer stereo (Demucs perlukan 2 saluran). */
export function toStereo(buffer) {
  if (buffer.numberOfChannels >= 2) return buffer;
  const out = new AudioBuffer({ length: buffer.length, numberOfChannels: 2, sampleRate: buffer.sampleRate });
  const d = buffer.getChannelData(0);
  out.copyToChannel(d, 0);
  out.copyToChannel(d, 1);
  return out;
}

export function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
