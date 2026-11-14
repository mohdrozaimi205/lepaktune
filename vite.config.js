import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const BASE = '/lepaktune/';

export default defineConfig({
  base: BASE,
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
  },
  plugins: [
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        globIgnores: ['ort/**', 'models/**'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      manifest: {
        id: BASE,
        name: 'LepakTune',
        short_name: 'LepakTune',
        description: 'Studio lagu peribadi: minus one, vokal saja, tempo, gaya santai.',
        lang: 'ms',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'any',
        background_color: '#14100c',
        theme_color: '#ff7a1a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        share_target: {
          action: BASE + 'share',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: { title: 'title', files: [{ name: 'audio', accept: ['audio/*', '.mp3', '.m4a', '.wav', '.ogg', '.flac'] }] },
        },
        file_handlers: [
          { action: BASE, accept: { 'audio/*': ['.mp3', '.m4a', '.wav', '.ogg', '.flac', '.aac'] } },
        ],
      },
    }),
  ],
});
