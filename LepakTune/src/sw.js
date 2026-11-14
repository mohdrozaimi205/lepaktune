// Service worker LepakTune:
// 1) simpan fail app supaya boleh guna tanpa internet
// 2) terima lagu dari "Kongsi -> LepakTune" (share target)
// 3) tambah header COOP/COEP supaya AI boleh guna banyak teras CPU (lebih laju)
import { precache, matchPrecache, cleanupOutdatedCaches } from 'workbox-precaching';
import { pushInbox } from './store/db.js';

const BASE = new URL(self.registration.scope).pathname; // '/lepaktune/'
const RUNTIME = 'lepaktune-runtime-v1';

precache(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

function isolate(res) {
  if (!res || res.status === 0 || res.type === 'opaque') return res;
  const h = new Headers(res.headers);
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Embedder-Policy', 'credentialless');
  h.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

async function handleShare(request) {
  try {
    const form = await request.formData();
    const files = form.getAll('audio').filter((f) => f && typeof f !== 'string');
    for (const f of files) await pushInbox(f);
    return Response.redirect(`${BASE}#perpustakaan?baru=${files.length}`, 303);
  } catch {
    return Response.redirect(`${BASE}#perpustakaan?ralat=kongsi`, 303);
  }
}

async function handleGet(request) {
  const url = new URL(request.url);
  if (request.mode === 'navigate') {
    try {
      const net = await fetch(request);
      if (net.ok) return isolate(net);
    } catch { /* luar talian */ }
    return isolate(await matchPrecache(`${BASE}index.html`));
  }
  const pre = await matchPrecache(request);
  if (pre) return isolate(pre);
  // Fail besar (enjin AI) - simpan selepas kali pertama
  if (url.pathname.endsWith('.wasm') || url.pathname.endsWith('soundtouch-processor.js')) {
    const c = await caches.open(RUNTIME);
    const hit = await c.match(request);
    if (hit) return isolate(hit);
    const net = await fetch(request);
    if (net.ok) await c.put(request, net.clone());
    return isolate(net);
  }
  return isolate(await fetch(request));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.method === 'POST' && url.pathname === `${BASE}share`) {
    event.respondWith(handleShare(request));
    return;
  }
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith(`${BASE}models/`)) return; // modelStore urus sendiri
  if (request.headers.has('range')) return;
  event.respondWith(handleGet(request));
});
