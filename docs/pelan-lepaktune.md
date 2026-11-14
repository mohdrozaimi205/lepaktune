# Pelan Binaan LepakTune

**Goal:** PWA (+ APK) untuk edit lagu MP3 dan dengar sendiri: tukar format, tempo/key, asingkan vokal/instrumen dengan AI, Gaya Santai, pemain latar belakang, dan simpan hasil.

**Architecture:** Laman statik (Vite) yang dihoskan di GitHub Pages. Semua proses berlaku dalam peranti: Web Audio untuk main dan kesan, ffmpeg.wasm untuk tukar format, SoundTouch untuk tempo/key, dan Demucs (ONNX, onnxruntime-web, WebGPU → WASM) dalam Web Worker untuk asingkan stem. Data disimpan dalam IndexedDB. APK ialah TWA (Bubblewrap) yang memanggil URL PWA.

**Tech stack:** Vite 6, JavaScript (ES modules), vite-plugin-pwa (injectManifest), `idb`, `@ffmpeg/ffmpeg` (core single-thread, tiada COOP/COEP), `@soundtouchjs/audio-worklet` + `soundtouchjs`, `onnxruntime-web`, Vitest (logik tulen), Playwright Chromium (ujian audio sebenar), Bubblewrap CLI (APK).

**Spec:** Keputusan brainstorm + grill-me 14 Nov 2026 (lihat jadual "Keputusan" di bawah).

## Keputusan (dari pengguna)
1. Proses dan dengar dalam peranti yang sama. Butang Kongsi/Import untuk pindah hasil antara Honor 200, Honor Pad X8 dan laptop.
2. Semua peranti ada semua fungsi. Hasil dan stem disimpan dalam MP3 supaya jimat storan.
3. Cara masuk lagu: Tambah Lagu (pemilih fail), Share Target "Kongsi → LepakTune", drag & drop.
4. Main di latar belakang, kawalan notifikasi/skrin kunci/earphone, ulang/shuffle, pemasa tidur (30/60/90 min), kesan secara langsung tanpa perlu simpan dulu.
5. Stem: mod 4 (vokal, dram, bass, lain) sebagai lalai. Suis "Mod Penuh (6)" (+gitar, piano) memuat turun model 6s hanya bila dihidupkan kali pertama.
6. Butang "🎸 AI-kan di Suno" (buka suno.com + panduan 3 langkah). Tukar Key percuma.
7. PWA + APK automatik. Simpan di 4 tempat.
8. Nama **LepakTune**, gaya **"Dek Kaset Malam"**.

## Global constraints
- URL: `https://mohdrozaimi205.github.io/lepaktune/` (Vite `base: '/lepaktune/'`)
- Repo: `mohdrozaimi205/lepaktune`. Folder laptop: `D:\Projek Android Studio Apps\LepakTune`
- Antara muka 100% Bahasa Melayu
- Format keluaran: `mp3` (lalai, 192 kbps), `wav`, `m4a` (AAC 192k), `ogg` (Vorbis q6), `flac`
- Stem disimpan sebagai MP3 192 kbps, 44.1 kHz stereo
- Julat tempo 0.5–1.5x (langkah 0.05). Key −6 hingga +6 semitone. Kedua-duanya bebas antara satu sama lain.
- Model: `public/models/htdemucs_4s.fp16.onnx` dan `htdemucs_6s.fp16.onnx` (setiap satu < 100 MB, same-origin, dicache oleh `modelStore`, tidak diprecache SW)
- Tema: latar `#14100c`, panel `#211a13`, amber `#ffb347`, oren `#ff7a1a`, teks `#f3e6d3`. Font paparan: "Space Grotesk"; angka: "JetBrains Mono".
- APK package id: `io.github.mohdrozaimi205.lepaktune`

## Review focus (diuji dalam task yang berkaitan)
1. Android hentikan audio bila skrin ditutup → output Web Audio dihala ke `<audio>` melalui `MediaStreamAudioDestinationNode` (Task 6, ujian e2e `visibilitychange`).
2. Lagu panjang (≥ 8 min) di tablet kehabisan memori semasa separation → proses ikut segmen 7.8 s dengan overlap 25% (Task 9, ujian chunk boundary).
3. Fail bukan audio atau MP3 rosak → `decodeFile` lempar `AudioDecodeError`, dan UI papar mesej Melayu (Task 2).
4. Storan penuh (`QuotaExceededError`) semasa simpan stem → mesej "Storan penuh, padam lagu lama" dan rollback rekod separa (Task 3).
5. Peranti tanpa WebGPU (Pad X8) → fallback WASM berjaya dan anggaran masa dipaparkan (Task 9).

## Struktur fail
```
lepaktune/
  index.html, vite.config.js, package.json, playwright.config.js, twa-manifest.json
  public/icons/*, public/models/*.onnx, public/suno-guide.svg
  src/main.js                 boot + navigasi 3 tab (Pemain, Studio, Perpustakaan)
  src/ui/theme.css            tema Dek Kaset Malam
  src/ui/playerView.js        skrin pemain + kawalan
  src/ui/studioView.js        tempo/key, stem toggle, Gaya Santai, Simpan, Suno
  src/ui/libraryView.js       senarai lagu, Tambah, Import, Kongsi, Padam
  src/ui/waveform.js          gelombang beranimasi (canvas, AnalyserNode)
  src/audio/decode.js         fail → AudioBuffer
  src/audio/engine.js         graf langsung: stem gain → tempo/key → kesan → output
  src/audio/tempo.js          pembalut SoundTouch (langsung + offline)
  src/audio/effects.js        definisi preset + buildEffectChain
  src/audio/render.js         render offline mengikut tetapan semasa
  src/audio/encode.js         AudioBuffer → Blob ikut format
  src/ai/stft.js              STFT/iSTFT (n_fft 4096, hop 1024, Hann)
  src/ai/modelStore.js        muat turun + cache model (Cache API)
  src/ai/separator.js         API utama ke worker
  src/ai/separator.worker.js  onnxruntime-web + chunking
  src/store/db.js             IndexedDB: songs, stems, settings
  src/player/queue.js         giliran, ulang, shuffle, pemasa tidur
  src/player/mediaSession.js  notifikasi + skrin kunci
  src/share/share.js          Kongsi (Web Share) + Import
  src/sw.js                   service worker + share target
  tools/export_demucs_onnx.py  eksport model (STFT di luar graf)
  tools/reference_separate.py  output rujukan Python untuk ujian
  tests/unit/*.test.js, tests/e2e/*.spec.js, tests/fixtures/
  .github/workflows/pages.yml, apk.yml
```

---

## Fasa 1: Pemain + Perpustakaan + Format + Tempo/Key

### Task 1: Rangka projek + tema + deploy Pages
**Files:** create `package.json`, `vite.config.js`, `index.html`, `src/main.js`, `src/ui/theme.css`, `.github/workflows/pages.yml`, `playwright.config.js`, `tests/e2e/boot.spec.js`
**Produces:** `mountApp(rootEl)` dan tab `#pemain`, `#studio`, `#perpustakaan`
- [ ] Ujian e2e: buka `/lepaktune/`, jangka tajuk "LepakTune", 3 tab boleh ditekan, warna latar body `rgb(20, 16, 12)`
- [ ] `npx playwright test boot` → FAIL
- [ ] Bina rangka Vite + vite-plugin-pwa (manifest: name "LepakTune", theme `#ff7a1a`, display standalone, ikon 192/512 maskable)
- [ ] `npx playwright test boot` → PASS
- [ ] Workflow Pages: build → deploy `dist/` pada setiap push ke `main`
- [ ] Commit `feat: rangka LepakTune + tema Dek Kaset Malam`

### Task 2: Nyahkod fail audio
**Files:** create `src/audio/decode.js`, `tests/e2e/decode.spec.js`, `tests/fixtures/{tone-10s.mp3, bukan-audio.txt}` (jana dengan ffmpeg dalam `tests/fixtures/make.sh`)
**Produces:** `decodeFile(file: Blob, ctx: BaseAudioContext): Promise<AudioBuffer>`, `class AudioDecodeError extends Error`
- [ ] Ujian: tone-10s.mp3 → `duration` 10±0.05 s, 2 saluran, 44100 Hz. bukan-audio.txt → lempar `AudioDecodeError`
- [ ] Run → FAIL, implement, run → PASS
- [ ] Commit

### Task 3: Storan IndexedDB
**Files:** create `src/store/db.js`, `tests/unit/db.test.js` (guna `fake-indexeddb`)
**Produces:**
- `addSong({title, blob, durationSec}) → id`
- `getSong(id)`, `listSongs() → [{id,title,durationSec,createdAt,hasStems4,hasStems6}]`
- `deleteSong(id)` (padam stem sekali)
- `putStems(songId, mode: 4|6, {vocals,drums,bass,other,guitar?,piano?}: Record<string,Blob>)` (atomik, satu transaksi)
- `getStems(songId, mode)`, `getSetting(key, def)`, `setSetting(key, val)`
- `class StorageFullError`
- [ ] Ujian: tambah/senarai/padam. Padam lagu turut padam stem. `putStems` yang gagal tengah jalan (mock quota) → lempar `StorageFullError` dan tiada stem separa tersimpan
- [ ] FAIL → implement → PASS → commit

### Task 4: Perpustakaan (Tambah, drag & drop)
**Files:** create `src/ui/libraryView.js`, `tests/e2e/library.spec.js`
**Uses:** `decodeFile`, `addSong`, `listSongs`, `deleteSong`
- [ ] Ujian: butang "＋ Tambah Lagu" (input `accept="audio/*"`, multiple) masukkan tone-10s.mp3 → muncul dalam senarai dengan tempoh "0:10". Drag & drop fail → masuk. Fail rosak → toast "Fail ini bukan lagu yang sah". Padam → hilang
- [ ] FAIL → implement → PASS → commit

### Task 5: Tempo dan Key
**Files:** create `src/audio/tempo.js`, `tests/e2e/tempo.spec.js`
**Produces:** `createTempoNode(ctx) → {node: AudioWorkletNode, set({tempo, semitones})}`, `renderTempo(buffer, {tempo, semitones}) → Promise<AudioBuffer>`
- [ ] Ujian: tone 440 Hz 10 s, tempo 0.8 → tempoh 12.5±0.1 s, frekuensi dominan (FFT) 440±5 Hz. semitones +2 → 493.9±5 Hz, tempoh tak berubah
- [ ] FAIL → implement → PASS → commit

### Task 6: Enjin audio + pemain latar belakang
**Files:** create `src/audio/engine.js`, `src/player/queue.js`, `src/player/mediaSession.js`, `src/ui/playerView.js`, `src/ui/waveform.js`, `tests/unit/queue.test.js`, `tests/e2e/player.spec.js`
**Produces:**
- `engine.load(sources: Record<string,AudioBuffer>)`: kunci `'mix'` atau nama stem
- `engine.play()/pause()/seek(sec)`
- `engine.setGain(stem, 0..1)`, `engine.setTempoKey({tempo, semitones})`, `engine.setPreset(presetId|null)`
- `engine.analyser`: output melalui `MediaStreamAudioDestinationNode` → `<audio id="out">`
- `queue`: `setList(ids)`, `next()`, `prev()`, `setRepeat('off'|'one'|'all')`, `setShuffle(bool)`, `startSleepTimer(min)`, `cancelSleepTimer()`, event `'ended'`, `'sleep'`
- [ ] Ujian unit queue: repeat 'one' ulang lagu sama. 'all' kembali ke lagu pertama. Shuffle melawat semua lagu sekali sebelum ulang. Pemasa 30 min (fake timers) → emit `'sleep'`
- [ ] Ujian e2e: main → `<audio id="out">` tidak paused, `navigator.mediaSession.metadata.title` = tajuk lagu. Simulasi `visibilitychange` hidden → masih bermain. Butang ⏭ dalam Media Session → lagu seterusnya
- [ ] FAIL → implement → PASS → commit

### Task 7: Simpan + tukar format
**Files:** create `src/audio/render.js`, `src/audio/encode.js`, `tests/e2e/encode.spec.js`
**Produces:** `renderCurrent(engineState) → Promise<AudioBuffer>` (stem gain + tempo/key + preset secara offline), `encode(buffer, format: 'mp3'|'wav'|'m4a'|'ogg'|'flac') → Promise<Blob>`. Hasil disimpan sebagai lagu baru `"<tajuk> (<label tetapan>)"`
- [ ] Ujian: setiap format → Blob dengan MIME betul dan boleh dinyahkod semula, tempoh ±0.1 s. WAV dibuat terus dalam JS, format lain guna ffmpeg.wasm (dimuat lazy)
- [ ] FAIL → implement → PASS → commit

### Task 8: Kongsi + Import + Share Target
**Files:** create `src/share/share.js`, `src/sw.js`, modify `vite.config.js` (manifest `share_target`: POST multipart `/lepaktune/share`, files `audio/*`), `tests/e2e/share.spec.js`
**Produces:** `shareSong(id)` (Web Share Level 2, fallback muat turun), `importFiles(files: File[])`
- [ ] Ujian: POST multipart ke `/lepaktune/share` melalui SW → lagu masuk dalam DB dan redirect ke `#perpustakaan?baru=1`. Tiada `navigator.canShare` → fallback muat turun dengan nama fail betul
- [ ] FAIL → implement → PASS → commit

---

## Fasa 2: AI Asingkan Stem

### Task 9: Eksport model + STFT + separator
**Files:** create `tools/export_demucs_onnx.py`, `tools/reference_separate.py`, `src/ai/stft.js`, `src/ai/modelStore.js`, `src/ai/separator.js`, `src/ai/separator.worker.js`, `tests/unit/stft.test.js`, `tests/e2e/separator.spec.js`, `tests/fixtures/mix-10s.mp3` + `ref/*.wav`
**Produces:** `separate(buffer: AudioBuffer, {mode: 4|6, onProgress(pct, etaSec)}) → Promise<Record<string, AudioBuffer>>`, `modelStore.ensure(mode, onProgress) → Promise<ArrayBuffer>`, `modelStore.has(mode) → Promise<boolean>`
- Nota algoritma: model htdemucs dieksport dengan STFT/iSTFT **di luar** graf ONNX (output cabang spektrum + cabang masa). JS jalankan `stft`, model, `istft`, kemudian jumlahkan dengan cabang masa. Segmen 7.8 s, overlap 0.25, digabung semula dengan tetingkap segi tiga (sama macam `apply_model` Demucs).
- [ ] Ujian unit: `istft(stft(x))` ≈ x (ralat maksimum < 1e-4)
- [ ] Ujian e2e: mix-10s.mp3 mod 4 → kunci `vocals,drums,bass,other`. SDR berbanding rujukan Python ≥ 25 dB untuk setiap stem. Jumlah stem ≈ input (ralat RMS < 0.02). Paksa `executionProviders:['wasm']` → masih lulus. Sempadan segmen: tiada lonjakan > 0.1 pada sampel 7.8 s
- [ ] FAIL → implement → PASS → commit

### Task 10: UI Studio untuk stem
**Files:** create `src/ui/studioView.js`, `tests/e2e/studio-stems.spec.js`
**Uses:** `separate`, `putStems`, `getStems`, `engine.load/setGain`
- [ ] Ujian: butang "✨ Asingkan" → bar kemajuan + anggaran masa → stem disimpan (MP3 192k). Butang cepat: **Minus One** (vokal 0, lain-lain 1), **Vokal Saja** (vokal 1, lain-lain 0). Toggle setiap stem. Suis "Mod Penuh (6)" kali pertama papar "Muat turun ±80MB?" → setuju → tambah butang Gitar dan Piano. Lagu yang sudah diasingkan → stem dimuat terus tanpa proses semula
- [ ] FAIL → implement → PASS → commit

---

## Fasa 3: Gaya Santai + Suno

### Task 11: Preset kesan
**Files:** create `src/audio/effects.js`, `tests/unit/effects.test.js`, `tests/e2e/effects.spec.js`
**Produces:** `PRESETS: Record<id,{label, tempo?, semitones?, nodes: NodeSpec[]}>`, `buildEffectChain(ctx, presetId) → {input, output, dispose()}`
| id | label | nilai |
|---|---|---|
| `slowed` | Slowed + Reverb | rate 0.85 (tempo 0.85, semitones −2.8), reverb 3.5 s wet 0.35 |
| `lofi` | Lofi | lowpass 3500 Hz, bitcrush 12-bit, bunyi vinyl −32 dB, wow 0.3 Hz |
| `8d` | 8D | auto-pan 0.12 Hz penuh, reverb 2 s wet 0.25 |
| `bass` | Bass Boost | lowshelf 150 Hz +8 dB, limiter −1 dBFS |
| `radio` | Radio Lama | bandpass 300–3400 Hz, waveshaper drive 0.3, mono |
| `bilik` | Akustik Bilik | reverb 0.8 s wet 0.2, highshelf 8 kHz −3 dB |
- IR reverb dijana secara prosedur (hingar eksponen), tiada fail luar
- [ ] Ujian unit: setiap preset ada label Melayu, dan nilai mengikut jadual
- [ ] Ujian e2e: `bass` → tenaga < 150 Hz naik ≥ 6 dB. `radio` → tenaga > 5 kHz turun ≥ 20 dB. `8d` → beza L/R berubah dalam 10 s. Tiada klip > 0 dBFS untuk semua preset
- [ ] FAIL → implement → PASS → commit

### Task 12: Butang Suno
**Files:** modify `src/ui/studioView.js`, create `public/suno-guide.svg`, `tests/e2e/suno.spec.js`
- [ ] Ujian: "🎸 AI-kan di Suno" buka panel 3 langkah (1. Muat naik lagu di Suno → Cover, 2. Pilih gaya/bahasa, 3. Muat turun → Kongsi → LepakTune) dan butang "Buka Suno" (`https://suno.com`, `target=_blank`)
- [ ] FAIL → implement → PASS → commit

---

## Fasa 4: APK + 4 tempat

### Task 13: APK TWA automatik
**Files:** create `twa-manifest.json`, `.github/workflows/apk.yml`, `public/.well-known/assetlinks.json` (salinan rujukan)
- `apk.yml`: pada tag `v*` → Bubblewrap build → tandatangan guna keystore dari secrets `KEYSTORE_B64`, `KEYSTORE_PASS` → upload `LepakTune-<versi>.apk` ke Releases
- assetlinks mesti berada di `https://mohdrozaimi205.github.io/.well-known/assetlinks.json`. Ini perlukan repo `mohdrozaimi205.github.io`. Kalau repo itu tiada, APK tetap jalan tapi bar URL akan kelihatan. (Pembina semak dan beri panduan kepada pengguna.)
- [ ] Ujian: workflow berjaya, APK dalam Release, `aapt dump badging` → package `io.github.mohdrozaimi205.lepaktune`
- [ ] Commit + tag `v1.0.0`

### Task 14: Simpan ke 4 tempat
- [ ] (1) GitHub: panduan langkah demi langkah untuk pengguna buat repo `lepaktune` + aktifkan Pages
- [ ] (2) Projek → `D:\Projek Android Studio Apps\LepakTune`
- [ ] (3) APK → `D:\Projek Android Studio Apps\LepakTune\APK\`
- [ ] (4) APK → Google Drive folder "Apk Android Studio"
- [ ] Ujian akhir manual: install di Honor 200 + Pad X8 + Chrome laptop. Tambah lagu, Minus One, Slowed, Simpan MP3, Kongsi ke tablet, main dengan skrin tutup
