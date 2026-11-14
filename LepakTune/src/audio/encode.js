// AudioBuffer -> Blob dalam format pilihan (guna Mediabunny + WebCodecs).
import {
  Output, BufferTarget, AudioBufferSource, canEncodeAudio,
  Mp3OutputFormat, WavOutputFormat, Mp4OutputFormat, OggOutputFormat, FlacOutputFormat,
} from 'mediabunny';
import { registerMp3Encoder } from '@mediabunny/mp3-encoder';

let mp3Ready = null;
async function ensureMp3() {
  if (!mp3Ready) {
    mp3Ready = (async () => {
      if (!(await canEncodeAudio('mp3'))) registerMp3Encoder();
    })();
  }
  return mp3Ready;
}

export const FORMATS = {
  mp3: { label: 'MP3', ext: 'mp3', mime: 'audio/mpeg', codec: 'mp3', bitrate: 192e3, make: () => new Mp3OutputFormat() },
  m4a: { label: 'M4A (AAC)', ext: 'm4a', mime: 'audio/mp4', codec: 'aac', bitrate: 192e3, make: () => new Mp4OutputFormat({ fastStart: 'in-memory' }) },
  ogg: { label: 'OGG (Opus)', ext: 'ogg', mime: 'audio/ogg', codec: 'opus', bitrate: 160e3, make: () => new OggOutputFormat() },
  flac: { label: 'FLAC', ext: 'flac', mime: 'audio/flac', codec: 'flac', make: () => new FlacOutputFormat() },
  wav: { label: 'WAV', ext: 'wav', mime: 'audio/wav', codec: 'pcm-s16', make: () => new WavOutputFormat() },
};

/** Senarai format yang peranti ini boleh hasilkan. */
export async function availableFormats() {
  await ensureMp3();
  const out = [];
  for (const [id, f] of Object.entries(FORMATS)) {
    let ok = false;
    try {
      ok = id === 'mp3' || id === 'wav' || (await canEncodeAudio(f.codec, { numberOfChannels: 2, sampleRate: f.codec === 'opus' ? 48000 : 44100, bitrate: f.bitrate }));
    } catch { ok = false; }
    if (ok) out.push(id);
  }
  return out;
}

/**
 * @param {AudioBuffer} buffer
 * @param {'mp3'|'wav'|'m4a'|'ogg'|'flac'} format
 * @param {{bitrate?: number}} opts
 * @returns {Promise<Blob>}
 */
export async function encode(buffer, format = 'mp3', opts = {}) {
  const f = FORMATS[format];
  if (!f) throw new Error(`Format tidak disokong: ${format}`);
  if (format === 'mp3') await ensureMp3();
  if (format === 'ogg' && buffer.sampleRate !== 48000) buffer = await resample(buffer, 48000);
  const output = new Output({ format: f.make(), target: new BufferTarget() });
  const src = new AudioBufferSource({ codec: f.codec, bitrate: opts.bitrate ?? f.bitrate });
  output.addAudioTrack(src);
  await output.start();
  await src.add(buffer);
  src.close();
  await output.finalize();
  return new Blob([output.target.buffer], { type: f.mime });
}

async function resample(buffer, rate) {
  const ctx = new OfflineAudioContext(buffer.numberOfChannels, Math.ceil(buffer.duration * rate), rate);
  const s = ctx.createBufferSource();
  s.buffer = buffer;
  s.connect(ctx.destination);
  s.start();
  return ctx.startRendering();
}

export function safeFileName(name) {
  return name.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'lagu';
}
