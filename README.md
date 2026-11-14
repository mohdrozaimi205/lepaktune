# 🎧 LepakTune

Studio lagu peribadi untuk dengar sendiri masa kerja atau bersantai.

**Buka / install:** https://mohdrozaimi205.github.io/lepaktune/

## Fungsi
- 📚 Perpustakaan lagu: Tambah Lagu, seret & lepas, **Kongsi → LepakTune** dari app lain
- 📼 Pemain lagu: terus main bila skrin tutup, kawalan di notifikasi/earphone, ulang, shuffle, pemasa tidur
- 🤖 AI asingkan lagu (Demucs): **Minus One**, **Vokal Saja**, pilih instrumen (Vokal, Dram, Bass, Lain-lain)
- ⏱️ Tempo laju/perlahan tanpa ubah suara, dan Tukar Key
- 🌙 Gaya Santai: Slowed + Reverb, Lofi, 8D, Bass Boost, Radio Lama, Akustik Bilik
- 💾 Simpan hasil: MP3, M4A, OGG, FLAC, WAV (ikut sokongan peranti)
- 🎸 Butang ke Suno untuk tukar genre / bahasa

Semua proses berlaku dalam peranti sendiri. Tiada server, tiada akaun.

## Untuk pembangun
```
npm ci
npm run dev        # cuba di komputer
npm test           # ujian unit
npm run build      # bina ke dist/
npm run e2e        # ujian Chrome (Playwright)
```
- `.github/workflows/pages.yml` terbitkan ke GitHub Pages bila ada push ke `main`.
- `.github/workflows/apk.yml` bina APK (Bubblewrap/TWA) selepas Pages siap, dan letak dalam Releases.

## Lesen
- Kod LepakTune: kegunaan peribadi.
- `src/ai/vendor/*`: dari [demucs-js](https://github.com/bakkot/demucs-js) (MIT, Kevin Gibbons). Ada pembetulan kecil pada `istft`.
- Model `htdemucs` (Meta): **untuk kegunaan peribadi dan penyelidikan sahaja**.
